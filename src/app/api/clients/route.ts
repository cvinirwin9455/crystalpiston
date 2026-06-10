import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Helper: create admin client with service role key
async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/clients - List all clients
export async function GET() {
  const supabase = await createClient()

  // Verify the requesting user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = await createAdminClient()

  // Query users and clients separately to avoid join issues
  const { data: clientUsers, error: usersError } = await adminClient
    .from('users')
    .select('id, email, name, gender, status, avatar_url, created_at')
    .eq('role', 'client')
    .order('name')

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 })
  }

  const { data: clientRecords } = await adminClient
    .from('clients')
    .select('id, user_id, goal, start_date, plan_end, owed, paid')

  // Build a lookup map: user_id -> client record
  const clientMap = new Map<string, any>()
  for (const cr of clientRecords || []) {
    clientMap.set(cr.user_id, cr)
  }

  // Fetch active plans to get goals
  const { data: activePlans } = await adminClient
    .from('plans')
    .select('client_id, goal')
    .eq('status', 'active')

  const activePlanByClientId = new Map<string, any>()
  for (const plan of activePlans || []) {
    activePlanByClientId.set(plan.client_id, plan)
  }

  // Build response, auto-create missing client records
  const formatted = []
  for (const u of clientUsers || []) {
    let clientRecord = clientMap.get(u.id) || null

    if (!clientRecord) {
      const { data: newClient } = await adminClient
        .from('clients')
        .insert({ user_id: u.id })
        .select('id, user_id, goal, start_date, plan_end, owed, paid')
        .single()
      if (newClient) clientRecord = newClient
    }

    const activePlan = clientRecord ? activePlanByClientId.get(clientRecord.id) : null

    formatted.push({
      userId: u.id,
      clientId: clientRecord?.id || null,
      name: u.name,
      email: u.email,
      gender: u.gender,
      status: u.status,
      avatarUrl: u.avatar_url,
      goal: activePlan?.goal || clientRecord?.goal || '',
      startDate: clientRecord?.start_date || '',
      planEnd: clientRecord?.plan_end || '',
      owed: clientRecord?.owed || 0,
      paid: clientRecord?.paid || 0,
      createdAt: u.created_at,
    })
  }

  return NextResponse.json(formatted)
}

// POST /api/clients - Create a new client (invite via email)
export async function POST(request: Request) {
  const supabase = await createClient()

  // Verify the requesting user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { name, email, gender, goal, startDate, planEnd, owed } = body

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  const adminClient = await createAdminClient()

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      name,
      role: 'client',
    },
    redirectTo: `${getBaseUrl(request)}/auth/callback?next=/set-password`,
  })

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  const newUserId = inviteData.user.id

  // Update gender on the auto-created users row
  if (gender) {
    await adminClient
      .from('users')
      .update({ gender })
      .eq('id', newUserId)
  }

  // Create the clients record
  const { error: clientError } = await adminClient
    .from('clients')
    .insert({
      user_id: newUserId,
      goal: goal || null,
      start_date: startDate || null,
      plan_end: planEnd || null,
      owed: owed ? parseFloat(owed) : 0,
      paid: 0,
    })

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 })
  }

  return NextResponse.json({ 
    success: true, 
    userId: newUserId,
    message: `Invite email sent to ${email}` 
  })
}

// Helper: get base URL from request
function getBaseUrl(request: Request) {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}
