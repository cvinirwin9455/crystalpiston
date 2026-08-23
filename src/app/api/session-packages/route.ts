import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOrgIdForUser } from '@/lib/org'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/session-packages - List packages (optionally filtered by client_id)
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const adminClient = await getAdminClient()
  const { searchParams } = new URL(request.url)

  // Client: see their own packages
  if (profile?.role === 'client') {
    const { data: clientRecord } = await adminClient
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!clientRecord) {
      return NextResponse.json({ packages: [], balance: null })
    }

    const { data: packages } = await adminClient
      .from('session_packages')
      .select('*')
      .eq('client_id', clientRecord.id)
      .order('purchased_at', { ascending: false })

    // Also fetch their balance from the view
    const { data: balance } = await adminClient
      .from('client_session_balances')
      .select('*')
      .eq('client_id', clientRecord.id)
      .single()

    return NextResponse.json({ packages: packages || [], balance })
  }

  // Admin/coach
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = await getOrgIdForUser(adminClient, user.id)
  const clientId = searchParams.get('client_id')

  let query = adminClient
    .from('session_packages')
    .select('*')
    .order('purchased_at', { ascending: false })

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }
  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data: packages, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If filtering by client, also return their balance
  let balance = null
  if (clientId) {
    const { data: balanceData } = await adminClient
      .from('client_session_balances')
      .select('*')
      .eq('client_id', clientId)
      .single()
    balance = balanceData
  }

  return NextResponse.json({ packages: packages || [], balance })
}

// POST /api/session-packages - Add a new session package for a client
export async function POST(request: Request) {
  const supabase = await createClient()

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

  const adminClient = await getAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)

  const body = await request.json()
  const { client_id, sessions_purchased, amount_paid = 0, notes } = body

  if (!client_id || !sessions_purchased || sessions_purchased < 1) {
    return NextResponse.json({ error: 'client_id and sessions_purchased (>0) are required' }, { status: 400 })
  }

  // Verify client exists
  const { data: client } = await adminClient
    .from('clients')
    .select('id')
    .eq('id', client_id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const { data: pkg, error } = await adminClient
    .from('session_packages')
    .insert({
      client_id,
      organization_id: orgId,
      coach_id: user.id,
      sessions_purchased,
      amount_paid,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return the updated balance along with the new package
  const { data: balance } = await adminClient
    .from('client_session_balances')
    .select('*')
    .eq('client_id', client_id)
    .single()

  return NextResponse.json({ package: pkg, balance }, { status: 201 })
}
