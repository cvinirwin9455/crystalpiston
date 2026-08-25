import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/sessions?client_id=xxx - Get all sessions for a client
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  if (!clientId) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  const { data: sessions, error } = await adminClient
    .from('sessions')
    .select('id, client_id, coach_id, scheduled_at, duration_minutes, location, session_type, notes, status, marked_at, recurring_schedule_id, created_at')
    .eq('client_id', clientId)
    .order('scheduled_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(sessions || [])
}

// POST /api/sessions - Create a new session manually
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { clientId, scheduledAt, durationMinutes, location, sessionType, notes } = body

  if (!clientId || !scheduledAt) {
    return NextResponse.json({ error: 'clientId and scheduledAt are required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Get client's organization_id
  const { data: client } = await adminClient
    .from('clients')
    .select('organization_id')
    .eq('id', clientId)
    .single()

  const orgId = client?.organization_id || user.id

  const { data: session, error } = await adminClient
    .from('sessions')
    .insert({
      client_id: clientId,
      coach_id: user.id,
      organization_id: orgId,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes || 60,
      location: location || null,
      session_type: sessionType || null,
      notes: notes || null,
      status: 'scheduled',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, session })
}

// PATCH /api/sessions - Update a session (status, time, notes, etc.)
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { sessionId, status, scheduledAt, durationMinutes, location, sessionType, notes } = body

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  const updates: Record<string, any> = {}
  if (status !== undefined) {
    updates.status = status
    // Set marked_at when a session is resolved (completed, cancelled, no-show)
    if (['completed', 'cancelled_charged', 'cancelled_no_charge', 'no_show'].includes(status)) {
      updates.marked_at = new Date().toISOString()
    }
  }
  if (scheduledAt !== undefined) updates.scheduled_at = scheduledAt
  if (durationMinutes !== undefined) updates.duration_minutes = durationMinutes
  if (location !== undefined) updates.location = location || null
  if (sessionType !== undefined) updates.session_type = sessionType || null
  if (notes !== undefined) updates.notes = notes || null

  const { error } = await adminClient
    .from('sessions')
    .update(updates)
    .eq('id', sessionId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/sessions?id=xxx - Delete a session
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('id')

  if (!sessionId) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  const { error } = await adminClient
    .from('sessions')
    .delete()
    .eq('id', sessionId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
