import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/weeks?client_id=xxx - Get all weeks for a client
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  if (!clientId) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  // Use service role to bypass RLS for admin reads
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Fetch weeks
  const { data: weeks, error: weeksError } = await adminClient
    .from('weeks')
    .select('id, client_id, date_range, focus, coach_message, status, created_at')
    .eq('client_id', clientId)
    .order('date_range', { ascending: true })

  if (weeksError) {
    return NextResponse.json({ error: weeksError.message }, { status: 500 })
  }

  if (!weeks || weeks.length === 0) {
    return NextResponse.json([])
  }

  // Fetch all workouts for these weeks
  const weekIds = weeks.map(w => w.id)
  const { data: workouts } = await adminClient
    .from('workouts')
    .select('id, week_id, day, type, training_type, title, miles, description, pace_target, location, coach_notes, sort_order, distance_unit')
    .in('week_id', weekIds)
    .order('sort_order', { ascending: true })

  // Fetch all workout logs
  const workoutIds = (workouts || []).map(wo => wo.id)
  let logs: any[] = []
  if (workoutIds.length > 0) {
    const { data: logsData } = await adminClient
      .from('workout_logs')
      .select('id, workout_id, status, skip_reason, rpe, actual_miles, actual_pace, stress, notes, on_period, duration, energy, motivation, sleep, strength, recovery, mood, hunger')
      .in('workout_id', workoutIds)
    logs = logsData || []
  }

  // Build lookup maps
  const logsByWorkoutId = new Map<string, any>()
  for (const log of logs) {
    logsByWorkoutId.set(log.workout_id, log)
  }

  const workoutsByWeekId = new Map<string, any[]>()
  for (const wo of workouts || []) {
    if (!workoutsByWeekId.has(wo.week_id)) {
      workoutsByWeekId.set(wo.week_id, [])
    }
    workoutsByWeekId.get(wo.week_id)!.push(wo)
  }

  // Fetch client-added workouts for these weeks (admin uses service role to bypass RLS)
  let clientWorkoutsByWeekId = new Map<string, any[]>()
  if (weekIds.length > 0) {
    try {
      const { data: clientWorkouts } = await adminClient
        .from('client_workouts')
        .select('id, week_id, day, type, training_type, miles, notes, created_at, completed, completed_notes, source, strava_activity_id, duration, average_pace, activity_name')
        .in('week_id', weekIds)
        .order('created_at', { ascending: true })
      
      for (const cw of clientWorkouts || []) {
        if (!clientWorkoutsByWeekId.has(cw.week_id)) {
          clientWorkoutsByWeekId.set(cw.week_id, [])
        }
        clientWorkoutsByWeekId.get(cw.week_id)!.push(cw)
      }
    } catch (err) {
      // Table might not exist yet if migration hasn't been run
      console.error('Failed to fetch client workouts (table may not exist):', err)
    }
  }

  // Format response
  const formatted = weeks.map(w => {
    const weekWorkouts = workoutsByWeekId.get(w.id) || []
    const weekClientWorkouts = clientWorkoutsByWeekId.get(w.id) || []
    return {
      weekId: w.id,
      clientId: w.client_id,
      dateRange: w.date_range,
      focus: w.focus,
      coachMessage: w.coach_message,
      status: w.status,
      createdAt: w.created_at,
      clientWorkouts: weekClientWorkouts.map(cw => ({
        id: cw.id,
        day: cw.day,
        type: cw.type,
        trainingType: cw.training_type,
        miles: cw.miles ? parseFloat(cw.miles) : null,
        notes: cw.notes,
        createdAt: cw.created_at,
        isClientAdded: true,
        source: cw.source || 'manual',
        stravaActivityId: cw.strava_activity_id || null,
        duration: cw.duration || null,
        averagePace: cw.average_pace || null,
        activityName: cw.activity_name || null,
      })),
      workouts: weekWorkouts.map(wo => {
        const log = logsByWorkoutId.get(wo.id)
        return {
          id: wo.id,
          day: wo.day,
          type: wo.type,
          trainingType: wo.training_type,
          title: wo.title,
          miles: wo.miles ? parseFloat(wo.miles) : null,
          distanceUnit: wo.distance_unit || 'mi',
          description: wo.description,
          paceTarget: wo.pace_target,
          location: wo.location,
          coachNotes: wo.coach_notes,
          sortOrder: wo.sort_order,
          completed: !!log,
          status: log?.status || null,
          skipReason: log?.skip_reason || null,
          log: log ? {
            rpe: log.rpe?.toString() || '',
            stress: log.stress?.toString() || '',
            notes: log.notes || '',
            energy: log.energy?.toString() || '',
            motivation: log.motivation?.toString() || '',
            sleep: log.sleep?.toString() || '',
            strength: log.strength?.toString() || '',
            recovery: log.recovery?.toString() || '',
            mood: log.mood?.toString() || '',
            hunger: log.hunger?.toString() || '',
            actualMiles: log.actual_miles?.toString() || '',
            actualPace: log.actual_pace || '',
            onPeriod: log.on_period ? 'yes' : 'no',
            duration: log.duration || '',
          } : undefined,
        }
      }),
    }
  })

  return NextResponse.json(formatted)
}

