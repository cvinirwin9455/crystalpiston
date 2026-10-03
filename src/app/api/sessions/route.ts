import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { hasCoachAccess } from '@/lib/roles'
import { resolveCoachRequestScope } from '@/lib/coach-scope'

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
    const end = new Date(now)
    end.setDate(end.getDate() + days)
    end.setHours(23, 59, 59, 999)
    // Note: we intentionally do NOT set a lower bound. Any session that is still
    // 'scheduled' but whose time has already passed ("overdue") hasn't been dealt
    // with by the coach yet, so it must keep showing on the dashboard until they
    // mark it. We fetch every scheduled session up to `end` (overdue + next N days).

    const scopeResult = await resolveCoachRequestScope(
      adminClient,
      user.id,
      searchParams.get('org'),
      searchParams.get('coach')
    )
    if (!scopeResult.scope) {
      return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
    }

    const { organizationId, coachId, effectiveProfile } = scopeResult.scope
    const ownClientsOnly = effectiveProfile.coach_level === 'coach'
      || effectiveProfile.access_level === 'own_clients'

    let allowedClientIds: string[] | null = null
    if (ownClientsOnly) {
      const { data: assignments, error: assignmentsError } = await adminClient
        .from('client_coaches')
        .select('client_id')
        .eq('coach_id', coachId)

      if (assignmentsError) return NextResponse.json([])
      allowedClientIds = (assignments || []).map((assignment: any) => assignment.client_id)
    }

    let sessionQuery = adminClient
      .from('sessions')
      .select('id, client_id, coach_id, organization_id, scheduled_at, duration_minutes, location, session_type, notes, status, recurring_schedule_id')
      .eq('status', 'scheduled')
      .lte('scheduled_at', end.toISOString())
      .order('scheduled_at', { ascending: true })

    if (organizationId) {
      sessionQuery = sessionQuery.eq('organization_id', organizationId)
    } else {
      sessionQuery = sessionQuery.eq('coach_id', coachId)
    }

    const { data: allSessions, error } = await sessionQuery
    if (error) {
      return NextResponse.json([])
    }

    let sessions = allSessions || []
    if (allowedClientIds) {
      const allowedSet = new Set(allowedClientIds)
      sessions = sessions.filter((session: any) => (
        allowedSet.has(session.client_id) || session.coach_id === coachId
      ))
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
    .select('role, has_coach_access')
    .eq('id', user.id)
    .single()

  if (!hasCoachAccess(profile)) {
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
    .select('role, has_coach_access')
    .eq('id', user.id)
    .single()

  if (!hasCoachAccess(profile)) {
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
    .select('role, has_coach_access')
    .eq('id', user.id)
    .single()

  if (!hasCoachAccess(profile)) {
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
