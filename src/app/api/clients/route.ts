import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

  // Fetch all users with role 'client' joined with their client record
  // Use service role to bypass RLS for admin operations
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: clients, error } = await adminClient
    .from('users')
    .select(`
      id,
      email,
      name,
      gender,
      status,
      avatar_url,
      created_at,
      clients (
        id,
        goal,
        start_date,
        plan_end,
        owed,
        paid
      )
    `)
    .eq('role', 'client')
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Flatten the response for easier frontend use
  // Auto-create clients records for any users missing one (using service role to bypass RLS)
  const formatted = []
  for (const c of clients || []) {
    let clientId = c.clients?.[0]?.id || null

    // If no clients record exists, create one using service role
    if (!clientId) {
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
      const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: newClient, error: insertError } = await adminClient
        .from('clients')
        .insert({ user_id: c.id })
        .select('id')
        .single()
      if (newClient) {
        clientId = newClient.id
      } else {
        console.error('Failed to auto-create client record:', insertError?.message)
      }
    }

    formatted.push({
      userId: c.id,
      clientId,
      name: c.name,
      email: c.email,
      gender: c.gender,
      status: c.status,
      avatarUrl: c.avatar_url,
      goal: c.clients?.[0]?.goal || '',
      startDate: c.clients?.[0]?.start_date || '',
      planEnd: c.clients?.[0]?.plan_end || '',
      owed: c.clients?.[0]?.owed || 0,
      paid: c.clients?.[0]?.paid || 0,
      createdAt: c.created_at,
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

  // Use Supabase Admin API to invite user by email
  // This sends them an invite email with a link to set their password
  const supabaseAdmin = await createAdminClient()
  
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
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

  // The trigger will auto-create the users row, but we need to update gender
  if (gender) {
    await supabase
      .from('users')
      .update({ gender })
      .eq('id', newUserId)
  }

  // Create the clients record
  const { error: clientError } = await supabase
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

// Helper: create admin client with service role key
async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
