import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/notification-preferences - Get current user's notification settings
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (profile?.role === 'admin') {
    // Admin - return all fields
    return NextResponse.json({
      workoutCompleted: prefs?.workout_completed || 'immediate',
      workoutSkipped: prefs?.workout_skipped || 'immediate',
      workoutPartial: prefs?.workout_partial || 'immediate',
      clientMessage: prefs?.client_message || 'immediate',
      dailySummary: prefs?.daily_summary || 'off',
      notificationEmails: prefs?.notification_emails || '',
      theme: prefs?.theme || 'dark',
      distanceUnit: prefs?.distance_unit || 'mi',
      weightUnit: prefs?.weight_unit || 'kg',
      defaultExpanded: prefs?.default_expanded ?? true,
      dateFormat: prefs?.date_format || 'MM/DD/YYYY',
    })
  }

  // Client - return client-specific fields
  return NextResponse.json({
    planPublished: prefs?.plan_published ?? true,
    messages: prefs?.messages || 'immediate',
    stravaSynced: prefs?.strava_synced ?? true,
    workoutComments: prefs?.workout_comments_client ?? true,
    theme: prefs?.theme || 'dark',
    distanceUnit: prefs?.distance_unit || 'mi',
    weightUnit: prefs?.weight_unit || 'kg',
    defaultExpanded: prefs?.default_expanded ?? true,
    dateFormat: prefs?.date_format || 'MM/DD/YYYY',
  })
}

// PUT /api/notification-preferences - Update current user's notification settings
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { planPublished, messages, workoutCompleted, workoutSkipped, workoutPartial, clientMessage, dailySummary, notificationEmails, theme, distanceUnit, defaultExpanded, dateFormat, weightUnit } = body

  // Build updates object
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  
  // Client fields
  if (planPublished !== undefined) updates.plan_published = planPublished
  if (messages !== undefined) updates.messages = messages
  
  // Client notification toggles
  const { stravaSynced, workoutComments: workoutCommentsClient } = body
  if (stravaSynced !== undefined) updates.strava_synced = stravaSynced
  if (workoutCommentsClient !== undefined) updates.workout_comments_client = workoutCommentsClient
  
  // Admin fields
  if (workoutCompleted !== undefined) updates.workout_completed = workoutCompleted
  if (workoutSkipped !== undefined) updates.workout_skipped = workoutSkipped
  if (workoutPartial !== undefined) updates.workout_partial = workoutPartial
  if (clientMessage !== undefined) updates.client_message = clientMessage
  if (dailySummary !== undefined) updates.daily_summary = dailySummary
  if (notificationEmails !== undefined) updates.notification_emails = notificationEmails
  
  // Shared fields
  if (theme !== undefined) updates.theme = theme
  if (distanceUnit !== undefined) updates.distance_unit = distanceUnit
  if (weightUnit !== undefined) updates.weight_unit = weightUnit
  if (defaultExpanded !== undefined) updates.default_expanded = defaultExpanded
  if (dateFormat !== undefined) updates.date_format = dateFormat

  // Upsert: update if exists, insert if not
  const { error } = await supabase
    .from('notification_preferences')
    .upsert({
      user_id: user.id,
      ...updates,
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
