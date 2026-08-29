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

// GET /api/sessions
//   ?client_id=xxx  -> all sessions for one client
//   ?upcoming=true  -> scheduled sessions across ALL the coach's clients for the next 7 days
//                      (enriched with client name), grouped/sorted ascending
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const upcoming = searchParams.get('upcoming') === 'true'

  const adminClient = await getAdminClient()

  // ---- Upcoming (dashboard) mode: next 7 days across all the coach's clients ----
  if (upcoming) {
    const days = parseInt(searchParams.get('days') || '7')
    const now = new Date()
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setDate(end.getDate() + days)
    end.setHours(23, 59, 59, 999)

    const { data: profile } = await adminClient
      .from('users')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    // Determine which client IDs this coach can see:
    // - org owners / account coaches: all clients in their org
    // - otherwise: clients assigned to this coach (client_coaches) + sessions they coach
    let allowedClientIds: string[] | null = null
    try {
      // Clients assigned to this coach
      const { data: assignments } = await adminClient
        .from('client_coaches')
        .select('client_id')
        .eq('coach_id', user.id)
      const assignedIds = (assignments || []).map((a: any) => a.client_id)

      // Also include clients in the coach's org (if org set)
      let orgClientIds: string[] = []
      if (profile?.organization_id) {
        const { data: orgClients } = await adminClient
          .from('clients')
          .select('id')
          .eq('organization_id', profile.organization_id)
        orgClientIds = (orgClients || []).map((c: any) => c.id)
      }
      allowedClientIds = [...new Set([...assignedIds, ...orgClientIds])]
    } catch {
      allowedClientIds = null
    }

    let sessionQuery = adminClient
      .from('sessions')
      .select('id, client_id, coach_id, organization_id, scheduled_at, duration_minutes, location, session_type, notes, status, recurring_schedule_id')
      .eq('status', 'scheduled')
      .gte('scheduled_at', start.toISOString())
      .lte('scheduled_at', end.toISOString())
      .order('scheduled_at', { ascending: true })

    // Prefer scoping by allowed clients; if we couldn't compute that, fall back to coach_id
    const { data: allSessions, error } = await sessionQuery
    if (error) {
      return NextResponse.json([])
    }

    let sessions = allSessions || []
    if (allowedClientIds && allowedClientIds.length > 0) {
      const allowedSet = new Set(allowedClientIds)
      sessions = sessions.filter((s: any) => allowedSet.has(s.client_id) || s.coach_id === user.id)
    } else {
      sessions = sessions.filter((s: any) => s.coach_id === user.id)
    }

    if (sessions.length === 0) return NextResponse.json([])

    // Enrich with client names
    const clientIds = [...new Set(sessions.map((s: any) => s.client_id))]
    const { data: clientRows } = await adminClient
      .from('clients')
      .select('id, user_id')
      .in('id', clientIds)
    const userIds = (clientRows || []).map((c: any) => c.user_id)
    const { data: userRows } = await adminClient
      .from('users')
      .select('id, name, avatar_url')
      .in('id', userIds)

    const nameByClient: Record<string, string> = {}
    const avatarByClient: Record<string, string | null> = {}
    for (const c of clientRows || []) {
      const u = (userRows || []).find((x: any) => x.id === c.user_id)
      nameByClient[c.id] = u?.name || 'Client'
      avatarByClient[c.id] = u?.avatar_url || null
    }

    const enriched = sessions.map((s: any) => ({
      ...s,
      clientName: nameByClient[s.client_id] || 'Client',
      clientAvatar: avatarByClient[s.client_id] || null,
    }))
    return NextResponse.json(enriched)
  }

  // ---- Single-client mode ----
  if (!clientId) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

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
