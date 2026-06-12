import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/weeks/[id] - Update a week (status, focus, coach message)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const weekId = params.id
  const body = await request.json()
  const { dateRange, focus, coachMessage, status } = body

  const updates: Record<string, any> = {}
  if (dateRange !== undefined) updates.date_range = dateRange
  if (focus !== undefined) updates.focus = focus
  if (coachMessage !== undefined) updates.coach_message = coachMessage
  if (status !== undefined) updates.status = status

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('weeks')
    .update(updates)
    .eq('id', weekId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If status changed to published, notify the client
  if (status === 'published') {
    try {
      // Get the week's client_id and date_range
      const { data: week } = await supabase
        .from('weeks')
        .select('client_id, date_range, focus')
        .eq('id', weekId)
        .single()

      if (week) {
        // Get the client's user_id
        const { data: client } = await supabase
          .from('clients')
          .select('user_id')
          .eq('id', week.client_id)
          .single()

        if (client) {
          // Check notification preferences
          const { data: notifPrefs } = await supabase
            .from('notification_preferences')
            .select('plan_published')
            .eq('user_id', client.user_id)
            .single()

          const shouldNotify = notifPrefs ? notifPrefs.plan_published : true

          if (shouldNotify) {
            // Get client's email and name
            const { data: clientUser } = await supabase
              .from('users')
              .select('email, name')
              .eq('id', client.user_id)
              .single()

            if (clientUser?.email) {
              const { sendEmail, buildPlanPublishedEmail } = await import('@/lib/email')
              const url = new URL(request.url)
              const siteUrl = `${url.protocol}//${url.host}`
              const emailContent = buildPlanPublishedEmail(
                clientUser.name || 'there',
                week.date_range || dateRange || '',
                week.focus || focus || '',
                siteUrl
              )
              // Fire and forget
              sendEmail({ to: clientUser.email, ...emailContent }).catch(console.error)
            }
          }
        }
      }
    } catch (notifErr) {
      console.error('Failed to send publish notification:', notifErr)
    }
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/weeks/[id] - Delete a week and its workouts
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const weekId = params.id

  // Workouts will be cascade deleted due to FK constraint
  const { error } = await supabase
    .from('weeks')
    .delete()
    .eq('id', weekId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
