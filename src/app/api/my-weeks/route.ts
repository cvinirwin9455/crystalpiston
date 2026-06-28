import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/my-weeks - Get the logged-in client's published weeks
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service role to bypass RLS
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get the client record for this user
  const { data: client } = await adminClient
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client record not found' }, { status: 404 })
  }

  // Fetch published weeks
  const { data: weeks, error: weeksError } = await adminClient
    .from('weeks')
    .select('id, date_range, focus, coach_message, status, created_at')
    .eq('client_id', client.id)
    .eq('status', 'published')
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
    .select('id, week_id, day, type, training_type, title, miles, description, pace_target, location, coach_notes, sort_order, distance_unit, distance_unit')
    .in('week_id', weekIds)
    .order('sort_order', { ascending: true })

  // Fetch all workout logs for these workouts
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
  let stravaActivitiesByWeek = new Map<string, any[]>()
  let stravaMatchedActivityIds = new Set<string>()
  let allStravaActivities: any[] = []
  if (weekIds.length > 0) {
    const { data: stravaActivities } = await adminClient
      .from('strava_activities')
      .select('id, week_id, day, type, miles, duration, average_pace, activity_name, match_status, matched_workout_id, matched_client_workout_id, distance_meters, moving_time_seconds, avg_heartrate, max_heartrate')
      .eq('user_id', user.id)
      .in('week_id', weekIds)
    
    allStravaActivities = stravaActivities || []
    for (const sa of allStravaActivities) {
      if (sa.match_status === 'matched' && sa.matched_workout_id) {
        stravaMatchedWorkoutIds.add(sa.matched_workout_id)
        stravaMatchedActivityIds.add(sa.id)
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
          }
        }
      }
      if (!stravaActivitiesByWeek.has(sa.week_id)) {
        stravaActivitiesByWeek.set(sa.week_id, [])
      }
      stravaActivitiesByWeek.get(sa.week_id)!.push(sa)
    }

    // Also hide strava extras when there's a completed programmed workout of the same
    // type on the same day — handles legacy data where match wasn't confirmed properly
    for (const sa of allStravaActivities) {
      if (stravaMatchedActivityIds.has(sa.id)) continue
      if (sa.match_status === 'dismissed') continue
      // Skip 0-mile distance-based activities (accidental start/stop) but allow stretching/strength/cross
      const distanceTypes = ['run', 'walk', 'cycling']
      if (distanceTypes.includes(sa.type) && !sa.miles && !sa.distance_meters) continue
      const weekWorkouts = workoutsByWeekId.get(sa.week_id) || []
      for (const wo of weekWorkouts) {
        const woLog = logsByWorkoutId.get(wo.id)
        const isActuallyCompleted = woLog && (woLog.status === 'complete' || (!woLog.status && woLog.rpe))
        if (wo.day === sa.day && wo.type === sa.type && isActuallyCompleted && !stravaMatchedWorkoutIds.has(wo.id)) {
          // Only hide if we can get the Strava data OR the log already has miles
          // Non-distance types (stretching, strength, cross) can always be hidden
          const existingLog = logsByWorkoutId.get(wo.id)
          const isDistType = ['run', 'walk', 'cycling'].includes(sa.type)
          const hasMiles = sa.miles || sa.distance_meters || (existingLog && existingLog.actual_miles)
          if (!isDistType || hasMiles) {
            stravaMatchedActivityIds.add(sa.id)
            stravaMatchedWorkoutIds.add(wo.id)
            if (sa.activity_name) {
              stravaActivityNameByWorkoutId.set(wo.id, sa.activity_name)
            }
            // Backfill if needed — duration/HR for non-distance types, miles for distance types
            if (existingLog && (!existingLog.actual_miles || !existingLog.duration || !existingLog.avg_heartrate)) {
              const calcMiles = sa.miles || (sa.distance_meters ? +(sa.distance_meters / 1609.344).toFixed(2) : null)
              const calcDuration = sa.duration || (sa.moving_time_seconds ? (() => {
                const h = Math.floor(sa.moving_time_seconds / 3600); const m = Math.round((sa.moving_time_seconds % 3600) / 60)
                return h > 0 ? `${h}h ${m}m` : `${m}m`
              })() : null)
              if (calcMiles && !existingLog.actual_miles) {
                existingLog.actual_miles = calcMiles
                existingLog.actual_pace = sa.average_pace || (sa.moving_time_seconds && sa.distance_meters ? (() => {
                  const m = sa.distance_meters / 1609.344; const ps = sa.moving_time_seconds / m
                  return `${Math.floor(ps / 60)}:${Math.round(ps % 60).toString().padStart(2, '0')}/mi`
                })() : null) || existingLog.actual_pace
              }
              if (calcDuration && !existingLog.duration) existingLog.duration = calcDuration
              if (sa.avg_heartrate && !existingLog.avg_heartrate) existingLog.avg_heartrate = sa.avg_heartrate
              if (sa.max_heartrate && !existingLog.max_heartrate) existingLog.max_heartrate = sa.max_heartrate
            }
          }
          break
        }
      }
    }
  }

  // Fetch client-added workouts for these weeks
  let clientWorkoutsByWeekId = new Map<string, any[]>()
  if (weekIds.length > 0) {
    try {
      const { data: clientWorkouts } = await adminClient
        .from('client_workouts')
        .select('id, week_id, day, type, training_type, miles, notes, created_at, completed, completed_notes, source, strava_activity_id, duration, average_pace, activity_name, avg_heartrate, max_heartrate')
        .in('week_id', weekIds)
        .eq('user_id', user.id)
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
      dateRange: w.date_range,
      focus: w.focus || '',
      coachMessage: w.coach_message || '',
      stravaActivities: (stravaActivitiesByWeek.get(w.id) || [])
        .filter(sa => sa.match_status === 'suggested' || sa.match_status === 'pending')
        .map(sa => ({
          id: sa.id,
          day: sa.day,
          type: sa.type,
          miles: sa.miles,
          duration: sa.duration,
          averagePace: sa.average_pace,
          activityName: sa.activity_name,
          matchStatus: sa.match_status,
          suggestedMatchId: sa.matched_workout_id,
          suggestedClientMatchId: sa.matched_client_workout_id || null,
        })),
      clientWorkouts: weekClientWorkouts
        .filter(cw => {
          // Hide strava client_workouts entries that are already matched to a programmed workout
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
        completed: cw.completed || false,
        completedNotes: cw.completed_notes || null,
        source: cw.source || 'manual',
        stravaActivityId: cw.strava_activity_id || null,
        duration: cw.duration || null,
        averagePace: cw.average_pace || null,
        activityName: cw.activity_name || null,
        avgHeartrate: cw.avg_heartrate || null,
        maxHeartrate: cw.max_heartrate || null,
      })),
      workouts: weekWorkouts.map(wo => {
        const log = logsByWorkoutId.get(wo.id)
        // If strava-matched but log has no miles, pull directly from strava_activities
        let stravaFallback: any = null
        if (stravaMatchedWorkoutIds.has(wo.id) && log && !log.actual_miles) {
          stravaFallback = allStravaActivities.find((sa: any) => sa.matched_workout_id === wo.id)
        }
        const stravaMiles = stravaFallback ? (stravaFallback.miles || (stravaFallback.distance_meters ? +(stravaFallback.distance_meters / 1609.344).toFixed(2) : null)) : null
        const stravaPace = stravaFallback ? (stravaFallback.average_pace || (stravaFallback.moving_time_seconds && stravaFallback.distance_meters ? (() => {
          const m = stravaFallback.distance_meters / 1609.344; const ps = stravaFallback.moving_time_seconds / m
          return `${Math.floor(ps / 60)}:${Math.round(ps % 60).toString().padStart(2, '0')}/mi`
        })() : null)) : null
        const stravaDur = stravaFallback ? (stravaFallback.duration || (stravaFallback.moving_time_seconds ? (() => {
          const h = Math.floor(stravaFallback.moving_time_seconds / 3600); const m = Math.round((stravaFallback.moving_time_seconds % 3600) / 60)
          return h > 0 ? `${h}h ${m}m` : `${m}m`
        })() : null)) : null

        return {
          id: wo.id,
          day: wo.day,
          type: wo.type || 'run',
          trainingType: wo.training_type || '',
          title: wo.title || '',
          miles: wo.miles ? parseFloat(wo.miles) : null,
          distanceUnit: wo.distance_unit || 'mi',
          description: wo.description || '',
          paceTarget: wo.pace_target || '',
          location: wo.location || '',
          coachNotes: wo.coach_notes || '',
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
            actualMiles: log.actual_miles?.toString() || (stravaMiles?.toString() || ''),
            actualPace: log.actual_pace || stravaPace || '',
            onPeriod: log.on_period ? 'yes' : 'no',
            duration: log.duration || stravaDur || '',
            avgHeartrate: log.avg_heartrate || stravaFallback?.avg_heartrate || null,
            maxHeartrate: log.max_heartrate || stravaFallback?.max_heartrate || null,
          } : undefined,
        }
      }),
    }
  })

  return NextResponse.json(formatted)
}
