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

  // Fetch auth user data to determine invite status
  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const authUserMap = new Map<string, any>()
  for (const au of authUsers || []) {
    authUserMap.set(au.id, au)
  }

  // Only fetch clients assigned to the current coach
  const { data: clientRecords } = await adminClient
    .from('clients')
    .select('id, user_id, goal, start_date, plan_end, owed, paid, coach_id')
    .eq('coach_id', user.id)

  // Build a lookup map: user_id -> client record
  const clientMap = new Map<string, any>()
  for (const cr of clientRecords || []) {
    clientMap.set(cr.user_id, cr)
  }

  // Filter clientUsers to only those assigned to this coach
  const assignedUserIds = new Set((clientRecords || []).map(cr => cr.user_id))
  const filteredClientUsers = (clientUsers || []).filter(u => assignedUserIds.has(u.id))

  // Fetch active plans to get goals and plan-level financials
  const { data: activePlans } = await adminClient
    .from('plans')
    .select('client_id, goal, owed, paid, start_date, end_date')
    .eq('status', 'active')

  const activePlanByClientId = new Map<string, any>()
  for (const plan of activePlans || []) {
    activePlanByClientId.set(plan.client_id, plan)
  }

  // Build response
  const formatted = []
  for (const u of filteredClientUsers) {
    let clientRecord = clientMap.get(u.id) || null

    const activePlan = clientRecord ? activePlanByClientId.get(clientRecord.id) : null

    // Use active plan financials if available, otherwise fall back to legacy clients table
    const owed = activePlan ? (parseFloat(activePlan.owed) || 0) : 0
    const paid = activePlan ? (parseFloat(activePlan.paid) || 0) : 0

    // Determine invite status from auth user data
    const authUser = authUserMap.get(u.id)
    let inviteStatus: 'accepted' | 'pending' | 'expired' = 'accepted'
    if (authUser) {
      // User has truly accepted if they have actually signed in (set their password and logged in)
      if (authUser.last_sign_in_at && authUser.last_sign_in_at !== authUser.created_at) {
        inviteStatus = 'accepted'
      } else {
        // Check if invite was sent more than 7 days ago (Supabase default expiry)
        const invitedAt = new Date(authUser.invited_at || authUser.created_at)
        const daysSinceInvite = (Date.now() - invitedAt.getTime()) / (1000 * 60 * 60 * 24)
        inviteStatus = daysSinceInvite > 7 ? 'expired' : 'pending'
      }
    }

    formatted.push({
      userId: u.id,
      clientId: clientRecord?.id || null,
      name: u.name,
      email: u.email,
      gender: u.gender,
      status: u.status,
      avatarUrl: u.avatar_url,
      goal: activePlan?.goal || clientRecord?.goal || '',
      startDate: activePlan?.start_date || clientRecord?.start_date || '',
      planEnd: activePlan?.end_date || clientRecord?.plan_end || '',
      owed,
      paid,
      inviteStatus,
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

  // Create the clients record (no owed/paid - those live on plans now)
  const { data: newClientRecord, error: clientError } = await adminClient
    .from('clients')
    .insert({
      user_id: newUserId,
      coach_id: user.id,
      goal: goal || null,
      start_date: startDate || null,
      plan_end: planEnd || null,
      owed: 0,
      paid: 0,
    })
    .select('id')
    .single()

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 })
  }

  // Create an initial plan if owed amount was provided
  if (owed && parseFloat(owed) > 0 && newClientRecord) {
    await adminClient
      .from('plans')
      .insert({
        client_id: newClientRecord.id,
        start_date: startDate || new Date().toISOString().split('T')[0],
        end_date: planEnd || null,
        goal: goal || null,
        owed: parseFloat(owed),
        paid: 0,
        status: 'active',
      })
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
