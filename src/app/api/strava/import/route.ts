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
import type { StravaActivity } from '@/lib/strava'

// POST /api/strava/import - Import historical Strava activities
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { afterDate, beforeDate } = body

  if (!afterDate) {
    return NextResponse.json({ error: 'afterDate is required (ISO string or Unix timestamp)' }, { status: 400 })
  }

  // Use service role
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get Strava connection
  const { data: connection, error: connError } = await adminClient
    .from('strava_connections')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (connError || !connection) {
    return NextResponse.json({ error: 'Strava not connected' }, { status: 400 })
  }

  // Get valid access token
  const accessToken = await getValidAccessToken(connection, adminClient)

  // Convert dates to Unix timestamps
  const after = Math.floor(new Date(afterDate).getTime() / 1000)
  const before = beforeDate ? Math.floor(new Date(beforeDate).getTime() / 1000) : Math.floor(Date.now() / 1000)

  // Fetch activities from Strava (paginated, max 200 per page)
  let allActivities: StravaActivity[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const params = new URLSearchParams({
      after: after.toString(),
      before: before.toString(),
      page: page.toString(),
      per_page: perPage.toString(),
    })

    const res = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Strava activities fetch failed:', err)
      return NextResponse.json({ error: 'Failed to fetch activities from Strava' }, { status: 500 })
    }

    const activities: StravaActivity[] = await res.json()
    allActivities = [...allActivities, ...activities]

    // Stop if we got fewer than requested (no more pages)
    if (activities.length < perPage) break
    page++

    // Safety limit: max 5 pages (500 activities)
    if (page > 5) break
  }

  if (allActivities.length === 0) {
    return NextResponse.json({ imported: 0, message: 'No activities found in the selected date range' })
  }

  // Get client record
  const { data: client } = await adminClient
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  // Get published weeks to match activities to
  let weeks: { id: string; date_range: string }[] = []
  if (client) {
    const { data: weeksData } = await adminClient
      .from('weeks')
      .select('id, date_range')
      .eq('client_id', client.id)
      .eq('status', 'published')

    weeks = weeksData || []
  }

  // Process each activity
  let imported = 0
  let skipped = 0

  for (const activity of allActivities) {
    // Map activity data first (needed for both new and re-link paths)
    const workoutType = mapStravaTypeToWorkoutType(activity.type)
    const trainingType = mapStravaTypeToTrainingType(activity.type, activity.workout_type || null)
    const miles = metersToMiles(activity.distance)
    const pace = secondsToMilePace(activity.moving_time, activity.distance)
    const duration = secondsToDuration(activity.moving_time)

    // Determine day of week
    const activityDate = new Date(activity.start_date_local)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayOfWeek = days[activityDate.getDay()]

    // Find matching week
    let weekId: string | null = null
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

    // Check if already imported
    const { data: existing } = await adminClient
      .from('strava_activities')
      .select('id, week_id')
      .eq('strava_activity_id', activity.id)
      .single()

    if (existing) {
      // If it exists but has no week_id, try to link it now
      if (!existing.week_id && weekId) {
        await adminClient
          .from('strava_activities')
          .update({ week_id: weekId })
          .eq('id', existing.id)

        // Also update the client_workouts entry
        await adminClient
          .from('client_workouts')
          .update({ week_id: weekId })
          .eq('strava_activity_id', existing.id)
          .eq('user_id', user.id)

        // Run matching for this newly linked activity
        const { data: programmedForMatch } = await adminClient
          .from('workouts')
          .select('id, day, type, training_type, title, miles')
          .eq('week_id', weekId)

        const matchWorkoutIds = (programmedForMatch || []).map((w: any) => w.id)
        let matchCompletedIds: string[] = []
        if (matchWorkoutIds.length > 0) {
          const { data: matchLogs } = await adminClient
            .from('workout_logs')
            .select('workout_id')
            .in('workout_id', matchWorkoutIds)
          matchCompletedIds = (matchLogs || []).map((l: any) => l.workout_id)
        }

        const { data: matchExisting } = await adminClient
          .from('strava_activities')
          .select('matched_workout_id')
          .eq('user_id', user.id)
          .eq('week_id', weekId)
          .not('matched_workout_id', 'is', null)
        const matchAlreadyIds = (matchExisting || []).map((m: any) => m.matched_workout_id).filter(Boolean)

        const matchCandidates: MatchCandidate[] = (programmedForMatch || [])
          .filter((w: any) => w.type !== 'rest')
          .filter((w: any) => !matchAlreadyIds.includes(w.id))
          .map((w: any) => ({
            id: w.id,
            type: 'programmed' as const,
            day: w.day,
            workoutType: w.type,
            trainingType: w.training_type || null,
            miles: w.miles ? parseFloat(w.miles) : null,
            title: w.title || null,
            completed: matchCompletedIds.includes(w.id),
          }))

        const reMatchResult = findBestMatch(workoutType, miles, duration, dayOfWeek, trainingType, matchCandidates)
        if (reMatchResult.candidateId && reMatchResult.confidence >= 50) {
          await adminClient
            .from('strava_activities')
            .update({ match_status: 'suggested', matched_workout_id: reMatchResult.candidateId })
            .eq('id', existing.id)
        }

        imported++ // Count as re-linked
      } else {
        skipped++
      }
      continue
    }
    // Insert strava_activities record with smart matching
    // Find candidates for matching on this day
    let suggestedMatchId: string | null = null
    let matchStatus = 'pending' // Will prompt user

    if (weekId) {
      const { data: programmedWorkouts } = await adminClient
        .from('workouts')
        .select('id, day, type, training_type, title, miles')
        .eq('week_id', weekId)

      const workoutIds = (programmedWorkouts || []).map(w => w.id)
      let completedIds: string[] = []
      if (workoutIds.length > 0) {
        const { data: logs } = await adminClient
          .from('workout_logs')
          .select('workout_id')
          .in('workout_id', workoutIds)
        completedIds = (logs || []).map(l => l.workout_id)
      }

      // Check already matched strava activities
      const { data: existingMatches } = await adminClient
        .from('strava_activities')
        .select('matched_workout_id')
        .eq('user_id', user.id)
        .eq('week_id', weekId)
        .not('matched_workout_id', 'is', null)
      const alreadyMatchedIds = (existingMatches || []).map(m => m.matched_workout_id).filter(Boolean)

      const candidates: MatchCandidate[] = (programmedWorkouts || [])
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
        }))

      const matchResult = findBestMatch(workoutType, miles, duration, dayOfWeek, trainingType, candidates)
      if (matchResult.candidateId && matchResult.confidence >= 50) {
        suggestedMatchId = matchResult.candidateId
        matchStatus = 'suggested'
      }
    }

    const { data: newActivity, error: insertError } = await adminClient
      .from('strava_activities')
      .insert({
        user_id: user.id,
        strava_activity_id: activity.id,
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
        match_status: matchStatus,
        matched_workout_id: suggestedMatchId,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to insert strava activity:', insertError)
      continue
    }

    // Create client_workouts entry if we have a matching week
    if (weekId && newActivity) {
      await adminClient
        .from('client_workouts')
        .insert({
          user_id: user.id,
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
          completed: true,
          completed_notes: null,
        })
    }

    imported++
  }

  return NextResponse.json({
    imported,
    skipped,
    total: allActivities.length,
    message: `Imported ${imported} activities${skipped > 0 ? ` (${skipped} already existed)` : ''}`,
  })
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
