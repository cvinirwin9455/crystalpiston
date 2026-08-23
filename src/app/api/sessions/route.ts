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

// GET /api/sessions - List sessions (filterable by client, date range, status)
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

  // If client, show only their sessions
  if (profile?.role === 'client') {
    const { data: clientRecord } = await adminClient
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!clientRecord) {
      return NextResponse.json({ sessions: [] })
    }

    const { data: sessions, error } = await adminClient
      .from('sessions')
      .select('*')
      .eq('client_id', clientRecord.id)
      .order('scheduled_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ sessions: sessions || [] })
  }

  // Admin/coach: filter by org, optional client_id, date range, status
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = await getOrgIdForUser(adminClient, user.id)
  const clientId = searchParams.get('client_id')
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')
  const status = searchParams.get('status')

  let query = adminClient
    .from('sessions')
    .select('*')
    .order('scheduled_at', { ascending: true })

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }
  if (clientId) {
    query = query.eq('client_id', clientId)
  }
  if (startDate) {
    query = query.gte('scheduled_at', startDate)
  }
  if (endDate) {
    query = query.lte('scheduled_at', endDate)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data: sessions, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sessions: sessions || [] })
}

// POST /api/sessions - Create a new session
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
  const {
    client_id,
    scheduled_at,
    duration_minutes = 60,
    location,
    session_type,
    notes,
    workout_id,
    recurring_schedule_id,
  } = body

  if (!client_id || !scheduled_at) {
    return NextResponse.json({ error: 'client_id and scheduled_at are required' }, { status: 400 })
  }

  // Verify the client belongs to this org
  const { data: client } = await adminClient
    .from('clients')
    .select('id')
    .eq('id', client_id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const { data: session, error } = await adminClient
    .from('sessions')
    .insert({
      client_id,
      coach_id: user.id,
      organization_id: orgId,
      scheduled_at,
      duration_minutes,
      location: location || null,
      session_type: session_type || null,
      notes: notes || null,
      workout_id: workout_id || null,
      recurring_schedule_id: recurring_schedule_id || null,
      status: 'scheduled',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ session }, { status: 201 })
}
