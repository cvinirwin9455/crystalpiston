import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getValidAccessToken,
  getStravaActivity,
  mapStravaTypeToWorkoutType,
  mapStravaTypeToTrainingType,
  metersToMiles,
  secondsToMilePace,
  secondsToDuration,
  getVerifyToken,
} from '@/lib/strava'
import { findBestMatch } from '@/lib/strava-matching'
import type { MatchCandidate } from '@/lib/strava-matching'

// POST /api/strava/activities - Process a Strava activity (called from webhook handler)
export async function POST(request: Request) {
  // Verify internal call
  const webhookSecret = request.headers.get('X-Strava-Webhook-Secret')
  if (webhookSecret !== getVerifyToken()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { athleteId, activityId, aspectType } = body

  if (!athleteId || !activityId) {
    return NextResponse.json({ error: 'Missing athleteId or activityId' }, { status: 400 })
  }

  // Use service role
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    // Find the Strava connection for this athlete
    const { data: connection, error: connError } = await adminClient
      .from('strava_connections')
      .select('*')
      .eq('strava_athlete_id', athleteId)
      .single()

    if (connError || !connection) {
      console.log(`No Strava connection found for athlete ${athleteId}`)
      return NextResponse.json({ skipped: true, reason: 'No connection found' })
    }

    // Check if we already processed this activity
    const { data: existing } = await adminClient
      .from('strava_activities')
      .select('id')
      .eq('strava_activity_id', activityId)
      .single()

    if (existing && aspectType === 'create') {
      console.log(`Activity ${activityId} already processed`)
      return NextResponse.json({ skipped: true, reason: 'Already processed' })
    }

    // Get a valid access token (refreshing if needed)
    const accessToken = await getValidAccessToken(connection, adminClient)

    // Fetch the full activity from Strava
    const activity = await getStravaActivity(accessToken, activityId)

    // Map activity data
    const workoutType = mapStravaTypeToWorkoutType(activity.type)
    const trainingType = mapStravaTypeToTrainingType(activity.type, activity.workout_type || null)
    const miles = metersToMiles(activity.distance)
    const pace = secondsToMilePace(activity.moving_time, activity.distance)
    const duration = secondsToDuration(activity.moving_time)

    // Determine which day of the week this activity was on
    const activityDate = new Date(activity.start_date_local)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayOfWeek = days[activityDate.getDay()]

    // Find the published week for this client
    const { data: client } = await adminClient
      .from('clients')
      .select('id')
      .eq('user_id', connection.user_id)
      .single()

    let weekId: string | null = null
    let suggestedMatchId: string | null = null
    let suggestedMatchType: string | null = null
    let matchConfidence: number = 0

    if (client) {
      // Find the week that contains this activity date
      const { data: weeks } = await adminClient
        .from('weeks')
        .select('id, date_range')
        .eq('client_id', client.id)
        .eq('status', 'published')

      if (weeks) {
        const activityMonday = getMonday(activityDate)
        for (const week of weeks) {
          const weekStartStr = week.date_range.split(' - ')[0]
          const weekStart = new Date(weekStartStr + ', ' + activityDate.getFullYear())
          const diffDays = Math.abs(Math.round((weekStart.getTime() - activityMonday.getTime()) / (1000 * 60 * 60 * 24)))
          if (diffDays <= 1) {
            weekId = week.id
            break
          }
        }
      }

      // Smart matching: find programmed workouts and client workouts for this week/day
      if (weekId) {
        // Get programmed workouts for this week
        const { data: programmedWorkouts } = await adminClient
          .from('workouts')
          .select('id, day, type, training_type, title, miles')
          .eq('week_id', weekId)

        // Get existing workout logs to know which are already completed
        const workoutIds = (programmedWorkouts || []).map(w => w.id)
        let completedIds: string[] = []
        if (workoutIds.length > 0) {
          const { data: logs } = await adminClient
            .from('workout_logs')
            .select('workout_id')
            .in('workout_id', workoutIds)
          completedIds = (logs || []).map(l => l.workout_id)
        }

        // Get client-added workouts (non-strava) that aren't completed
        const { data: clientWorkouts } = await adminClient
          .from('client_workouts')
          .select('id, day, type, training_type, miles, notes')
          .eq('week_id', weekId)
          .eq('user_id', connection.user_id)
          .is('source', null)

        // Also check source = 'manual'
        const { data: clientWorkoutsManual } = await adminClient
          .from('client_workouts')
          .select('id, day, type, training_type, miles, notes')
          .eq('week_id', weekId)
          .eq('user_id', connection.user_id)
          .eq('source', 'manual')

        // Check for strava activities already matched to workouts in this week
        const { data: existingMatches } = await adminClient
          .from('strava_activities')
          .select('matched_workout_id')
          .eq('user_id', connection.user_id)
          .eq('week_id', weekId)
          .not('matched_workout_id', 'is', null)
        const alreadyMatchedIds = (existingMatches || []).map(m => m.matched_workout_id).filter(Boolean)

        // Build candidate list
        const candidates: MatchCandidate[] = [
          ...(programmedWorkouts || [])
            .filter(w => w.type !== 'rest')
            .filter(w => !alreadyMatchedIds.includes(w.id))
            .map(w => ({
              id: w.id,
              type: 'programmed' as const,
              day: w.day,
              workoutType: w.type,
              trainingType: w.training_type || null,
              miles: w.miles ? parseFloat(w.miles) : null,
              title: w.title || null,
              completed: completedIds.includes(w.id),
            })),
          ...([...(clientWorkouts || []), ...(clientWorkoutsManual || [])])
            .filter(w => !alreadyMatchedIds.includes(w.id))
            .map(w => ({
              id: w.id,
              type: 'client' as const,
              day: w.day,
              workoutType: w.type,
              trainingType: w.training_type || null,
              miles: w.miles ? parseFloat(w.miles) : null,
              title: w.notes || null,
              completed: false,
            })),
        ]

        // Find best match
        const matchResult = findBestMatch(
          workoutType,
          miles,
          duration,
          dayOfWeek,
          trainingType,
          candidates
        )

        if (matchResult.candidateId && matchResult.confidence >= 50) {
          suggestedMatchId = matchResult.candidateId
          suggestedMatchType = matchResult.candidateType
          matchConfidence = matchResult.confidence
        }
      }
    }

    // Store the strava activity with suggested match
    const activityData = {
      user_id: connection.user_id,
      strava_activity_id: activityId,
      week_id: weekId,
      day: dayOfWeek,
      type: workoutType,
      training_type: trainingType,
      miles,
      duration,
      average_pace: pace,
      activity_name: activity.name,
      strava_type: activity.type,
      moving_time_seconds: activity.moving_time,
      distance_meters: activity.distance,
      start_date: activity.start_date,
      match_status: suggestedMatchId ? 'suggested' : 'pending',
      matched_workout_id: suggestedMatchId,
    }

    if (existing) {
      await adminClient
        .from('strava_activities')
        .update(activityData)
        .eq('id', existing.id)
    } else {
      const { data: newActivity, error: insertError } = await adminClient
        .from('strava_activities')
        .insert(activityData)
        .select('id')
        .single()

      if (insertError) {
        console.error('Failed to insert strava activity:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      // Create a client_workouts entry so it shows on dashboard (with pending match info)
      if (weekId && newActivity) {
        await adminClient
          .from('client_workouts')
          .insert({
            user_id: connection.user_id,
            week_id: weekId,
            day: dayOfWeek,
            type: workoutType,
            training_type: trainingType,
            miles,
            notes: activity.name,
            source: 'strava',
            strava_activity_id: newActivity.id,
            duration,
            average_pace: pace,
            activity_name: activity.name,
          })
      }
    }

    console.log(`Processed Strava activity ${activityId} for user ${connection.user_id}: ${activity.name} (${workoutType}, ${miles} mi, ${duration}) — match: ${suggestedMatchId ? `suggested (${matchConfidence}%)` : 'none'}`)

    return NextResponse.json({ success: true, activityId, type: workoutType, miles, duration, suggestedMatch: suggestedMatchId, matchConfidence })
  } catch (err: any) {
    console.error('Failed to process Strava activity:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/strava/activities - Get Strava activities for the logged-in user (for dashboard)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const weekId = searchParams.get('week_id')

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let query = adminClient
    .from('strava_activities')
    .select('*')
    .eq('user_id', user.id)
    .order('start_date', { ascending: false })

  if (weekId) {
    query = query.eq('week_id', weekId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}

// PATCH /api/strava/activities - Confirm or reject a match
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { stravaActivityId, action, matchedWorkoutId, matchedWorkoutType } = body
  // action: 'confirm' | 'reject' | 'add_standalone' | 'dismiss'

  if (!stravaActivityId || !action) {
    return NextResponse.json({ error: 'stravaActivityId and action are required' }, { status: 400 })
  }

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get the strava activity
  const { data: stravaAct } = await adminClient
    .from('strava_activities')
    .select('*')
    .eq('id', stravaActivityId)
    .eq('user_id', user.id)
    .single()

  if (!stravaAct) {
    return NextResponse.json({ error: 'Strava activity not found' }, { status: 404 })
  }

  if (action === 'confirm') {
    // User confirmed the suggested match
    const workoutId = matchedWorkoutId || stravaAct.matched_workout_id
    const workoutType = matchedWorkoutType || 'programmed'

    if (!workoutId) {
      return NextResponse.json({ error: 'No workout to match to' }, { status: 400 })
    }

    // Update strava activity status
    await adminClient
      .from('strava_activities')
      .update({ match_status: 'matched', matched_workout_id: workoutId })
      .eq('id', stravaActivityId)

    if (workoutType === 'programmed') {
      // Create/upsert a workout log for the programmed workout
      const { data: existingLog } = await adminClient
        .from('workout_logs')
        .select('id')
        .eq('workout_id', workoutId)
        .single()

      const logData = {
        workout_id: workoutId,
        status: 'complete',
        actual_miles: stravaAct.miles,
        actual_pace: stravaAct.average_pace,
        duration: stravaAct.duration,
        notes: `Synced from Strava: ${stravaAct.activity_name}`,
      }

      if (existingLog) {
        await adminClient.from('workout_logs').update(logData).eq('id', existingLog.id)
      } else {
        await adminClient.from('workout_logs').insert(logData)
      }
    }

    // Remove the standalone client_workouts entry (it's now matched)
    await adminClient
      .from('client_workouts')
      .delete()
      .eq('strava_activity_id', stravaActivityId)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, action: 'matched' })

  } else if (action === 'reject') {
    // User rejected the suggested match — keep as pending, clear suggestion
    await adminClient
      .from('strava_activities')
      .update({ match_status: 'pending', matched_workout_id: null })
      .eq('id', stravaActivityId)

    return NextResponse.json({ success: true, action: 'rejected' })

  } else if (action === 'add_standalone') {
    // User wants to keep it as a separate workout
    await adminClient
      .from('strava_activities')
      .update({ match_status: 'standalone', matched_workout_id: null })
      .eq('id', stravaActivityId)

    return NextResponse.json({ success: true, action: 'standalone' })

  } else if (action === 'dismiss') {
    // User doesn't want to import this activity at all
    // Remove the client_workouts entry
    await adminClient
      .from('client_workouts')
      .delete()
      .eq('strava_activity_id', stravaActivityId)
      .eq('user_id', user.id)

    // Mark as dismissed
    await adminClient
      .from('strava_activities')
      .update({ match_status: 'dismissed' })
      .eq('id', stravaActivityId)

    return NextResponse.json({ success: true, action: 'dismissed' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// Helper: get Monday of a given date
function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}
