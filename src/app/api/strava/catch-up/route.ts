import { NextResponse } from 'next/server'
import {
  getValidAccessToken,
  mapStravaTypeToWorkoutType,
  mapStravaTypeToTrainingType,
  metersToMiles,
  secondsToMilePace,
  secondsToDuration,
  STRAVA_API_BASE,
} from '@/lib/strava'
import { findBestMatch } from '@/lib/strava-matching'
import type { MatchCandidate } from '@/lib/strava-matching'

// Helper: get Monday of a given date
function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

// POST /api/strava/catch-up - Catch up missed Strava activities for all connected users
// This should be called by a cron job (e.g., every 4 hours) or manually by admin
// Auth: requires a secret header OR admin auth
export async function POST(request: Request) {
  // Verify authorization: either internal cron secret or admin user
  const cronSecret = request.headers.get('x-cron-secret')
  const expectedSecret = process.env.CRON_SECRET || process.env.STRAVA_VERIFY_TOKEN

  let isAuthorized = cronSecret === expectedSecret

  if (!isAuthorized) {
    // Try auth via Supabase session (admin user manually triggering)
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
      const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: profile } = await adminClient
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role === 'admin') isAuthorized = true
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get all active Strava connections
  const { data: connections, error: connError } = await adminClient
    .from('strava_connections')
    .select('*')

  if (connError || !connections || connections.length === 0) {
    return NextResponse.json({ message: 'No Strava connections found', processed: 0 })
  }

  const results: { userId: string; athleteName: string; imported: number; errors: string[] }[] = []

  // Check last 48 hours of activities for each connected user
  const twoDaysAgo = Math.floor((Date.now() - 48 * 60 * 60 * 1000) / 1000)

  for (const connection of connections) {
    const userResult = { userId: connection.user_id, athleteName: connection.athlete_firstname || 'Unknown', imported: 0, errors: [] as string[] }

    try {
      // Get a valid access token (auto-refreshes if expired)
      const accessToken = await getValidAccessToken(connection, adminClient)

      // Fetch recent activities from Strava API
      const activitiesRes = await fetch(
        `${STRAVA_API_BASE}/athlete/activities?after=${twoDaysAgo}&per_page=30`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      )

      if (!activitiesRes.ok) {
        const err = await activitiesRes.text()
        userResult.errors.push(`Failed to fetch activities: ${activitiesRes.status} ${err.slice(0, 100)}`)
        results.push(userResult)
        continue
      }

      const activities = await activitiesRes.json()

      if (!activities || activities.length === 0) {
        results.push(userResult)
        continue
      }

      // Check which activity IDs we already have
      const stravaIds = activities.map((a: any) => a.id.toString())
      const { data: existingActivities } = await adminClient
        .from('strava_activities')
        .select('strava_activity_id')
        .eq('user_id', connection.user_id)
        .in('strava_activity_id', stravaIds)

      const existingIds = new Set((existingActivities || []).map((a: any) => a.strava_activity_id.toString()))

      // Filter to only missing activities
      const missingActivities = activities.filter((a: any) => !existingIds.has(a.id.toString()))

      if (missingActivities.length === 0) {
        results.push(userResult)
        continue
      }

      // Process each missing activity
      for (const activity of missingActivities) {
        try {
          const workoutType = mapStravaTypeToWorkoutType(activity.type)
          const trainingType = mapStravaTypeToTrainingType(activity.type, activity.workout_type || null)
          const miles = metersToMiles(activity.distance)
          const pace = secondsToMilePace(activity.moving_time, activity.distance)
          const duration = secondsToDuration(activity.moving_time)

          const activityDate = new Date(activity.start_date_local)
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
          const dayOfWeek = days[activityDate.getDay()]

          // Find the client record
          const { data: client } = await adminClient
            .from('clients')
            .select('id')
            .eq('user_id', connection.user_id)
            .single()

          let weekId: string | null = null
          let suggestedMatchId: string | null = null
          let matchConfidence: number = 0

          if (client) {
            // Find the published week containing this activity date
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

            // Try to match to a programmed workout
            if (weekId) {
              const { data: programmedWorkouts } = await adminClient
                .from('workouts')
                .select('id, day, type, training_type, miles, title')
                .eq('week_id', weekId)

              // Get already-matched activities for this week
              const { data: existingMatches } = await adminClient
                .from('strava_activities')
                .select('matched_workout_id')
                .eq('user_id', connection.user_id)
                .eq('week_id', weekId)
                .not('matched_workout_id', 'is', null)

              const alreadyMatchedIds = (existingMatches || []).map((m: any) => m.matched_workout_id)

              const candidates: MatchCandidate[] = (programmedWorkouts || [])
                .filter((w: any) => w.type !== 'rest')
                .filter((w: any) => !alreadyMatchedIds.includes(w.id))
                .map((w: any) => ({
                  id: w.id,
                  day: w.day,
                  type: w.type,
                  trainingType: w.training_type,
                  miles: w.miles ? parseFloat(w.miles) : null,
                  title: w.title,
                }))

              if (candidates.length > 0) {
                const matchResult = findBestMatch(
                  { day: dayOfWeek, type: workoutType, miles, name: activity.name },
                  candidates
                )
                if (matchResult.candidateId && matchResult.confidence >= 50) {
                  suggestedMatchId = matchResult.candidateId
                  matchConfidence = matchResult.confidence
                }
              }
            }
          }

          // Determine match status
          let matchStatus = 'pending'
          let matchedWorkoutId: string | null = null
          if (suggestedMatchId && matchConfidence >= 80) {
            matchStatus = 'matched'
            matchedWorkoutId = suggestedMatchId
          } else if (suggestedMatchId && matchConfidence >= 50) {
            matchStatus = 'suggested'
            matchedWorkoutId = suggestedMatchId
          } else if (!weekId) {
            matchStatus = 'standalone'
          }

          // Insert the activity
          const activityData = {
            user_id: connection.user_id,
            strava_activity_id: activity.id,
            week_id: weekId,
            day: dayOfWeek,
            type: workoutType,
            training_type: trainingType,
            miles: +miles.toFixed(2),
            duration,
            average_pace: pace,
            activity_name: activity.name,
            strava_type: activity.type,
            moving_time_seconds: activity.moving_time,
            distance_meters: activity.distance,
            start_date: activity.start_date,
            match_status: matchStatus,
            matched_workout_id: matchedWorkoutId,
            avg_heartrate: activity.average_heartrate || null,
            max_heartrate: activity.max_heartrate || null,
          }

          const { error: insertError } = await adminClient
            .from('strava_activities')
            .insert(activityData)

          if (insertError) {
            userResult.errors.push(`Failed to insert activity ${activity.id}: ${insertError.message}`)
          } else {
            userResult.imported++

            // If high-confidence match, also create/update the workout log
            if (matchStatus === 'matched' && matchedWorkoutId) {
              const { data: existingLog } = await adminClient
                .from('workout_logs')
                .select('id')
                .eq('workout_id', matchedWorkoutId)
                .single()

              if (!existingLog) {
                await adminClient
                  .from('workout_logs')
                  .insert({
                    workout_id: matchedWorkoutId,
                    user_id: connection.user_id,
                    status: 'complete',
                    actual_miles: miles.toFixed(2),
                    actual_pace: pace,
                    duration,
                    avg_heartrate: activity.average_heartrate || null,
                    max_heartrate: activity.max_heartrate || null,
                    notes: `Auto-synced from Strava: ${activity.name}`,
                  })
              }
            }

            // If no week match, create a client_workouts entry so it shows on the dashboard
            if (!weekId && client) {
              // Find the right week for standalone activities
              const { data: allWeeks } = await adminClient
                .from('weeks')
                .select('id, date_range')
                .eq('client_id', client.id)
                .eq('status', 'published')

              let targetWeekId: string | null = null
              if (allWeeks) {
                const actMonday = getMonday(activityDate)
                for (const week of allWeeks) {
                  const weekStartStr = week.date_range.split(' - ')[0]
                  const weekStart = new Date(weekStartStr + ', ' + activityDate.getFullYear())
                  const diffDays = Math.abs(Math.round((weekStart.getTime() - actMonday.getTime()) / (1000 * 60 * 60 * 24)))
                  if (diffDays <= 1) {
                    targetWeekId = week.id
                    break
                  }
                }
              }

              if (targetWeekId) {
                await adminClient
                  .from('client_workouts')
                  .insert({
                    user_id: connection.user_id,
                    week_id: targetWeekId,
                    day: dayOfWeek,
                    type: workoutType,
                    training_type: trainingType,
                    miles: miles > 0 ? miles.toFixed(2) : null,
                    notes: activity.name,
                    source: 'strava',
                    strava_activity_id: activity.id.toString(),
                    duration,
                    average_pace: pace || null,
                    activity_name: activity.name,
                    avg_heartrate: activity.average_heartrate || null,
                    max_heartrate: activity.max_heartrate || null,
                    completed: true,
                  })

                // Update strava_activities with the week_id
                await adminClient
                  .from('strava_activities')
                  .update({ week_id: targetWeekId, match_status: 'standalone' })
                  .eq('strava_activity_id', activity.id)
                  .eq('user_id', connection.user_id)
              }
            }
          }
        } catch (actErr: any) {
          userResult.errors.push(`Activity ${activity.id}: ${actErr.message?.slice(0, 100)}`)
        }
      }
    } catch (err: any) {
      userResult.errors.push(`Connection error: ${err.message?.slice(0, 200)}`)
    }

    results.push(userResult)
  }

  const totalImported = results.reduce((sum, r) => sum + r.imported, 0)
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)

  return NextResponse.json({
    message: `Catch-up complete: ${totalImported} activities imported, ${totalErrors} errors`,
    results,
    timestamp: new Date().toISOString(),
  })
}