// POST /api/weeks - Create a new week with workouts
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

  // Use service role for DB writes to bypass RLS
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const body = await request.json()
  const { clientId, dateRange, focus, coachMessage, status, workouts } = body

  if (!clientId || !dateRange) {
    return NextResponse.json({ error: 'clientId and dateRange are required' }, { status: 400 })
  }

  // Create the week
  const { data: week, error: weekError } = await adminClient
    .from('weeks')
    .insert({
      client_id: clientId,
      date_range: dateRange,
      focus: focus || null,
      coach_message: coachMessage || null,
      status: status || 'draft',
    })
    .select()
    .single()

  if (weekError) {
    return NextResponse.json({ error: weekError.message }, { status: 500 })
  }

  // Create workouts if provided
  if (workouts && workouts.length > 0) {
    const workoutRows = workouts.map((w: any, index: number) => ({
      week_id: week.id,
      day: w.day,
      type: w.type || 'run',
      training_type: w.trainingType || null,
      title: w.title || null,
      miles: w.miles ? parseFloat(w.miles) : null,
      description: w.description || null,
      pace_target: w.paceTarget || null,
      location: w.location || null,
      coach_notes: w.coachNotes || null,
      sort_order: index,
      distance_unit: w.distanceUnit || 'mi',
    }))

    const { error: workoutsError } = await adminClient
      .from('workouts')
      .insert(workoutRows)

    if (workoutsError) {
      return NextResponse.json({ error: workoutsError.message }, { status: 500 })
    }
  }

  // If week is published immediately, notify the client
  if (status === 'published') {
    try {
      // Get the client's user_id
      const { data: client } = await adminClient
        .from('clients')
        .select('user_id')
        .eq('id', clientId)
        .single()

      if (client) {
        // Re-link orphaned Strava activities that were imported before this week was published
        try {
          const { relinkOrphanedStravaActivities } = await import('@/lib/strava-relink')
          const relinkResult = await relinkOrphanedStravaActivities(adminClient, client.user_id, week.id, dateRange)
          if (relinkResult.linked > 0) {
            console.log(`Re-linked ${relinkResult.linked} orphaned Strava activities to new week ${week.id} (${relinkResult.matched} matched)`)
          }
        } catch (relinkErr) {
          console.error('Failed to re-link orphaned Strava activities:', relinkErr)
        }

        // Check notification preferences
        const { data: notifPrefs } = await adminClient
          .from('notification_preferences')
          .select('plan_published')
          .eq('user_id', client.user_id)
          .single()

        const shouldNotify = notifPrefs ? notifPrefs.plan_published : true

        if (shouldNotify) {
          const { data: clientUser } = await adminClient
            .from('users')
            .select('email, name')
            .eq('id', client.user_id)
            .single()

          if (clientUser?.email) {
            const { sendEmail, buildPlanPublishedEmail } = await import('@/lib/email')
            const url = new URL(request.url)
            const siteUrl = `${url.protocol}//${url.host}`
            const emailContent = buildPlanPublishedEmail(
              clientUser.name || 'there',
              dateRange,
              focus || '',
              siteUrl
            )
            sendEmail({ to: clientUser.email, ...emailContent }).catch(console.error)
          }
        }
      }
    } catch (notifErr) {
      console.error('Failed to send publish notification:', notifErr)
    }
  }

  return NextResponse.json({ success: true, weekId: week.id })
}
