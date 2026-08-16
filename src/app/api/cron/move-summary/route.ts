import { NextResponse } from 'next/server'

/**
 * POST /api/cron/move-summary
 * 
 * Called daily at 6am by Vercel Cron.
 * Sends a single summary email per client (to their coach) with all workout
 * moves made since the last notification.
 * 
 * Shows: workout title, original programmed day → current day for each move.
 * Groups moves by client, sends one email per client to all assigned coaches.
 */
export async function POST(request: Request) {
  // Verify this is called by Vercel Cron (not a random person)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get all un-notified moves
  const { data: moves, error: movesError } = await adminClient
    .from('workout_moves')
    .select('id, workout_id, week_id, workout_type, original_day, current_day, user_id, created_at')
    .eq('notified', false)
    .order('created_at', { ascending: true })

  if (movesError || !moves || moves.length === 0) {
    return NextResponse.json({ message: 'No moves to notify', count: 0 })
  }

  // Group moves by user_id (client)
  const movesByUser = new Map<string, typeof moves>()
  for (const move of moves) {
    if (!movesByUser.has(move.user_id)) {
      movesByUser.set(move.user_id, [])
    }
    movesByUser.get(move.user_id)!.push(move)
  }

  let emailsSent = 0
  const notifiedMoveIds: string[] = []

  for (const [userId, userMoves] of movesByUser) {
    try {
      // Get client name
      const { data: clientUser } = await adminClient
        .from('users')
        .select('name')
        .eq('id', userId)
        .single()
      const clientName = clientUser?.name || 'A client'

      // Get client record to find assigned coaches
      const { data: clientRecord } = await adminClient
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!clientRecord) continue

      // Get assigned coaches
      const { data: coachAssignments } = await adminClient
        .from('client_coaches')
        .select('coach_id')
        .eq('client_id', clientRecord.id)

      if (!coachAssignments || coachAssignments.length === 0) continue

      const coachIds = coachAssignments.map((ca: any) => ca.coach_id)
      const { data: coachUsers } = await adminClient
        .from('users')
        .select('id, email')
        .in('id', coachIds)

      // Collect coach emails (respecting notification preferences)
      let notifEmails: string[] = []
      for (const coach of coachUsers || []) {
        const { data: coachPrefs } = await adminClient
          .from('notification_preferences')
          .select('workout_completed, notification_emails')
          .eq('user_id', coach.id)
          .maybeSingle()

        const pref = coachPrefs?.workout_completed || 'immediate'
        if (pref === 'off') continue // Skip if notifications are off

        if (coachPrefs?.notification_emails) {
          const emails = coachPrefs.notification_emails.split(',').map((e: string) => e.trim()).filter(Boolean)
          notifEmails.push(...emails)
        } else if (coach.email) {
          notifEmails.push(coach.email)
        }
      }

      if (notifEmails.length === 0) continue

      // Get workout titles for each move
      const workoutDetails: { title: string; originalDay: string; currentDay: string; movedAt: string }[] = []

      for (const move of userMoves) {
        let title = 'Workout'
        if (move.workout_type === 'programmed') {
          const { data: workout } = await adminClient
            .from('workouts')
            .select('title, type, training_type')
            .eq('id', move.workout_id)
            .maybeSingle()
          if (workout) {
            title = workout.title || `${workout.training_type || workout.type || 'Workout'}`
          }
        } else {
          const { data: clientWorkout } = await adminClient
            .from('client_workouts')
            .select('type, training_type, notes, activity_name')
            .eq('id', move.workout_id)
            .maybeSingle()
          if (clientWorkout) {
            title = clientWorkout.activity_name || clientWorkout.notes || `${clientWorkout.training_type || clientWorkout.type || 'Workout'}`
          }
        }

        workoutDetails.push({
          title,
          originalDay: move.original_day,
          currentDay: move.current_day,
          movedAt: move.created_at,
        })
      }

      if (workoutDetails.length === 0) continue

      // Build the summary email
      const { sendEmail, getProductionUrl, getEmailBrandFromOrgId } = await import('@/lib/email')
      const { getOrgIdForUser } = await import('@/lib/org')
      const orgId = await getOrgIdForUser(adminClient, userId)
      const brand = getEmailBrandFromOrgId(orgId)
      const siteUrl = getProductionUrl()

      const moveCount = workoutDetails.length
      const subject = `${clientName} rescheduled ${moveCount} workout${moveCount > 1 ? 's' : ''}`

      // Build workout rows HTML
      const workoutRowsHtml = workoutDetails.map(d => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <span style="color: #ffffff; font-weight: 600; font-size: 14px;">${d.title}</span>
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center;">
            <span style="color: #ef4444; text-decoration: line-through; font-size: 13px;">${d.originalDay}</span>
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center;">
            <span style="color: #22c55e; font-weight: 600; font-size: 13px;">${d.currentDay}</span>
          </td>
        </tr>
      `).join('')

      const emailHtml = `
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #ffffff; font-weight: 700;">${clientName}</h2>
        <p style="margin: 0 0 20px; font-size: 14px; color: #b0b0b0;">Made ${moveCount} schedule change${moveCount > 1 ? 's' : ''} since your last update:</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
          <thead>
            <tr style="background-color: rgba(255,255,255,0.05);">
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Workout</th>
              <th style="padding: 8px 12px; text-align: center; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Originally</th>
              <th style="padding: 8px 12px; text-align: center; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Moved To</th>
            </tr>
          </thead>
          <tbody>
            ${workoutRowsHtml}
          </tbody>
        </table>
        <p style="margin: 0 0 24px; font-size: 12px; color: #888;">This is a daily summary of workout changes made by your client.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
          <tr>
            <td align="center">
              <a href="${siteUrl}/admin" style="display: inline-block; background-color: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">View in Dashboard</a>
            </td>
          </tr>
        </table>
      `

      // Send to all coach emails
      for (const email of notifEmails) {
        await sendEmail({ to: email, subject, html: emailHtml, brand })
      }

      emailsSent++
      notifiedMoveIds.push(...userMoves.map(m => m.id))

    } catch (err) {
      console.error(`Failed to send move summary for user ${userId}:`, err)
    }
  }

  // Mark all processed moves as notified
  if (notifiedMoveIds.length > 0) {
    await adminClient
      .from('workout_moves')
      .update({ notified: true })
      .in('id', notifiedMoveIds)
  }

  return NextResponse.json({ 
    success: true, 
    emailsSent, 
    movesProcessed: notifiedMoveIds.length,
    clientsNotified: emailsSent,
  })
}

// Also support GET for manual testing (remove in production if desired)
export async function GET(request: Request) {
  return POST(request)
}
