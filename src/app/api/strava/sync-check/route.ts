import { NextResponse } from 'next/server'
import {
  getValidAccessToken,
  mapStravaTypeToWorkoutType,
  mapStravaTypeToTrainingType,
  metersToMiles,
  secondsToMilePace,
  secondsToDuration,
  STRAVA_API_BASE,
  getVerifyToken,
} from '@/lib/strava'
import { findBestMatch } from '@/lib/strava-matching'
import type { MatchCandidate } from '@/lib/strava-matching'

// GET /api/strava/sync-check — Periodic sync check (called by Vercel Cron)
// Checks all Strava-connected clients for activities in the last 2 hours that
// might have been missed by the webhook.
export async function GET(request: Request) {
  // Verify this is called by Vercel Cron or an admin
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Allow Vercel Cron (sends Authorization: Bearer <CRON_SECRET>)
  // Or fallback: allow if CRON_SECRET is not set (dev mode)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
    return NextResponse.json({ message: 'No Strava connections found', checked: 0, imported: 0 })
  }

  // Look for activities in the last 24 hours (daily cron on Vercel Hobby plan)
  const lookbackSeconds = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)

  let totalChecked = 0
  let totalImported = 0
  const results: { user: string; imported: number; errors: string[] }[] = []

  for (const connection of connections) {
    const userResult = { user: connection.user_id, imported: 0, errors: [] as string[] }

    try {
      // Get valid access token (refreshing if needed)
      const accessToken = await getValidAccessToken(connection, adminClient)

      // Fetch recent activities from Strava
      const params = new URLSearchParams({
        after: lookbackSeconds.toString(),
        per_page: '30',
      })

      const res = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        userResult.errors.push(`Strava API error ${res.status}: ${JSON.stringify(err)}`)
        results.push(userResult)
        continue
      }

      const activities = await res.json()
      totalChecked++

      if (!activities || activities.length === 0) {
        results.push(userResult)
        continue
      }

      // Check which activities we already have
      const stravaIds = activities.map((a: any) => a.id)
      const { data: existingActivities } = await adminClient
        .from('strava_activities')
        .select('strava_activity_id')
        .eq('user_id', connection.user_id)
        .in('strava_activity_id', stravaIds)

      const existingStravaIds = new Set((existingActivities || []).map(a => a.strava_activity_id))

      // Process activities we don't have yet
      const missingActivities = activities.filter((a: any) => !existingStravaIds.has(a.id.toString()) && !existingStravaIds.has(a.id))

      if (missingActivities.length === 0) {
        results.push(userResult)
        continue
      }

      // Get client record for week matching
      const { data: client } = await adminClient
        .from('clients')
        .select('id')
        .eq('user_id', connection.user_id)
        .single()

      // Get published weeks
      let weeks: { id: string; date_range: string }[] = []
      if (client) {
        const { data: weeksData } = await adminClient
          .from('weeks')
          .select('id, date_range')
          .eq('client_id', client.id)
          .eq('status', 'published')
        weeks = weeksData || []
      }

      for (const activity of missingActivities) {
        try {
          await processActivity(activity, connection, client, weeks, adminClient, request)
          userResult.imported++
          totalImported++
        } catch (err: any) {
          userResult.errors.push(`Activity ${activity.id} (${activity.name}): ${err.message}`)
        }
      }
    } catch (err: any) {
      userResult.errors.push(`Connection error: ${err.message}`)
    }

    results.push(userResult)
  }

  console.log(`Strava sync-check complete: ${totalChecked} clients checked, ${totalImported} activities imported`)

  return NextResponse.json({
    message: `Checked ${totalChecked} clients, imported ${totalImported} activities`,
    checked: totalChecked,
    imported: totalImported,
    results,
  })
}

