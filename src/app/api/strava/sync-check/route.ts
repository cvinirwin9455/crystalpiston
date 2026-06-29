import { createClient } from '@/lib/supabase/server'
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

// POST /api/strava/sync-check - Quick check for missed activities (called on page load)
// Checks the last 24 hours for the logged-in user only
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get Strava connection for this user
  const { data: connection } = await adminClient
    .from('strava_connections')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!connection) {
    return NextResponse.json({ synced: 0, message: 'No Strava connection' })
  }

  try {
    // Get valid access token (auto-refreshes if expired)
    const accessToken = await getValidAccessToken(connection, adminClient)

    // Fetch activities from last 24 hours
    const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)
    const activitiesRes = await fetch(
      `${STRAVA_API_BASE}/athlete/activities?after=${oneDayAgo}&per_page=20`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )

    if (!activitiesRes.ok) {
      return NextResponse.json({ synced: 0, message: 'Failed to fetch from Strava' })
    }

    const activities = await activitiesRes.json()
    if (!activities || activities.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No recent activities' })
    }

    // Check which we already have
    const stravaIds = activities.map((a: any) => a.id.toString())
    const { data: existing } = await adminClient
      .from('strava_activities')
      .select('strava_activity_id')
      .eq('user_id', user.id)
      .in('strava_activity_id', stravaIds)

    const existingIds = new Set((existing || []).map((a: any) => a.strava_activity_id.toString()))
    const missing = activities.filter((a: any) => !existingIds.has(a.id.toString()))

    if (missing.length === 0) {
      return NextResponse.json({ synced: 0, message: 'All caught up' })
    }

    // Get the client record
    const { data: client } = await adminClient
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single()

    let imported = 0

    for (const activity of missing) {
      try {
        const workoutType = mapStravaTypeToWorkoutType(activity.type)
        const trainingType = mapStravaTypeToTrainingType(activity.type, activity.workout_type || null)
        const miles = metersToMiles(activity.distance)
        const pace = secondsToMilePace(activity.moving_time, activity.distance)
        const duration = secondsToDuration(activity.moving_time)

        const activityDate = new Date(activity.start_date_local)
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const dayOfWeek = days[activityDate.getDay()]

        let weekId: string | null = null
        let suggestedMatchId: string | null = null
        let suggestedMatchType: string | null = null
        let matchConfidence: number = 0

        if (client) {
          // Find the published week for this activity date
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

          // Try to match to a programmed workout (same week only)
          if (weekId) {
            const { data: programmedWorkouts } = await adminClient
              .from('workouts')
              .select('id, day, type, training_type, miles, title')
              .eq('week_id', weekId)

            const workoutIds = (programmedWorkouts || []).map((w: any) => w.id)
            let completedIds: string[] = []
            if (workoutIds.length > 0) {
              const { data: logs } = await adminClient
                .from('workout_logs')
                .select('workout_id')
                .in('workout_id', workoutIds)
              completedIds = (logs || []).map((l: any) => l.workout_id)
            }

            const { data: existingMatches } = await adminClient
              .from('strava_activities')
              .select('matched_workout_id')
              .eq('user_id', user.id)
              .eq('week_id', weekId)
              .not('matched_workout_id', 'is', null)
            const alreadyMatchedIds = (existingMatches || []).map((m: any) => m.matched_workout_id).filter(Boolean)

            const candidates: MatchCandidate[] = (programmedWorkouts || [])
              .filter((w: any) => w.type !== 'rest')
              .filter((w: any) => !alreadyMatchedIds.includes(w.id))
              .map((w: any) => ({
                id: w.id,
                type: 'programmed' as const,
                day: w.day,
                workoutType: w.type,
                trainingType: w.training_type || null,
                miles: w.miles ? parseFloat(w.miles) : null,
                title: w.title || null,
                completed: completedIds.includes(w.id),
              }))

            if (candidates.length > 0) {
              const matchResult = findBestMatch(workoutType, miles, duration, dayOfWeek, trainingType, candidates)
              if (matchResult.candidateId && matchResult.confidence >= 50) {
                suggestedMatchId = matchResult.candidateId
                suggestedMatchType = matchResult.candidateType
                matchConfidence = matchResult.confidence
              }
            }
          }
        }

        // Determine match status
        const isAutoMatch = suggestedMatchId && suggestedMatchType === 'programmed' && matchConfidence >= 70
        const matchStatus = isAutoMatch ? 'matched' : (suggestedMatchId ? 'suggested' : (weekId ? 'pending' : 'standalone'))

        // Insert strava_activities record
        const { data: newActivity } = await adminClient
          .from('strava_activities')
          .insert({
            user_id: user.id,
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
            matched_workout_id: (isAutoMatch && suggestedMatchId) ? suggestedMatchId : null,
            avg_heartrate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
            max_heartrate: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
          })
          .select('id')
          .single()

        if (newActivity) {
          imported++

          // If auto-matched, create workout log
          if (isAutoMatch && suggestedMatchId) {
            const { data: existingLog } = await adminClient
              .from('workout_logs')
              .select('id')
              .eq('workout_id', suggestedMatchId)
              .single()

            if (!existingLog) {
              await adminClient.from('workout_logs').insert({
                workout_id: suggestedMatchId,
                status: 'complete',
                actual_miles: miles.toFixed(2),
                actual_pace: pace,
                duration,
                notes: `Auto-synced from Strava: ${activity.name}`,
                avg_heartrate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
                max_heartrate: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
              })
            }
          } else if (weekId) {
            // Not auto-matched — create client_workouts entry so it shows on dashboard
            await adminClient.from('client_workouts').insert({
              user_id: user.id,
              week_id: weekId,
              day: dayOfWeek,
              type: workoutType,
              training_type: trainingType,
              miles: miles > 0 ? miles.toFixed(2) : null,
              notes: activity.name,
              source: 'strava',
              strava_activity_id: newActivity.id,
              duration,
              average_pace: pace || null,
              activity_name: activity.name,
              avg_heartrate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
              max_heartrate: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
              completed: true,
            })
          }
        }
      } catch (err: any) {
        console.error(`Sync-check: failed to process activity ${activity.id}:`, err.message)
      }
    }

    return NextResponse.json({ synced: imported, message: `${imported} activities synced` })
  } catch (err: any) {
    console.error('Sync-check error:', err.message)
    return NextResponse.json({ synced: 0, message: 'Sync check failed' })
  }
}
