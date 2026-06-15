import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/workout-comments?workout_ids=id1,id2,id3 - Get comments for multiple workouts
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const workoutIds = searchParams.get('workout_ids')

  if (!workoutIds) {
    return NextResponse.json({ error: 'workout_ids is required' }, { status: 400 })
  }

  const ids = workoutIds.split(',').filter(Boolean)
  if (ids.length === 0) return NextResponse.json({})

  // Use service role to fetch comments + user names
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: comments, error } = await adminClient
    .from('workout_comments')
    .select('id, workout_id, user_id, message, created_at')
    .in('workout_id', ids)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get user names for all comment authors
  const userIds = [...new Set((comments || []).map(c => c.user_id))]
  let userNames: Record<string, string> = {}
  let userRoles: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: users } = await adminClient
      .from('users')
      .select('id, name, role')
      .in('id', userIds)
    for (const u of users || []) {
      userNames[u.id] = u.name || 'Unknown'
      userRoles[u.id] = u.role || 'client'
    }
  }

  // Group by workout_id
  const grouped: Record<string, any[]> = {}
  for (const c of comments || []) {
    if (!grouped[c.workout_id]) grouped[c.workout_id] = []
    grouped[c.workout_id].push({
      id: c.id,
      workoutId: c.workout_id,
      userId: c.user_id,
      userName: userNames[c.user_id] || 'Unknown',
      message: c.message,
      createdAt: c.created_at,
      isCoach: userRoles[c.user_id] === 'admin',
    })
  }

  return NextResponse.json(grouped)
}

// POST /api/workout-comments - Add a comment to a workout
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { workoutId, message } = body

  if (!workoutId || !message?.trim()) {
    return NextResponse.json({ error: 'workoutId and message are required' }, { status: 400 })
  }

  // Get user's name and role
  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const { data, error } = await supabase
    .from('workout_comments')
    .insert({
      workout_id: workoutId,
      user_id: user.id,
      message: message.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send email notification
  try {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get the workout details
    const { data: workout } = await adminClient
      .from('workouts')
      .select('id, day, type, training_type, title, miles, week_id')
      .eq('id', workoutId)
      .single()

    if (workout) {
      // Get the week to find the client
      const { data: week } = await adminClient
        .from('weeks')
        .select('client_id')
        .eq('id', workout.week_id)
        .single()

      if (week) {
        // Get the client record
        const { data: client } = await adminClient
          .from('clients')
          .select('user_id')
          .eq('id', week.client_id)
          .single()

        if (client) {
          const isCoach = profile?.role === 'admin'
          const url = new URL(request.url)
          const siteUrl = `${url.protocol}//${url.host}`

          let recipientEmail: string | null = null
          let recipientName: string = ''

          if (isCoach) {
            // Crystal commented → email the client
            const { data: clientUser } = await adminClient
              .from('users')
              .select('email, name')
              .eq('id', client.user_id)
              .single()

            // Check client notification preferences
            const { data: notifPrefs } = await adminClient
              .from('notification_preferences')
              .select('messages')
              .eq('user_id', client.user_id)
              .single()

            if (notifPrefs?.messages !== 'off') {
              recipientEmail = clientUser?.email || null
              recipientName = clientUser?.name || 'there'
            }
          } else {
            // Client commented → email Crystal (admin)
            const { data: adminUsers } = await adminClient
              .from('users')
              .select('id, email, name')
              .eq('role', 'admin')

            const adminUser = adminUsers?.[0]
            if (adminUser) {
              // Check admin notification preferences
              const { data: adminNotifPrefs } = await adminClient
                .from('notification_preferences')
                .select('client_message, notification_emails')
                .eq('user_id', adminUser.id)
                .single()

              const shouldSend = !adminNotifPrefs || adminNotifPrefs.client_message !== 'off'
              if (shouldSend) {
                // Use notification_emails if set, otherwise admin's own email
                const targetEmail = adminNotifPrefs?.notification_emails
                  ? adminNotifPrefs.notification_emails.split(',')[0].trim()
                  : adminUser.email
                recipientEmail = targetEmail || null
                recipientName = adminUser.name || 'Crystal'
              }
            }
          }

          if (recipientEmail) {
            const { sendEmail, buildWorkoutCommentEmail } = await import('@/lib/email')
            const emailContent = buildWorkoutCommentEmail(
              recipientName,
              profile?.name || 'Someone',
              workout.day,
              workout.type,
              workout.title || '',
              workout.miles?.toString() || null,
              message.trim(),
              siteUrl,
              isCoach
            )
            sendEmail({ to: recipientEmail, ...emailContent }).catch(console.error)
          }
        }
      }
    }
  } catch (emailErr) {
    console.error('Failed to send workout comment email:', emailErr)
  }

  return NextResponse.json({
    id: data.id,
    workoutId: data.workout_id,
    userId: data.user_id,
    userName: profile?.name || 'Unknown',
    message: data.message,
    createdAt: data.created_at,
    isCoach: profile?.role === 'admin',
  })
}
