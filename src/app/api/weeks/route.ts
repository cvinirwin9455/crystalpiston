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
      .select('id, workout_id, status, skip_reason, rpe, actual_miles, actual_pace, stress, notes, on_period, duration, energy, motivation, sleep, strength, recovery, mood, hunger, avg_heartrate, max_heartrate')
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

  // Fetch strava activities matched to workouts in these weeks
  let stravaMatchedWorkoutIds = new Set<string>()
  let stravaActivityNameByWorkoutId = new Map<string, string>()
  let stravaMatchedActivityIds = new Set<string>()
  if (weekIds.length > 0) {
    const { data: stravaActivities } = await adminClient
      .from('strava_activities')
      .select('id, matched_workout_id, match_status, activity_name, day, type, miles, average_pace, duration, avg_heartrate, max_heartrate, distance_meters, moving_time_seconds')
      .in('week_id', weekIds)

    for (const sa of stravaActivities || []) {
      if (sa.match_status === 'matched' && sa.matched_workout_id) {
        stravaMatchedActivityIds.add(sa.id)
        stravaMatchedWorkoutIds.add(sa.matched_workout_id)
        if (sa.activity_name) {
          stravaActivityNameByWorkoutId.set(sa.matched_workout_id, sa.activity_name)
        }
        // Backfill: if the matched workout's log is missing miles, fill from Strava raw data
        const matchedLog = logsByWorkoutId.get(sa.matched_workout_id)
        if (matchedLog && !matchedLog.actual_miles) {
          const calcMiles = sa.miles || (sa.distance_meters ? +(sa.distance_meters / 1609.344).toFixed(2) : null)
          const calcPace = sa.average_pace || (sa.moving_time_seconds && sa.distance_meters ? (() => {
            const m = sa.distance_meters / 1609.344
            const ps = sa.moving_time_seconds / m
            return `${Math.floor(ps / 60)}:${Math.round(ps % 60).toString().padStart(2, '0')}/mi`
          })() : null)
          const calcDuration = sa.duration || (sa.moving_time_seconds ? (() => {
            const h = Math.floor(sa.moving_time_seconds / 3600)
            const m = Math.round((sa.moving_time_seconds % 3600) / 60)
            return h > 0 ? `${h}h ${m}m` : `${m}m`
          })() : null)
          if (calcMiles) {
            matchedLog.actual_miles = calcMiles
            matchedLog.actual_pace = calcPace || matchedLog.actual_pace
            matchedLog.duration = calcDuration || matchedLog.duration
            matchedLog.avg_heartrate = sa.avg_heartrate || matchedLog.avg_heartrate
            matchedLog.max_heartrate = sa.max_heartrate || matchedLog.max_heartrate
            // Persist to DB (fire-and-forget)
            adminClient.from('workout_logs').update({
              actual_miles: calcMiles,
              actual_pace: calcPace || null,
              duration: calcDuration || null,
              avg_heartrate: sa.avg_heartrate || null,
              max_heartrate: sa.max_heartrate || null,
            }).eq('id', matchedLog.id).then(() => {})
          }
        }
      }
    }

    // Also hide strava extras when there's a completed programmed workout of the same
    // type on the same day — handles legacy data where match wasn't confirmed properly
    for (const sa of stravaActivities || []) {
      if (stravaMatchedActivityIds.has(sa.id)) continue // already handled
      if (sa.match_status === 'dismissed') continue
      // Check if there's a completed programmed workout on the same day with same type
      for (const [, wos] of workoutsByWeekId) {
        for (const wo of wos) {
          if (wo.day === sa.day && wo.type === sa.type && logsByWorkoutId.has(wo.id) && !stravaMatchedWorkoutIds.has(wo.id)) {
            stravaMatchedActivityIds.add(sa.id)
            stravaMatchedWorkoutIds.add(wo.id)
            if (sa.activity_name) {
              stravaActivityNameByWorkoutId.set(wo.id, sa.activity_name)
            }
            // Backfill workout_log with Strava data if log is missing miles/duration
            const existingLog = logsByWorkoutId.get(wo.id)
            // Calculate miles from raw distance_meters if miles field is null
            let backfillMiles = sa.miles || (sa.distance_meters ? +(sa.distance_meters / 1609.344).toFixed(2) : null)
            let backfillPace = sa.average_pace || (sa.moving_time_seconds && sa.distance_meters ? (() => {
              const m = sa.distance_meters / 1609.344
              const ps = sa.moving_time_seconds / m
              return `${Math.floor(ps / 60)}:${Math.round(ps % 60).toString().padStart(2, '0')}/mi`
            })() : null)
            let backfillDuration = sa.duration || (sa.moving_time_seconds ? (() => {
              const h = Math.floor(sa.moving_time_seconds / 3600)
              const m = Math.round((sa.moving_time_seconds % 3600) / 60)
              return h > 0 ? `${h}h ${m}m` : `${m}m`
            })() : null)
            let backfillAvgHr = sa.avg_heartrate
            let backfillMaxHr = sa.max_heartrate
            if (!backfillMiles) {
              // Last resort: check client_workouts entry
              const { data: cwFallback } = await adminClient
                .from('client_workouts')
                .select('miles, average_pace, duration, avg_heartrate, max_heartrate')
                .eq('strava_activity_id', sa.id)
                .single()
              if (cwFallback) {
                backfillMiles = cwFallback.miles ? parseFloat(cwFallback.miles) : null
                backfillPace = backfillPace || cwFallback.average_pace
                backfillDuration = backfillDuration || cwFallback.duration
                backfillAvgHr = backfillAvgHr || cwFallback.avg_heartrate
                backfillMaxHr = backfillMaxHr || cwFallback.max_heartrate
              }
            }
            if (existingLog && !existingLog.actual_miles && backfillMiles) {
              existingLog.actual_miles = backfillMiles
              existingLog.actual_pace = backfillPace || existingLog.actual_pace
              existingLog.duration = backfillDuration || existingLog.duration
              existingLog.avg_heartrate = backfillAvgHr || existingLog.avg_heartrate
              existingLog.max_heartrate = backfillMaxHr || existingLog.max_heartrate
              // Update DB in background (self-healing)
              adminClient.from('workout_logs').update({
                actual_miles: backfillMiles,
                actual_pace: backfillPace || null,
                duration: backfillDuration || null,
                avg_heartrate: backfillAvgHr || null,
                max_heartrate: backfillMaxHr || null,
              }).eq('id', existingLog.id).then(() => {})
              adminClient.from('strava_activities').update({
                match_status: 'matched',
                matched_workout_id: wo.id,
              }).eq('id', sa.id).then(() => {})
              adminClient.from('client_workouts').delete()
                .eq('strava_activity_id', sa.id).then(() => {})
            }
            break
          }
        }
        if (stravaMatchedActivityIds.has(sa.id)) break
      }
    }
  }

  // Fetch client-added workouts for these weeks (admin uses service role to bypass RLS)
  let clientWorkoutsByWeekId = new Map<string, any[]>()
  if (weekIds.length > 0) {
    try {
      const { data: clientWorkouts } = await adminClient
        .from('client_workouts')
        .select('id, week_id, day, type, training_type, miles, notes, created_at, completed, completed_notes, source, strava_activity_id, duration, average_pace, activity_name, avg_heartrate, max_heartrate')
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
      clientWorkouts: weekClientWorkouts
        .filter(cw => {
          // Hide strava client_workouts entries that are already matched to a programmed workout
          // (they show as duplicates otherwise — the data is on the programmed card already)
          if (cw.source === 'strava' && cw.strava_activity_id && stravaMatchedActivityIds.has(cw.strava_activity_id)) {
            return false
          }
          return true
        })
        .map(cw => ({
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
        avgHeartrate: cw.avg_heartrate || null,
        maxHeartrate: cw.max_heartrate || null,
        completed: cw.completed || false,
        completedNotes: cw.completed_notes || null,
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
          stravaSynced: stravaMatchedWorkoutIds.has(wo.id) || !!(log?.avg_heartrate),
          stravaActivityName: stravaActivityNameByWorkoutId.get(wo.id) || (log?.avg_heartrate && log?.notes?.match?.(/(?:Auto-s|S)ynced from Strava: (.+)/)?.[1]) || null,
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
            avgHeartrate: log.avg_heartrate || null,
            maxHeartrate: log.max_heartrate || null,
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
