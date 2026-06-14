import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/workout-logs - Create a workout log (upsert)
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    workoutId,
    status,
    skipReason,
    rpe,
    actualMiles,
    actualPace,
    stress,
    notes,
    onPeriod,
    duration,
    energy,
    motivation,
    sleep,
    strength,
    recovery,
    mood,
    hunger,
  } = body

  if (!workoutId) {
    return NextResponse.json({ error: 'workoutId is required' }, { status: 400 })
  }

  if (!status) {
    return NextResponse.json({ error: 'status is required (complete, partial, skipped)' }, { status: 400 })
  }

  // Use service role to bypass RLS
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Check if a log already exists for this workout (upsert)
  const { data: existing } = await adminClient
    .from('workout_logs')
    .select('id')
    .eq('workout_id', workoutId)
    .single()

  const logData = {
    status,
    skip_reason: skipReason || null,
    rpe: rpe ? parseInt(rpe) : null,
    actual_miles: actualMiles ? parseFloat(actualMiles) : null,
    actual_pace: actualPace || null,
    stress: stress ? parseInt(stress) : null,
    notes: notes || null,
    on_period: onPeriod === 'yes' || onPeriod === true,
    duration: duration || null,
    energy: energy ? parseInt(energy) : null,
    motivation: motivation ? parseInt(motivation) : null,
    sleep: sleep ? parseInt(sleep) : null,
    strength: strength ? parseInt(strength) : null,
    recovery: recovery ? parseInt(recovery) : null,
    mood: mood ? parseInt(mood) : null,
    hunger: hunger ? parseInt(hunger) : null,
  }

  if (existing) {
    // Update existing log
    const { error } = await adminClient
      .from('workout_logs')
      .update(logData)
      .eq('id', existing.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, logId: existing.id, updated: true })
  }

  // Create new log
  const { data: newLog, error } = await adminClient
    .from('workout_logs')
    .insert({ workout_id: workoutId, ...logData })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Notify Crystal about workout activity
  try {
    await notifyCrystalWorkoutLog(adminClient, user.id, workoutId, status, logData, skipReason, request)
  } catch (notifErr) {
    console.error('Failed to send workout notification:', notifErr)
  }

  return NextResponse.json({ success: true, logId: newLog.id, updated: false })
}

// Helper: send email notification to Crystal when a client logs a workout
async function notifyCrystalWorkoutLog(
  adminClient: any,
  userId: string,
  workoutId: string,
  status: string,
  logData: any,
  skipReason: string | null,
  request: Request
) {
  // Determine which preference to check
  let prefField: string
  if (status === 'complete') prefField = 'workout_completed'
  else if (status === 'skipped') prefField = 'workout_skipped'
  else if (status === 'partial') prefField = 'workout_partial'
  else return

  // Get the client's assigned coach
  const { data: clientRecord } = await adminClient
    .from('clients')
    .select('coach_id')
    .eq('user_id', userId)
    .maybeSingle()

  let coachId = clientRecord?.coach_id
  if (!coachId) {
    // Fallback: find any admin
    const { data: fallbackAdmin } = await adminClient
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
    coachId = fallbackAdmin?.[0]?.id
  }
  if (!coachId) return

  const { data: adminUser } = await adminClient
    .from('users')
    .select('id, email')
    .eq('id', coachId)
    .single()

  if (!adminUser) return

  // Check coach's notification preferences
  const { data: adminPrefs } = await adminClient
    .from('notification_preferences')
    .select(`${prefField}, notification_emails`)
    .eq('user_id', adminUser.id)
    .maybeSingle()

  const pref = adminPrefs?.[prefField] || 'immediate'
  if (pref !== 'immediate') return

  // Get notification emails
  let notifEmails: string[] = []
  if (adminPrefs?.notification_emails) {
    notifEmails = adminPrefs.notification_emails.split(',').map((e: string) => e.trim()).filter(Boolean)
  }
  if (notifEmails.length === 0 && adminUser.email) {
    notifEmails = [adminUser.email]
  }
  if (notifEmails.length === 0) return

  // Get client name
  const { data: clientUser } = await adminClient
    .from('users')
    .select('name')
    .eq('id', userId)
    .single()

  const clientName = clientUser?.name || 'A client'

  // Get workout details
  const { data: workout } = await adminClient
    .from('workouts')
    .select('day, type, training_type, title, miles')
    .eq('id', workoutId)
    .single()

  const workoutTitle = workout?.title || workout?.day || 'Workout'
  const workoutDay = workout?.day || ''
  const workoutMiles = workout?.miles ? `${workout.miles} mi` : ''

  // Build email content based on status
  const { sendEmail } = await import('@/lib/email')
  const url = new URL(request.url)
  const siteUrl = `${url.protocol}//${url.host}`

  let subject: string
  let statusLabel: string
  let statusColor: string
  let details: string

  if (status === 'complete') {
    subject = `${clientName} completed: ${workoutTitle}`
    statusLabel = 'Completed'
    statusColor = '#22c55e'
    details = [
      logData.rpe ? `Effort: ${logData.rpe}/10` : '',
      logData.actual_miles ? `Miles: ${logData.actual_miles}` : '',
      logData.actual_pace ? `Pace: ${logData.actual_pace}` : '',
      logData.duration ? `Duration: ${logData.duration}` : '',
      logData.notes ? `Notes: ${logData.notes}` : '',
    ].filter(Boolean).join(' &bull; ')
  } else if (status === 'skipped') {
    subject = `${clientName} skipped: ${workoutTitle}`
    statusLabel = 'Skipped'
    statusColor = '#ef4444'
    details = skipReason || 'No reason provided'
  } else {
    subject = `${clientName} partially completed: ${workoutTitle}`
    statusLabel = 'Partially Done'
    statusColor = '#eab308'
    details = [
      skipReason ? `Reason: ${skipReason}` : '',
      logData.rpe ? `Effort: ${logData.rpe}/10` : '',
      logData.actual_miles ? `Miles: ${logData.actual_miles}` : '',
      logData.notes ? `Notes: ${logData.notes}` : '',
    ].filter(Boolean).join(' &bull; ')
  }

  const emailHtml = `
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">${clientName} — ${workoutDay}</h2>
    <div style="margin: 0 0 8px; display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}44;">${statusLabel}</div>
    <p style="margin: 12px 0 4px; font-size: 15px; color: #ffffff; font-weight: 600;">${workoutTitle}${workoutMiles ? ` — ${workoutMiles}` : ''}</p>
    ${details ? `<p style="margin: 8px 0 24px; font-size: 13px; color: #b0b0b0; line-height: 1.5;">${details}</p>` : ''}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${siteUrl}/admin" style="display: inline-block; background-color: #e94560; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">View in Dashboard</a>
        </td>
      </tr>
    </table>
  `

  for (const email of notifEmails) {
    sendEmail({ to: email, subject, html: emailHtml }).catch(console.error)
  }
}
