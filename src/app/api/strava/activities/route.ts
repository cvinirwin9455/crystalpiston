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

    // Determine if this is a high-confidence auto-match (>= 70)
    const isAutoMatch = suggestedMatchId && suggestedMatchType === 'programmed' && matchConfidence >= 70
    const matchStatus = isAutoMatch ? 'matched' : (suggestedMatchId ? 'suggested' : 'pending')

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
      avg_heartrate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
      max_heartrate: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
      match_status: matchStatus,
      // Only set matched_workout_id for programmed workouts (FK references workouts table)
      matched_workout_id: (suggestedMatchId && suggestedMatchType === 'programmed') ? suggestedMatchId : null,
      matched_client_workout_id: (suggestedMatchId && suggestedMatchType === 'client') ? suggestedMatchId : null,
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

      // For high-confidence auto-matches to programmed workouts:
      // Create a workout_log and skip creating a standalone client_workouts entry
      if (isAutoMatch && suggestedMatchId && newActivity) {
        // Create/upsert a workout log for the programmed workout
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

        console.log(`Auto-matched Strava activity ${activityId} to programmed workout ${suggestedMatchId} (confidence: ${matchConfidence}%)`)
      } else if (weekId && newActivity) {
        // Lower confidence or no match — create a client_workouts entry so it shows on dashboard
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
          })
      }
    }

    console.log(`Processed Strava activity ${activityId} for user ${connection.user_id}: ${activity.name} (${workoutType}, ${miles} mi, ${duration}) — match: ${isAutoMatch ? `auto-matched (${matchConfidence}%)` : suggestedMatchId ? `suggested (${matchConfidence}%)` : 'none'}`)

    // Send email notification to the client about the imported activity
    try {
      // Check if client has Strava sync notifications enabled
      const { data: clientNotifPrefs } = await adminClient
        .from('notification_preferences')
        .select('strava_synced')
        .eq('user_id', connection.user_id)
        .single()

      const shouldSendStravaEmail = clientNotifPrefs?.strava_synced ?? true

      if (shouldSendStravaEmail) {
      const { data: clientUser } = await adminClient
        .from('users')
        .select('name, email')
        .eq('id', connection.user_id)
        .single()

      if (clientUser?.email) {
        // Determine match status and get matched workout title
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
        } else if (suggestedMatchId && suggestedMatchType === 'client') {
          emailMatchStatus = 'client'
          const { data: matchedCw } = await adminClient
            .from('client_workouts')
            .select('notes, type, training_type')
            .eq('id', suggestedMatchId)
            .single()
          if (matchedCw) {
            matchedWorkoutTitle = matchedCw.notes || `${matchedCw.type}${matchedCw.training_type ? ' — ' + matchedCw.training_type : ''}`
          }
        }

        const { sendEmail, buildStravaImportEmail } = await import('@/lib/email')
        const url = new URL(request.url)
        const siteUrl = `https://${url.host}`

        const { subject, html } = buildStravaImportEmail(
          clientUser.name?.split(' ')[0] || 'there',
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
      console.error('Failed to send Strava import email to client:', emailErr)
    }

    // Notify Crystal about auto-matched activities (high confidence)
    if (isAutoMatch && suggestedMatchId) {
      try {
        await notifyCrystalStravaMatch(adminClient, connection.user_id, {
          miles,
          average_pace: pace,
          duration,
          activity_name: activity.name,
          day: dayOfWeek,
        }, suggestedMatchId, 'programmed', request)
      } catch (notifErr) {
        console.error('Failed to send auto-match notification to Crystal:', notifErr)
      }
    }

    return NextResponse.json({ success: true, activityId, type: workoutType, miles, duration, suggestedMatch: suggestedMatchId, matchConfidence, autoMatched: isAutoMatch })
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
  const { stravaActivityId, action, matchedWorkoutId, matchedWorkoutType, logData } = body
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
      .update({ 
        match_status: 'matched', 
        matched_workout_id: workoutType === 'programmed' ? workoutId : null,
        matched_client_workout_id: workoutType === 'client' ? workoutId : null,
      })
      .eq('id', stravaActivityId)

    if (workoutType === 'programmed') {
      // Create/upsert a workout log for the programmed workout
      const { data: existingLog } = await adminClient
        .from('workout_logs')
        .select('id')
        .eq('workout_id', workoutId)
        .single()

      const logDataToSave = {
        workout_id: workoutId,
        status: 'complete',
        actual_miles: stravaAct.miles,
        actual_pace: stravaAct.average_pace,
        duration: stravaAct.duration,
        notes: logData?.notes || `Synced from Strava: ${stravaAct.activity_name}`,
        rpe: logData?.rpe ? parseInt(logData.rpe) : null,
        sleep: logData?.sleep ? parseInt(logData.sleep) : null,
        avg_heartrate: stravaAct.avg_heartrate || null,
        max_heartrate: stravaAct.max_heartrate || null,
      }

      if (existingLog) {
        await adminClient.from('workout_logs').update(logDataToSave).eq('id', existingLog.id)
      } else {
        await adminClient.from('workout_logs').insert(logDataToSave)
      }

      // Remove the standalone client_workouts entry (it's now matched to programmed)
      await adminClient
        .from('client_workouts')
        .delete()
        .eq('strava_activity_id', stravaActivityId)
        .eq('user_id', user.id)

    } else if (workoutType === 'client') {
      // Update the client-created workout with Strava data and mark completed
      await adminClient
        .from('client_workouts')
        .update({
          completed: true,
          completed_notes: logData?.notes || `Synced from Strava: ${stravaAct.activity_name}`,
          miles: stravaAct.miles || undefined,
          duration: stravaAct.duration || undefined,
          average_pace: stravaAct.average_pace || undefined,
          activity_name: stravaAct.activity_name || undefined,
          avg_heartrate: stravaAct.avg_heartrate || null,
          max_heartrate: stravaAct.max_heartrate || null,
        })
        .eq('id', workoutId)

      // Remove the Strava client_workouts entry (merged into original)
      await adminClient
        .from('client_workouts')
        .delete()
        .eq('strava_activity_id', stravaActivityId)
        .eq('user_id', user.id)
    }

    // Notify Crystal about the Strava-synced completion
    try {
      await notifyCrystalStravaMatch(adminClient, user.id, stravaAct, workoutId, workoutType, request)
    } catch (notifErr) {
      console.error('Failed to send Strava match notification:', notifErr)
    }

    return NextResponse.json({ success: true, action: 'matched' })

  } else if (action === 'reject') {
    // User rejected the suggested match — keep as pending, clear suggestion
    await adminClient
      .from('strava_activities')
      .update({ match_status: 'pending', matched_workout_id: null })
      .eq('id', stravaActivityId)

    return NextResponse.json({ success: true, action: 'rejected' })

  } else if (action === 'add_standalone') {
    // User wants to keep it as a separate workout — mark it as completed since it happened on Strava
    await adminClient
      .from('strava_activities')
      .update({ match_status: 'standalone', matched_workout_id: null })
      .eq('id', stravaActivityId)

    // Mark the client_workouts entry as completed with Strava data
    await adminClient
      .from('client_workouts')
      .update({
        completed: true,
        completed_notes: `Kept as extra from Strava: ${stravaAct.activity_name}`,
      })
      .eq('strava_activity_id', stravaActivityId)
      .eq('user_id', user.id)

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

// Helper: notify assigned coaches when a client confirms a Strava match
async function notifyCrystalStravaMatch(adminClient: any, userId: string, stravaAct: any, workoutId: string, workoutType: string, request: Request) {
  // Get assigned coaches for this client via client_coaches
  const { data: clientRecord } = await adminClient
    .from('clients')
    .select('id')
    .eq('user_id', userId)
    .single()

  let notifEmails: string[] = []

  if (clientRecord) {
    const { data: coachAssignments } = await adminClient
      .from('client_coaches')
      .select('coach_id')
      .eq('client_id', clientRecord.id)

    if (coachAssignments && coachAssignments.length > 0) {
      const coachIds = coachAssignments.map((ca: any) => ca.coach_id)
      const { data: coachUsers } = await adminClient
        .from('users')
        .select('id, email')
        .in('id', coachIds)

      for (const coach of coachUsers || []) {
        // Check each coach's notification preferences
        const { data: coachPrefs } = await adminClient
          .from('notification_preferences')
          .select('workout_completed, notification_emails')
          .eq('user_id', coach.id)
          .maybeSingle()

        const pref = coachPrefs?.workout_completed || 'immediate'
        if (pref !== 'immediate') continue

        // Use custom notification emails if set, otherwise coach's email
        if (coachPrefs?.notification_emails) {
          const emails = coachPrefs.notification_emails.split(',').map((e: string) => e.trim()).filter(Boolean)
          notifEmails.push(...emails)
        } else if (coach.email) {
          notifEmails.push(coach.email)
        }
      }
    }
  }

  // Fallback: if no coach assignments found, use first admin
  if (notifEmails.length === 0) {
    const { data: adminUsers } = await adminClient
      .from('users')
      .select('id, email')
      .eq('role', 'admin')
      .limit(1)
    const adminUser = adminUsers?.[0]
    if (!adminUser?.email) return
    notifEmails = [adminUser.email]
  }

  if (notifEmails.length === 0) return

  // Get client name
  const { data: clientUser } = await adminClient
    .from('users')
    .select('name')
    .eq('id', userId)
    .single()
  const clientName = clientUser?.name?.split(' ')[0] || 'A client'

  // Get the programmed workout details (if matched to programmed)
  let workoutTitle = stravaAct.activity_name || 'Workout'
  let workoutDay = stravaAct.day || ''
  if (workoutType === 'programmed') {
    const { data: workout } = await adminClient
      .from('workouts')
      .select('day, type, training_type, title, miles')
      .eq('id', workoutId)
      .single()
    if (workout) {
      workoutTitle = workout.title || workoutTitle
      workoutDay = workout.day || workoutDay
    }
  }

  const { sendEmail } = await import('@/lib/email')
  const url = new URL(request.url)
  const siteUrl = `https://${url.host}`

  const subject = `${clientName} completed: ${workoutTitle} (Strava)`
  const statusColor = '#22c55e'
  const details = [
    stravaAct.miles ? `${stravaAct.miles} mi` : '',
    stravaAct.average_pace || '',
    stravaAct.duration || '',
    `Strava: ${stravaAct.activity_name}`,
  ].filter(Boolean).join(' &bull; ')

  const emailHtml = `
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">${clientName} — ${workoutDay}</h2>
    <div style="margin: 0 0 8px; display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}44;">Completed</div>
    <div style="margin: 0 0 8px 8px; display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: #f9731622; color: #f97316; border: 1px solid #f9731644;">Strava Sync</div>
    <p style="margin: 12px 0 4px; font-size: 15px; color: #ffffff; font-weight: 600;">${workoutTitle}</p>
    ${details ? `<p style="margin: 8px 0 24px; font-size: 13px; color: #b0b0b0; line-height: 1.5;">${details}</p>` : ''}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${siteUrl}/admin" style="display: inline-block; background-color: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">View in Dashboard</a>
        </td>
      </tr>
    </table>
  `

  for (const email of notifEmails) {
    sendEmail({ to: email, subject, html: emailHtml }).catch(console.error)
  }
}
