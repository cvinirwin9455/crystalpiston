import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOrgIdForUser } from '@/lib/org'

// Helper: create admin client with service role key
async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/cycle-tracking - Get cycle tracking status for a client
// Query param: ?client_id=xxx (for coach) or no param (for client viewing own status)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  const adminClient = await createAdminClient()

  if (clientId) {
    // Coach is querying a specific client
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: client } = await adminClient
      .from('clients')
      .select('cycle_tracking_requested, cycle_tracking_consented')
      .eq('id', clientId)
      .single()

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json({
      requested: client.cycle_tracking_requested || false,
      consented: client.cycle_tracking_consented,
    })
  }

  // Client is querying their own status
  const { data: clientRecord } = await adminClient
    .from('clients')
    .select('cycle_tracking_requested, cycle_tracking_consented')
    .eq('user_id', user.id)
    .single()

  if (!clientRecord) {
    return NextResponse.json({ requested: false, consented: null })
  }

  return NextResponse.json({
    requested: clientRecord.cycle_tracking_requested || false,
    consented: clientRecord.cycle_tracking_consented,
  })
}

// PUT /api/cycle-tracking - Update cycle tracking settings
// Body: { clientId, requested } (coach sets requested)
// Body: { consented } (client sets consent)
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const adminClient = await createAdminClient()

  // Coach updating the "requested" flag for a client
  if (body.clientId !== undefined && body.requested !== undefined) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updates: Record<string, any> = {
      cycle_tracking_requested: body.requested,
    }

    // If coach is turning OFF the request, also clear client consent
    if (!body.requested) {
      updates.cycle_tracking_consented = null
    }

    const { error } = await adminClient
      .from('clients')
      .update(updates)
      .eq('id', body.clientId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  // Client updating their own consent
  if (body.consented !== undefined) {
    const { data: clientRecord } = await adminClient
      .from('clients')
      .select('id, cycle_tracking_requested')
      .eq('user_id', user.id)
      .single()

    if (!clientRecord) {
      return NextResponse.json({ error: 'Client record not found' }, { status: 404 })
    }

    // Only allow consent if the coach has requested tracking
    if (!clientRecord.cycle_tracking_requested) {
      return NextResponse.json({ error: 'Cycle tracking has not been requested by your coach' }, { status: 400 })
    }

    const { error } = await adminClient
      .from('clients')
      .update({ cycle_tracking_consented: body.consented })
      .eq('id', clientRecord.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
}
