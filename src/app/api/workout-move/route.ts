import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/workout-move - Move a workout to a different day
// Body: { workoutId, weekId, newDay, workoutType: 'programmed' | 'client' }
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { workoutId, weekId, newDay, workoutType } = body

  if (!workoutId || !weekId || !newDay || !workoutType) {
    return NextResponse.json({ error: 'workoutId, weekId, newDay, and workoutType are required' }, { status: 400 })
  }

  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  if (!validDays.includes(newDay)) {
    return NextResponse.json({ error: 'Invalid day. Must be Monday-Sunday.' }, { status: 400 })
  }

  if (workoutType !== 'programmed' && workoutType !== 'client') {
    return NextResponse.json({ error: 'workoutType must be "programmed" or "client"' }, { status: 400 })
  }

  // Use service role to bypass RLS for certain operations
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify the week belongs to this user and is published
  const { data: clientRecord } = await adminClient
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!clientRecord) {
    return NextResponse.json({ error: 'Client record not found' }, { status: 404 })
  }

  const { data: week } = await adminClient
    .from('weeks')
    .select('id, status, client_id')
    .eq('id', weekId)
    .eq('client_id', clientRecord.id)
    .eq('status', 'published')
    .single()

  if (!week) {
    return NextResponse.json({ error: 'Published week not found for this client' }, { status: 404 })
  }

  let oldDay: string | null = null
  let workoutTitle: string = ''

  if (workoutType === 'programmed') {
    // Fetch the programmed workout
    const { data: workout } = await adminClient
      .from('workouts')
      .select('id, day, title, type, training_type, week_id')
      .eq('id', workoutId)
      .eq('week_id', weekId)
      .single()

    if (!workout) {
      return NextResponse.json({ error: 'Workout not found in this week' }, { status: 404 })
    }

    // Check if the workout is completed or strava-synced (cannot be moved)
    const { data: log } = await adminClient
      .from('workout_logs')
      .select('id, status')
      .eq('workout_id', workoutId)
      .maybeSingle()

    if (log && (log.status === 'complete' || log.status === 'partial' || log.status === 'skipped')) {
      return NextResponse.json({ error: 'Cannot move a completed or skipped workout' }, { status: 400 })
    }

    // Check if it's Strava-synced
    const { data: stravaMatch } = await adminClient
      .from('strava_activities')
      .select('id')
      .eq('matched_workout_id', workoutId)
      .eq('match_status', 'matched')
      .maybeSingle()

    if (stravaMatch) {
      return NextResponse.json({ error: 'Cannot move a Strava-synced workout' }, { status: 400 })
    }

    oldDay = workout.day
    workoutTitle = workout.title || `${workout.training_type || workout.type} workout`

    if (oldDay === newDay) {
      return NextResponse.json({ message: 'No change needed' })
    }

    // Store original_day if not already stored (for reset feature)
    // We use a metadata field - if original_day isn't stored yet, save it
    const { data: existingMeta } = await adminClient
      .from('workout_moves')
      .select('id')
      .eq('workout_id', workoutId)
      .eq('workout_type', 'programmed')
      .maybeSingle()

    if (!existingMeta) {
      await adminClient
        .from('workout_moves')
        .insert({
          workout_id: workoutId,
          week_id: weekId,
          workout_type: 'programmed',
          original_day: oldDay,
          current_day: newDay,
          user_id: user.id,
        })
    } else {
      await adminClient
        .from('workout_moves')
        .update({ current_day: newDay })
        .eq('workout_id', workoutId)
        .eq('workout_type', 'programmed')
    }

    // Update the workout's day
    const { error: updateError } = await adminClient
      .from('workouts')
      .update({ day: newDay })
      .eq('id', workoutId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

  } else {
    // Client-added workout
    const { data: clientWorkout } = await adminClient
      .from('client_workouts')
      .select('id, day, type, training_type, notes, activity_name, completed, source, strava_activity_id')
      .eq('id', workoutId)
      .eq('user_id', user.id)
      .eq('week_id', weekId)
      .single()

    if (!clientWorkout) {
      return NextResponse.json({ error: 'Client workout not found' }, { status: 404 })
    }

    // Check if completed or strava-synced
    if (clientWorkout.completed) {
      return NextResponse.json({ error: 'Cannot move a completed workout' }, { status: 400 })
    }

    if (clientWorkout.source === 'strava' && clientWorkout.strava_activity_id) {
      return NextResponse.json({ error: 'Cannot move a Strava-synced workout' }, { status: 400 })
    }

    oldDay = clientWorkout.day
    workoutTitle = clientWorkout.activity_name || clientWorkout.notes || `${clientWorkout.training_type || clientWorkout.type} workout`

    if (oldDay === newDay) {
      return NextResponse.json({ message: 'No change needed' })
    }

    // Store move record for reset
    const { data: existingMeta } = await adminClient
      .from('workout_moves')
      .select('id')
      .eq('workout_id', workoutId)
      .eq('workout_type', 'client')
      .maybeSingle()

    if (!existingMeta) {
      await adminClient
        .from('workout_moves')
        .insert({
          workout_id: workoutId,
          week_id: weekId,
          workout_type: 'client',
          original_day: oldDay,
          current_day: newDay,
          user_id: user.id,
        })
    } else {
      await adminClient
        .from('workout_moves')
        .update({ current_day: newDay })
        .eq('workout_id', workoutId)
        .eq('workout_type', 'client')
    }

    // Update the client workout's day
    const { error: updateError } = await adminClient
      .from('client_workouts')
      .update({ day: newDay })
      .eq('id', workoutId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  }

  // Send coach notification (fire and forget)
  notifyCoachOfMove(adminClient, user.id, clientRecord.id, workoutTitle, oldDay!, newDay, request).catch(console.error)

  return NextResponse.json({ success: true, oldDay, newDay, workoutTitle })
}

// Helper: notify assigned coaches when a client moves a workout
async function notifyCoachOfMove(
  adminClient: any,
  userId: string,
  clientId: string,
  workoutTitle: string,
  fromDay: string,
  toDay: string,
  request: Request
) {
  // Get assigned coaches
  const { data: coachAssignments } = await adminClient
    .from('client_coaches')
    .select('coach_id')
    .eq('client_id', clientId)

  if (!coachAssignments || coachAssignments.length === 0) return

  const coachIds = coachAssignments.map((ca: any) => ca.coach_id)
  const { data: coachUsers } = await adminClient
    .from('users')
    .select('id, email')
    .in('id', coachIds)

  let notifEmails: string[] = []

  for (const coach of coachUsers || []) {
    // Check notification preferences (reuse workout_completed pref for now)
    const { data: coachPrefs } = await adminClient
      .from('notification_preferences')
      .select('workout_completed, notification_emails')
      .eq('user_id', coach.id)
      .maybeSingle()

    const pref = coachPrefs?.workout_completed || 'immediate'
    if (pref !== 'immediate') continue

    if (coachPrefs?.notification_emails) {
      const emails = coachPrefs.notification_emails.split(',').map((e: string) => e.trim()).filter(Boolean)
      notifEmails.push(...emails)
    } else if (coach.email) {
      notifEmails.push(coach.email)
    }
  }

  if (notifEmails.length === 0) return

  // Get client name
  const { data: clientUser } = await adminClient
    .from('users')
    .select('name')
    .eq('id', userId)
    .single()
  const clientName = clientUser?.name || 'A client'

  const { sendEmail, getProductionUrl, getEmailBrandFromOrgId } = await import('@/lib/email')
  const { getOrgIdForUser } = await import('@/lib/org')
  const orgId = await getOrgIdForUser(adminClient, userId)
  const brand = getEmailBrandFromOrgId(orgId)
  const siteUrl = getProductionUrl(request.url)

  const subject = `${clientName} moved a workout: ${workoutTitle}`
  const emailHtml = `
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">${clientName} rescheduled a workout</h2>
    <div style="margin: 0 0 16px; padding: 16px; background-color: rgba(99,102,241,0.1); border-left: 3px solid #6366f1; border-radius: 4px;">
      <p style="margin: 0 0 8px; font-size: 15px; color: #ffffff; font-weight: 600;">${workoutTitle}</p>
      <p style="margin: 0; font-size: 14px; color: #b0b0b0;">
        <span style="color: #ef4444; text-decoration: line-through;">${fromDay}</span>
        &nbsp;&rarr;&nbsp;
        <span style="color: #22c55e; font-weight: 600;">${toDay}</span>
      </p>
    </div>
    <p style="margin: 0 0 24px; font-size: 13px; color: #b0b0b0;">This is an automatic notification. The workout was moved by the client.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${siteUrl}/admin" style="display: inline-block; background-color: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">View in Dashboard</a>
        </td>
      </tr>
    </table>
  `

  for (const email of notifEmails) {
    sendEmail({ to: email, subject, html: emailHtml, brand }).catch(console.error)
  }
}
