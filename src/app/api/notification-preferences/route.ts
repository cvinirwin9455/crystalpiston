import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/notification-preferences - Get current user's notification settings
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('plan_published, messages')
    .eq('user_id', user.id)
    .single()

  // Return defaults if no preferences saved yet
  if (!prefs) {
    return NextResponse.json({ planPublished: true, messages: 'immediate' })
  }

  return NextResponse.json({
    planPublished: prefs.plan_published,
    messages: prefs.messages,
  })
}

// PUT /api/notification-preferences - Update current user's notification settings
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { planPublished, messages } = body

  if (messages !== undefined && !['immediate', 'daily', 'off'].includes(messages)) {
    return NextResponse.json({ error: 'messages must be immediate, daily, or off' }, { status: 400 })
  }

  // Upsert: insert if not exists, update if exists
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (planPublished !== undefined) updates.plan_published = planPublished
  if (messages !== undefined) updates.messages = messages

  const { data: existing } = await supabase
    .from('notification_preferences')
    .select('id')
    .eq('user_id', user.id)
    .single()

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
      })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
