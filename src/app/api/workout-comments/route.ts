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
      userNames[u.id] = u.name?.split(' ')[0] || 'Unknown'
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

  // Use admin client to bypass RLS for coaches commenting on any client's workout
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Try insert with created_by_coach_id (if migration has been run), fall back without
  let data: any = null
  let error: any = null

  const commentData: any = {
    workout_id: workoutId,
    user_id: user.id,
    message: message.trim(),
  }

  // Try with coach tracking column first
  const result1 = await adminClient
    .from('workout_comments')
    .insert({ ...commentData, created_by_coach_id: profile?.role === 'admin' ? user.id : null })
    .select()
    .single()

  if (result1.error && result1.error.message?.includes('created_by_coach_id')) {
    // Column doesn't exist yet — retry without it
    const result2 = await adminClient
      .from('workout_comments')
      .insert(commentData)
      .select()
      .single()
    data = result2.data
    error = result2.error
  } else {
    data = result1.data
    error = result1.error
  }

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
              .select('workout_comments_client')
              .eq('user_id', client.user_id)
              .single()

            if (notifPrefs?.workout_comments_client !== false) {
              recipientEmail = clientUser?.email || null
              recipientName = clientUser?.name || 'there'
            }
          } else {
            // Client commented → email ALL assigned coaches
            const { data: coachAssignments } = await adminClient
              .from('client_coaches')
              .select('coach_id')
              .eq('client_id', week.client_id)

            if (coachAssignments && coachAssignments.length > 0) {
              const coachIds = coachAssignments.map((ca: any) => ca.coach_id)
              const { data: coachUsers } = await adminClient
                .from('users')
                .select('id, email, name')
                .in('id', coachIds)

              const { sendEmail, buildWorkoutCommentEmail } = await import('@/lib/email')
              for (const coach of coachUsers || []) {
                const { data: coachPrefs } = await adminClient
                  .from('notification_preferences')
                  .select('client_message')
                  .eq('user_id', coach.id)
                  .maybeSingle()

                const shouldSend = !coachPrefs || coachPrefs.client_message !== 'off'
                if (shouldSend && coach.email) {
                  const emailContent = buildWorkoutCommentEmail(
                    coach.name?.split(' ')[0] || 'Coach',
                    profile?.name?.split(' ')[0] || 'Someone',
                    workout.day,
                    workout.type,
                    workout.title || '',
                    workout.miles?.toString() || null,
                    message.trim(),
                    siteUrl,
                    isCoach,
                    undefined
                  )
                  sendEmail({ to: coach.email, ...emailContent }).catch(console.error)
                }
              }
            } else {
              // Fallback: all admins (for clients without coach assignments)
              const { data: adminUsers } = await adminClient
                .from('users')
                .select('id, email, name')
                .eq('role', 'admin')
              const { sendEmail, buildWorkoutCommentEmail } = await import('@/lib/email')
              for (const adminUser of adminUsers || []) {
                if (adminUser.email) {
                  const emailContent = buildWorkoutCommentEmail(
                    adminUser.name?.split(' ')[0] || 'Coach',
                    profile?.name?.split(' ')[0] || 'Someone',
                    workout.day,
                    workout.type,
                    workout.title || '',
                    workout.miles?.toString() || null,
                    message.trim(),
                    siteUrl,
                    isCoach,
                    undefined
                  )
                  sendEmail({ to: adminUser.email, ...emailContent }).catch(console.error)
                }
              }
            }
          }

          if (recipientEmail) {
            const { sendEmail, buildWorkoutCommentEmail } = await import('@/lib/email')
            const emailContent = buildWorkoutCommentEmail(
              recipientName.split(' ')[0],
              profile?.name?.split(' ')[0] || 'Someone',
              workout.day,
              workout.type,
              workout.title || '',
              workout.miles?.toString() || null,
              message.trim(),
              siteUrl,
              isCoach,
              isCoach ? (profile?.name?.split(' ')[0] || undefined) : undefined
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
    userName: profile?.name?.split(' ')[0] || 'Unknown',
    message: data.message,
    createdAt: data.created_at,
    isCoach: profile?.role === 'admin',
  })
}
