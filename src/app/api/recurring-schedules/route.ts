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
// Now supports per-day times: daySchedules = [{ day: 1, time: "06:00" }, { day: 4, time: "08:00" }]
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
  const { clientId, daysOfWeek, timeOfDay, daySchedules, startDate, durationMinutes, location, sessionType } = body

  // Support both old format (daysOfWeek + timeOfDay) and new format (daySchedules with per-day times)
  const resolvedDays: number[] = daySchedules ? daySchedules.map((ds: any) => ds.day) : daysOfWeek
  const resolvedDefaultTime: string = timeOfDay || (daySchedules?.[0]?.time) || '09:00'

  if (!clientId || (!resolvedDays || resolvedDays.length === 0)) {
    return NextResponse.json({ error: 'clientId and days are required' }, { status: 400 })
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
  // Store daySchedules as JSON in day_times for per-day time support
  const dayTimesJson: Record<string, string> = {}
  if (daySchedules) {
    for (const ds of daySchedules) {
      dayTimesJson[String(ds.day)] = ds.time
    }
  }

  const { data: schedule, error } = await adminClient
    .from('recurring_schedules')
    .insert({
      client_id: clientId,
      coach_id: user.id,
      organization_id: orgId,
      days_of_week: resolvedDays,
      time_of_day: resolvedDefaultTime,
      duration_minutes: durationMinutes || 60,
      location: location || null,
      session_type: sessionType || null,
      active: true,
      day_times: Object.keys(dayTimesJson).length > 0 ? dayTimesJson : null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Auto-generate sessions based on remaining session balance
  // Build per-day time map
  const dayTimeMap: Record<number, string> = {}
  if (daySchedules) {
    for (const ds of daySchedules) {
      dayTimeMap[ds.day] = ds.time
    }
  }

  const generatedCount = await generateSessionsForSchedule(adminClient, schedule, clientId, user.id, orgId, dayTimeMap, startDate)

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
  const { scheduleId, active, daysOfWeek, daySchedules, timeOfDay, durationMinutes, location, sessionType, clearFutureSessions } = body

  if (!scheduleId) {
    return NextResponse.json({ error: 'scheduleId is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  const updates: Record<string, any> = {}
  if (active !== undefined) updates.active = active
  if (daysOfWeek !== undefined) updates.days_of_week = daysOfWeek
  if (daySchedules) {
    updates.days_of_week = daySchedules.map((ds: any) => ds.day)
    const dayTimesJson: Record<string, string> = {}
    for (const ds of daySchedules) {
      dayTimesJson[String(ds.day)] = ds.time
    }
    updates.day_times = dayTimesJson
  }
  if (timeOfDay !== undefined) updates.time_of_day = timeOfDay
  if (daySchedules && daySchedules.length > 0) updates.time_of_day = daySchedules[0].time
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
  if (active === true || (daySchedules && active !== false) || (daysOfWeek && active !== false)) {
    const { data: schedule } = await adminClient
      .from('recurring_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single()

    if (schedule && schedule.active) {
      const { data: clientRow } = await adminClient
        .from('clients')
        .select('organization_id')
        .eq('id', schedule.client_id)
        .single()
      const orgId = clientRow?.organization_id || user.id

      // Build per-day time map from daySchedules
      const dayTimeMap: Record<number, string> = {}
      if (daySchedules) {
        for (const ds of daySchedules) {
          dayTimeMap[ds.day] = ds.time
        }
      }

      await generateSessionsForSchedule(adminClient, schedule, schedule.client_id, user.id, orgId, dayTimeMap)
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
// Supports per-day times via dayTimeMap
// ============================================================
async function generateSessionsForSchedule(
  adminClient: any,
  schedule: any,
  clientId: string,
  coachId: string,
  orgId: string,
  dayTimeMap?: Record<number, string>,
  startDate?: string
): Promise<number> {
  // Get remaining session balance — try the view first, fallback to manual calc
  let sessionsRemaining = 0
  const { data: balance, error: balanceErr } = await adminClient
    .from('client_session_balances')
    .select('sessions_remaining')
    .eq('client_id', clientId)
    .single()

  if (!balanceErr && balance) {
    sessionsRemaining = balance.sessions_remaining ?? 0
  } else {
    // Fallback: calculate manually
    const { data: packages } = await adminClient
      .from('session_packages')
      .select('sessions_purchased')
      .eq('client_id', clientId)
    const totalPurchased = (packages || []).reduce((sum: number, p: any) => sum + (p.sessions_purchased || 0), 0)
    
    const { count: usedCount } = await adminClient
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .in('status', ['completed', 'cancelled_charged', 'no_show'])
    
    sessionsRemaining = totalPurchased - (usedCount || 0)
  }

  if (sessionsRemaining <= 0) return 0

  // Get existing future scheduled sessions count for this client
  const { count: existingFutureCount } = await adminClient
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())

  // Only generate enough to fill remaining balance minus already-scheduled
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
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
  )

  // Default time from schedule (format: "HH:MM:SS" or "HH:MM")
  const defaultTime = schedule.time_of_day ? schedule.time_of_day.slice(0, 5) : '09:00'

  // Generate sessions starting from startDate (or tomorrow if not provided)
  const sessionRows: any[] = []
  
  // Parse start date carefully - use date parts to avoid timezone issues
  let startYear: number, startMonth: number, startDay: number
  if (startDate) {
    const parts = startDate.split('-')
    startYear = parseInt(parts[0])
    startMonth = parseInt(parts[1]) - 1 // 0-indexed
    startDay = parseInt(parts[2])
  } else {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    startYear = tomorrow.getFullYear()
    startMonth = tomorrow.getMonth()
    startDay = tomorrow.getDate()
  }

  let generated = 0
  const maxLookahead = 365

  for (let dayOffset = 0; dayOffset < maxLookahead && generated < sessionsToGenerate; dayOffset++) {
    // Create date from year/month/day + offset to avoid timezone issues
    const currentDate = new Date(startYear, startMonth, startDay + dayOffset, 12, 0, 0)
    
    const dayOfWeek = currentDate.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
    
    if (schedule.days_of_week.includes(dayOfWeek)) {
      const year = currentDate.getFullYear()
      const month = String(currentDate.getMonth() + 1).padStart(2, '0')
      const day = String(currentDate.getDate()).padStart(2, '0')
      const dateKey = `${year}-${month}-${day}`
      
      if (!existingDates.has(dateKey)) {
        // Get time for this specific day (per-day override or default)
        const timeForDay = dayTimeMap?.[dayOfWeek] || defaultTime
        const [hours, minutes] = timeForDay.split(':').map(Number)
        
        // Build the scheduled_at as a proper date-time string
        const h = String(hours).padStart(2, '0')
        const m = String(minutes).padStart(2, '0')
        const scheduledAt = `${year}-${month}-${day}T${h}:${m}:00`

        sessionRows.push({
          client_id: clientId,
          coach_id: coachId,
          organization_id: orgId,
          scheduled_at: scheduledAt,
          duration_minutes: schedule.duration_minutes || 60,
          location: schedule.location || null,
          session_type: schedule.session_type || null,
          status: 'scheduled',
          recurring_schedule_id: schedule.id,
        })
        existingDates.add(dateKey)
        generated++
      }
    }
  }

  // Insert in batches of 50
  for (let i = 0; i < sessionRows.length; i += 50) {
    const batch = sessionRows.slice(i, i + 50)
    await adminClient.from('sessions').insert(batch)
  }

  return generated
}
