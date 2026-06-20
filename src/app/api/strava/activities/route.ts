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

    // Find the current published week for this client
    const { data: client } = await adminClient
      .from('clients')
      .select('id')
      .eq('user_id', connection.user_id)
      .single()

    let weekId: string | null = null

    if (client) {
      // Find the week that contains this activity date
      const { data: weeks } = await adminClient
        .from('weeks')
        .select('id, date_range')
        .eq('client_id', client.id)
        .eq('status', 'published')

      if (weeks) {
        // Parse date ranges and find matching week
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
    }

    // Upsert the strava activity record
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
      match_status: 'pending',
    }

    if (existing) {
      // Update existing activity
      await adminClient
        .from('strava_activities')
        .update(activityData)
        .eq('id', existing.id)
    } else {
      // Insert new activity
      const { data: newActivity, error: insertError } = await adminClient
        .from('strava_activities')
        .insert(activityData)
        .select('id')
        .single()

      if (insertError) {
        console.error('Failed to insert strava activity:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      // Also create a client_workouts entry so it shows up on the dashboard immediately
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

    console.log(`Processed Strava activity ${activityId} for user ${connection.user_id}: ${activity.name} (${workoutType}, ${miles} mi, ${duration})`)

    return NextResponse.json({ success: true, activityId, type: workoutType, miles, duration })
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

// PATCH /api/strava/activities - Update match status (client matches to a programmed workout)
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { stravaActivityId, matchStatus, matchedWorkoutId } = body

  if (!stravaActivityId || !matchStatus) {
    return NextResponse.json({ error: 'stravaActivityId and matchStatus are required' }, { status: 400 })
  }

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Update the strava activity match status
  const updateData: any = { match_status: matchStatus }
  if (matchedWorkoutId) {
    updateData.matched_workout_id = matchedWorkoutId
  }

  const { error } = await adminClient
    .from('strava_activities')
    .update(updateData)
    .eq('id', stravaActivityId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If matched to a programmed workout, auto-create a workout log
  if (matchStatus === 'matched' && matchedWorkoutId) {
    // Get the strava activity data
    const { data: stravaAct } = await adminClient
      .from('strava_activities')
      .select('*')
      .eq('id', stravaActivityId)
      .single()

    if (stravaAct) {
      // Create/upsert a workout log for the matched programmed workout
      const { data: existingLog } = await adminClient
        .from('workout_logs')
        .select('id')
        .eq('workout_id', matchedWorkoutId)
        .single()

      const logData = {
        workout_id: matchedWorkoutId,
        status: 'complete',
        actual_miles: stravaAct.miles,
        actual_pace: stravaAct.average_pace,
        duration: stravaAct.duration,
        notes: `Synced from Strava: ${stravaAct.activity_name}`,
      }

      if (existingLog) {
        await adminClient
          .from('workout_logs')
          .update(logData)
          .eq('id', existingLog.id)
      } else {
        await adminClient
          .from('workout_logs')
          .insert(logData)
      }

      // Also remove the client_workouts entry since it's now matched to a programmed workout
      await adminClient
        .from('client_workouts')
        .delete()
        .eq('strava_activity_id', stravaActivityId)
        .eq('user_id', user.id)
    }
  }

  return NextResponse.json({ success: true })
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
