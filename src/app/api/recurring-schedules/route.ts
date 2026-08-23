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

// GET /api/recurring-schedules - List recurring schedules (optionally filtered by client_id)
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

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = await getAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const activeOnly = searchParams.get('active') !== 'false' // default: active only

  let query = adminClient
    .from('recurring_schedules')
    .select('*')
    .order('created_at', { ascending: false })

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }
  if (clientId) {
    query = query.eq('client_id', clientId)
  }
  if (activeOnly) {
    query = query.eq('active', true)
  }

  const { data: schedules, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ schedules: schedules || [] })
}

// POST /api/recurring-schedules - Create a new recurring schedule and optionally generate sessions
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
    days_of_week,
    time_of_day,
    duration_minutes = 60,
    location,
    session_type,
    generate_weeks = 4, // How many weeks ahead to auto-generate sessions
  } = body

  // Validate required fields
  if (!client_id || !days_of_week || !Array.isArray(days_of_week) || days_of_week.length === 0 || !time_of_day) {
    return NextResponse.json({ error: 'client_id, days_of_week (array of 0-6), and time_of_day are required' }, { status: 400 })
  }

  // Validate days_of_week values (0=Sunday, 1=Monday, ..., 6=Saturday)
  if (!days_of_week.every((d: number) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    return NextResponse.json({ error: 'days_of_week must contain integers 0-6 (0=Sunday, 6=Saturday)' }, { status: 400 })
  }

  // Validate time format (HH:MM or HH:MM:SS)
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time_of_day)) {
    return NextResponse.json({ error: 'time_of_day must be in HH:MM or HH:MM:SS format' }, { status: 400 })
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

  // Create the recurring schedule
  const { data: schedule, error } = await adminClient
    .from('recurring_schedules')
    .insert({
      client_id,
      coach_id: user.id,
      organization_id: orgId,
      days_of_week,
      time_of_day,
      duration_minutes,
      location: location || null,
      session_type: session_type || null,
      active: true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Auto-generate sessions for the next N weeks
  const generatedSessions: any[] = []
  if (generate_weeks > 0) {
    const now = new Date()
    const endDate = new Date(now)
    endDate.setDate(endDate.getDate() + (generate_weeks * 7))

    const sessionsToCreate: any[] = []
    const current = new Date(now)
    current.setHours(0, 0, 0, 0)

    while (current <= endDate) {
      const dayOfWeek = current.getDay() // 0=Sunday, 6=Saturday
      if (days_of_week.includes(dayOfWeek)) {
        // Build the scheduled_at timestamp
        const [hours, minutes] = time_of_day.split(':').map(Number)
        const scheduledAt = new Date(current)
        scheduledAt.setHours(hours, minutes, 0, 0)

        // Only generate future sessions
        if (scheduledAt > now) {
          sessionsToCreate.push({
            client_id,
            coach_id: user.id,
            organization_id: orgId,
            scheduled_at: scheduledAt.toISOString(),
            duration_minutes,
            location: location || null,
            session_type: session_type || null,
            status: 'scheduled',
            recurring_schedule_id: schedule.id,
          })
        }
      }
      current.setDate(current.getDate() + 1)
    }

    if (sessionsToCreate.length > 0) {
      const { data: created, error: sessError } = await adminClient
        .from('sessions')
        .insert(sessionsToCreate)
        .select()

      if (sessError) {
        // Schedule was created but sessions failed — return partial success
        return NextResponse.json({
          schedule,
          sessions: [],
          warning: `Schedule created but session generation failed: ${sessError.message}`,
        }, { status: 201 })
      }

      generatedSessions.push(...(created || []))
    }
  }

  return NextResponse.json({
    schedule,
    sessions: generatedSessions,
    sessions_generated: generatedSessions.length,
  }, { status: 201 })
}

// PATCH /api/recurring-schedules - Update an existing schedule (pass id in body)
export async function PATCH(request: Request) {
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
  const { id, ...updateFields } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // Verify schedule exists and belongs to org
  const { data: existing } = await adminClient
    .from('recurring_schedules')
    .select('id, organization_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  }

  if (orgId && existing.organization_id !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only allow updating specific fields
  const allowedFields = ['days_of_week', 'time_of_day', 'duration_minutes', 'location', 'session_type', 'active']
  const updates: Record<string, any> = {}
  for (const field of allowedFields) {
    if (updateFields[field] !== undefined) {
      updates[field] = updateFields[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Validate days_of_week if provided
  if (updates.days_of_week) {
    if (!Array.isArray(updates.days_of_week) || updates.days_of_week.length === 0) {
      return NextResponse.json({ error: 'days_of_week must be a non-empty array' }, { status: 400 })
    }
    if (!updates.days_of_week.every((d: number) => Number.isInteger(d) && d >= 0 && d <= 6)) {
      return NextResponse.json({ error: 'days_of_week must contain integers 0-6' }, { status: 400 })
    }
  }

  const { data: schedule, error } = await adminClient
    .from('recurring_schedules')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ schedule })
}

// DELETE /api/recurring-schedules - Deactivate (soft delete) or hard delete a schedule
export async function DELETE(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const hard = searchParams.get('hard') === 'true'
  const cancelFuture = searchParams.get('cancel_future') !== 'false' // default: cancel future sessions

  if (!id) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
  }

  // Verify schedule exists and belongs to org
  const { data: existing } = await adminClient
    .from('recurring_schedules')
    .select('id, organization_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  }

  if (orgId && existing.organization_id !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Optionally cancel all future scheduled sessions from this recurring schedule
  let cancelledCount = 0
  if (cancelFuture) {
    const { data: cancelled } = await adminClient
      .from('sessions')
      .update({ status: 'cancelled_no_charge' })
      .eq('recurring_schedule_id', id)
      .eq('status', 'scheduled')
      .gt('scheduled_at', new Date().toISOString())
      .select('id')

    cancelledCount = cancelled?.length || 0
  }

  if (hard) {
    // Hard delete the schedule entirely
    const { error } = await adminClient
      .from('recurring_schedules')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    // Soft delete: mark as inactive
    const { error } = await adminClient
      .from('recurring_schedules')
      .update({ active: false })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    success: true,
    cancelled_future_sessions: cancelledCount,
  })
}