// Process a single Strava activity (same logic as webhook handler)
async function processActivity(
  activity: any,
  connection: any,
  client: any,
  weeks: { id: string; date_range: string }[],
  adminClient: any,
  request: Request
) {
  const workoutType = mapStravaTypeToWorkoutType(activity.type)
  const trainingType = mapStravaTypeToTrainingType(activity.type, activity.workout_type || null)
  const miles = metersToMiles(activity.distance)
  const pace = secondsToMilePace(activity.moving_time, activity.distance)
  const duration = secondsToDuration(activity.moving_time)

  // Determine day of week
  const activityDate = new Date(activity.start_date_local || activity.start_date)
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayOfWeek = daysOfWeek[activityDate.getDay()]

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

  // Smart matching
  let suggestedMatchId: string | null = null
  let suggestedMatchType: string | null = null
  let matchConfidence = 0

  if (weekId) {
    const { data: programmedWorkouts } = await adminClient
      .from('workouts')
      .select('id, day, type, training_type, title, miles')
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

    // Check already matched activities
    const { data: existingMatches } = await adminClient
      .from('strava_activities')
      .select('matched_workout_id')
      .eq('user_id', connection.user_id)
      .eq('week_id', weekId)
      .not('matched_workout_id', 'is', null)
    const alreadyMatchedIds = (existingMatches || []).map((m: any) => m.matched_workout_id).filter(Boolean)

    // Get client-added workouts for matching
    const { data: clientWorkouts } = await adminClient
      .from('client_workouts')
      .select('id, day, type, training_type, miles, notes')
      .eq('week_id', weekId)
      .eq('user_id', connection.user_id)
      .neq('source', 'strava')

    const candidates: MatchCandidate[] = [
      ...(programmedWorkouts || [])
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
        })),
      ...(clientWorkouts || [])
        .filter((w: any) => !alreadyMatchedIds.includes(w.id))
        .map((w: any) => ({
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

    const matchResult = findBestMatch(workoutType, miles, duration, dayOfWeek, trainingType, candidates)

    if (matchResult.candidateId && matchResult.confidence >= 50) {
      suggestedMatchId = matchResult.candidateId
      suggestedMatchType = matchResult.candidateType
      matchConfidence = matchResult.confidence
    }
  }

  // Determine match status
  const isAutoMatch = suggestedMatchId && suggestedMatchType === 'programmed' && matchConfidence >= 70
  const matchStatus = isAutoMatch ? 'matched' : (suggestedMatchId ? 'suggested' : 'pending')

  // Insert strava_activities record
  const { data: newActivity, error: insertError } = await adminClient
    .from('strava_activities')
    .insert({
      user_id: connection.user_id,
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
      avg_heartrate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
      max_heartrate: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
      match_status: matchStatus,
      matched_workout_id: (suggestedMatchId && suggestedMatchType === 'programmed') ? suggestedMatchId : null,
      matched_client_workout_id: (suggestedMatchId && suggestedMatchType === 'client') ? suggestedMatchId : null,
    })
    .select('id')
    .single()

  if (insertError) {
    throw new Error(`Insert failed: ${insertError.message}`)
  }

  // For auto-matches: create workout_log
  if (isAutoMatch && suggestedMatchId && newActivity) {
    const { data: existingLog } = await adminClient
      .from('workout_logs')
      .select('id')
      .eq('workout_id', suggestedMatchId)
      .single()

    const logData = {
      workout_id: suggestedMatchId,
      status: 'complete',
      actual_miles: miles,
      actual_pace: pace,
      duration,
      notes: `Auto-synced from Strava: ${activity.name}`,
      avg_heartrate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
      max_heartrate: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
    }

    if (existingLog) {
      await adminClient.from('workout_logs').update(logData).eq('id', existingLog.id)
    } else {
      await adminClient.from('workout_logs').insert(logData)
    }

    console.log(`[sync-check] Auto-matched activity "${activity.name}" for user ${connection.user_id} (confidence: ${matchConfidence}%)`)
  } else if (weekId && newActivity) {
    // No match or low confidence — create client_workouts entry (Extra)
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
        avg_heartrate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
        max_heartrate: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
        completed: true,
      })

    console.log(`[sync-check] Imported missed activity "${activity.name}" for user ${connection.user_id} as Extra`)
  }

  // Send email notification for missed activities (same as webhook)
  try {
    const { data: clientNotifPrefs } = await adminClient
      .from('notification_preferences')
      .select('strava_synced')
      .eq('user_id', connection.user_id)
      .single()

    const shouldSendEmail = clientNotifPrefs?.strava_synced ?? true

    if (shouldSendEmail) {
      const { data: clientUser } = await adminClient
        .from('users')
        .select('name, email')
        .eq('id', connection.user_id)
        .single()

      if (clientUser?.email) {
        let emailMatchStatus: 'programmed' | 'client' | 'none' = 'none'
        let matchedWorkoutTitle: string | null = null

        if (suggestedMatchId && suggestedMatchType === 'programmed') {
          emailMatchStatus = 'programmed'
          const { data: matchedWorkout } = await adminClient
            .from('workouts')
            .select('title, type, training_type')
            .eq('id', suggestedMatchId)
            .single()
          if (matchedWorkout) {
            matchedWorkoutTitle = matchedWorkout.title || `${matchedWorkout.type}${matchedWorkout.training_type ? ' — ' + matchedWorkout.training_type : ''}`
          }
        }

        const { sendEmail, buildStravaImportEmail } = await import('@/lib/email')
        const url = new URL(request.url)
        const siteUrl = `https://${url.host}`

        const { subject, html } = buildStravaImportEmail(
          clientUser.name || 'there',
          activity.name,
          workoutType,
          miles,
          duration,
          pace,
          emailMatchStatus,
          matchedWorkoutTitle,
          dayOfWeek,
          siteUrl
        )

        await sendEmail({ to: clientUser.email, subject, html })
      }
    }
  } catch (emailErr) {
    console.error(`[sync-check] Failed to send email for activity "${activity.name}":`, emailErr)
  }
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
