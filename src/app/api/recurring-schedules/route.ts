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

// GET /api/recurring-schedules?client_id=xxx - Get all recurring schedules for a client
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

  const { data: schedules, error } = await adminClient
    .from('recurring_schedules')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(schedules || [])
}

// POST /api/recurring-schedules - Create a new recurring schedule and auto-generate sessions
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
  const { clientId, daysOfWeek, timeOfDay, durationMinutes, location, sessionType } = body

  if (!clientId || !daysOfWeek || daysOfWeek.length === 0 || !timeOfDay) {
    return NextResponse.json({ error: 'clientId, daysOfWeek (array), and timeOfDay are required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Get client's organization_id
  const { data: client } = await adminClient
    .from('clients')
    .select('organization_id')
    .eq('id', clientId)
    .single()

  const orgId = client?.organization_id || user.id

  // Create the recurring schedule
  const { data: schedule, error } = await adminClient
    .from('recurring_schedules')
    .insert({
      client_id: clientId,
      coach_id: user.id,
      organization_id: orgId,
      days_of_week: daysOfWeek, // array of integers: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
      time_of_day: timeOfDay, // "HH:MM" format
      duration_minutes: durationMinutes || 60,
      location: location || null,
      session_type: sessionType || null,
      active: true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Auto-generate sessions based on remaining session balance
  const generatedCount = await generateSessionsForSchedule(adminClient, schedule, clientId, user.id, orgId)

  return NextResponse.json({ success: true, schedule, generatedSessions: generatedCount })
}

// PATCH /api/recurring-schedules - Update a schedule (pause, edit, etc.)
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
  const { scheduleId, active, daysOfWeek, timeOfDay, durationMinutes, location, sessionType, clearFutureSessions } = body

  if (!scheduleId) {
    return NextResponse.json({ error: 'scheduleId is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  const updates: Record<string, any> = {}
  if (active !== undefined) updates.active = active
  if (daysOfWeek !== undefined) updates.days_of_week = daysOfWeek
  if (timeOfDay !== undefined) updates.time_of_day = timeOfDay
  if (durationMinutes !== undefined) updates.duration_minutes = durationMinutes
  if (location !== undefined) updates.location = location || null
  if (sessionType !== undefined) updates.session_type = sessionType || null

  const { error } = await adminClient
    .from('recurring_schedules')
    .update(updates)
    .eq('id', scheduleId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If deactivating or changing pattern, optionally clear future scheduled sessions
  if (clearFutureSessions) {
    await adminClient
      .from('sessions')
      .delete()
      .eq('recurring_schedule_id', scheduleId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
  }

  // If reactivating or changing pattern, regenerate sessions
  if (active === true || (daysOfWeek && active !== false)) {
    const { data: schedule } = await adminClient
      .from('recurring_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single()

    if (schedule && schedule.active) {
      const { data: client } = await adminClient
        .from('clients')
        .select('organization_id')
        .eq('id', schedule.client_id)
        .single()
      const orgId = client?.organization_id || user.id
      await generateSessionsForSchedule(adminClient, schedule, schedule.client_id, user.id, orgId)
    }
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/recurring-schedules?id=xxx - Delete a schedule and optionally clear future sessions
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
  const scheduleId = searchParams.get('id')
  const clearFuture = searchParams.get('clear_future') === 'true'

  if (!scheduleId) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Optionally delete future scheduled sessions tied to this recurring schedule
  if (clearFuture) {
    await adminClient
      .from('sessions')
      .delete()
      .eq('recurring_schedule_id', scheduleId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
  }

  // Delete the schedule itself
  const { error } = await adminClient
    .from('recurring_schedules')
    .delete()
    .eq('id', scheduleId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// ============================================================
// Helper: Generate sessions for a recurring schedule
// Generates enough sessions to use up remaining session balance
// Skips dates that already have a session (avoid duplicates)
// ============================================================
async function generateSessionsForSchedule(
  adminClient: any,
  schedule: any,
  clientId: string,
  coachId: string,
  orgId: string
): Promise<number> {
  // Get remaining session balance
  const { data: balance } = await adminClient
    .from('client_session_balances')
    .select('sessions_remaining')
    .eq('client_id', clientId)
    .single()

  let sessionsRemaining = balance?.sessions_remaining ?? 0
  if (sessionsRemaining <= 0) return 0

  // Get existing future scheduled sessions count for this client (to subtract from what we should generate)
  const { count: existingFutureCount } = await adminClient
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())

  // We only need to generate enough to fill the remaining balance minus already-scheduled sessions
  const sessionsToGenerate = sessionsRemaining - (existingFutureCount || 0)
  if (sessionsToGenerate <= 0) return 0

  // Get existing session dates to avoid duplicates
  const { data: existingSessions } = await adminClient
    .from('sessions')
    .select('scheduled_at')
    .eq('client_id', clientId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())

  const existingDates = new Set(
    (existingSessions || []).map((s: any) => {
      const d = new Date(s.scheduled_at)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })
  )

  // Generate sessions starting from tomorrow
  const [hours, minutes] = schedule.time_of_day.split(':').map(Number)
  const sessionRows: any[] = []
  const startDate = new Date()
  startDate.setDate(startDate.getDate() + 1) // Start from tomorrow
  startDate.setHours(0, 0, 0, 0)

  let currentDate = new Date(startDate)
  let generated = 0
  const maxLookahead = 365 // Don't look more than a year ahead

  for (let dayOffset = 0; dayOffset < maxLookahead && generated < sessionsToGenerate; dayOffset++) {
    const dayOfWeek = currentDate.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
    
    if (schedule.days_of_week.includes(dayOfWeek)) {
      const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`
      
      if (!existingDates.has(dateKey)) {
        const sessionDate = new Date(currentDate)
        sessionDate.setHours(hours, minutes, 0, 0)

        sessionRows.push({
          client_id: clientId,
          coach_id: coachId,
          organization_id: orgId,
          scheduled_at: sessionDate.toISOString(),
          duration_minutes: schedule.duration_minutes || 60,
          location: schedule.location || null,
          session_type: schedule.session_type || null,
          status: 'scheduled',
          recurring_schedule_id: schedule.id,
        })
        existingDates.add(dateKey) // Prevent duplicates within this generation run
        generated++
      }
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  // Insert in batches of 50
  for (let i = 0; i < sessionRows.length; i += 50) {
    const batch = sessionRows.slice(i, i + 50)
    await adminClient.from('sessions').insert(batch)
  }

  return generated
}
