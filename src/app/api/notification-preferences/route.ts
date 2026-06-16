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
    // Admin (Crystal) - return all fields
    return NextResponse.json({
      workoutCompleted: prefs?.workout_completed || 'immediate',
      workoutSkipped: prefs?.workout_skipped || 'immediate',
      workoutPartial: prefs?.workout_partial || 'immediate',
      clientMessage: prefs?.client_message || 'immediate',
      dailySummary: prefs?.daily_summary || 'off',
      notificationEmails: prefs?.notification_emails || '',
      theme: prefs?.theme || 'dark',
      distanceUnit: prefs?.distance_unit || 'mi',
      defaultExpanded: prefs?.default_expanded ?? true,
    })
  }

  // Client - return client-specific fields
  return NextResponse.json({
    planPublished: prefs?.plan_published ?? true,
    messages: prefs?.messages || 'immediate',
    theme: prefs?.theme || 'dark',
    distanceUnit: prefs?.distance_unit || 'mi',
    defaultExpanded: prefs?.default_expanded ?? true,
  })
}

// PUT /api/notification-preferences - Update current user's notification settings
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { planPublished, messages, workoutCompleted, workoutSkipped, workoutPartial, clientMessage, dailySummary, notificationEmails, theme, distanceUnit, defaultExpanded } = body

  // Build updates object
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  
  // Client fields
  if (planPublished !== undefined) updates.plan_published = planPublished
  if (messages !== undefined) updates.messages = messages
  
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
  if (defaultExpanded !== undefined) updates.default_expanded = defaultExpanded

  const { data: existing } = await supabase
    .from('notification_preferences')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('notification_preferences')
      .update(updates)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('notification_preferences')
      .insert({
        user_id: user.id,
        plan_published: planPublished !== undefined ? planPublished : true,
        messages: messages || 'immediate',
        workout_completed: workoutCompleted || 'immediate',
        workout_skipped: workoutSkipped || 'immediate',
        workout_partial: workoutPartial || 'immediate',
        client_message: clientMessage || 'immediate',
        daily_summary: dailySummary || 'off',
        notification_emails: notificationEmails || null,
        theme: theme || 'dark',
        distance_unit: distanceUnit || 'mi',
        default_expanded: defaultExpanded ?? true,
      })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
