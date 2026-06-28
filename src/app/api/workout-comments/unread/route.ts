import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// MIGRATION NEEDED: Add this column to notification_preferences table:
// ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS comment_viewed_at jsonb DEFAULT '{}';
//
// GET /api/workout-comments/unread - Get clients with unviewed workout comments
// Returns user IDs of clients whose workouts have comments from clients that the coach hasn't viewed yet
export async function GET() {
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

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get the coach's comment_viewed_at timestamps (stored in notification_preferences)
  let viewedTimestamps: Record<string, string> = {}
  try {
    const { data: prefs } = await adminClient
      .from('notification_preferences')
      .select('comment_viewed_at')
      .eq('user_id', user.id)
      .single()
    if (prefs?.comment_viewed_at && typeof prefs.comment_viewed_at === 'object') {
      viewedTimestamps = prefs.comment_viewed_at as Record<string, string>
    }
  } catch {
    // Column may not exist yet — that's fine, treat all as unviewed
  }

  // Get all workout comments from the last 14 days
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const { data: comments, error } = await adminClient
    .from('workout_comments')
    .select('id, workout_id, user_id, created_at')
    .gte('created_at', fourteenDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!comments || comments.length === 0) return NextResponse.json({ clientUserIds: [] })

  // Get the user roles for comment authors
  const authorIds = [...new Set(comments.map(c => c.user_id))]
  const { data: authors } = await adminClient
    .from('users')
    .select('id, role')
    .in('id', authorIds)

  const clientAuthors = new Set((authors || []).filter(a => a.role === 'client').map(a => a.id))
  const clientComments = comments.filter(c => clientAuthors.has(c.user_id))
  if (clientComments.length === 0) return NextResponse.json({ clientUserIds: [] })

  // Map comments to client user IDs (check both workouts and client_workouts tables)
  const workoutIds = [...new Set(clientComments.map(c => c.workout_id))]

  // Build a map: client_user_id -> latest comment timestamp
  const clientLatestComment = new Map<string, string>()

  // Check workouts table (programmed workouts)
  const allWorkouts: { id: string; week_id: string }[] = []
  for (let i = 0; i < workoutIds.length; i += 100) {
    const batch = workoutIds.slice(i, i + 100)
    const { data: workouts } = await adminClient
      .from('workouts')
      .select('id, week_id')
      .in('id', batch)
    if (workouts) allWorkouts.push(...workouts)
  }

  const foundInWorkouts = new Set(allWorkouts.map(w => w.id))

  if (allWorkouts.length > 0) {
    const weekIds = [...new Set(allWorkouts.map(w => w.week_id))]
    const { data: weeks } = await adminClient
      .from('weeks')
      .select('id, client_id')
      .in('id', weekIds)

    if (weeks && weeks.length > 0) {
      const clientRecordIds = [...new Set(weeks.map(w => w.client_id))]
      const { data: clientRecords } = await adminClient
        .from('clients')
        .select('id, user_id')
        .in('id', clientRecordIds)

      const workoutToWeek = new Map(allWorkouts.map(w => [w.id, w.week_id]))
      const weekToClient = new Map(weeks.map(w => [w.id, w.client_id]))
      const clientToUser = new Map((clientRecords || []).map(c => [c.id, c.user_id]))

      for (const comment of clientComments) {
        if (!foundInWorkouts.has(comment.workout_id)) continue
        const weekId = workoutToWeek.get(comment.workout_id)
        if (!weekId) continue
        const clientId = weekToClient.get(weekId)
        if (!clientId) continue
        const userId = clientToUser.get(clientId)
        if (userId) {
          const existing = clientLatestComment.get(userId)
          if (!existing || comment.created_at > existing) {
            clientLatestComment.set(userId, comment.created_at)
          }
        }
      }
    }
  }

  // Check client_workouts table for remaining IDs
  const notFoundIds = workoutIds.filter(id => !foundInWorkouts.has(id))
  if (notFoundIds.length > 0) {
    for (let i = 0; i < notFoundIds.length; i += 100) {
      const batch = notFoundIds.slice(i, i + 100)
      const { data: clientWorkouts } = await adminClient
        .from('client_workouts')
        .select('id, user_id')
        .in('id', batch)
      if (clientWorkouts) {
        for (const cw of clientWorkouts) {
          // Find the latest comment for this workout
          const latestForWorkout = clientComments
            .filter(c => c.workout_id === cw.id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
          if (latestForWorkout) {
            const existing = clientLatestComment.get(cw.user_id)
            if (!existing || latestForWorkout.created_at > existing) {
              clientLatestComment.set(cw.user_id, latestForWorkout.created_at)
            }
          }
        }
      }
    }
  }

  // Filter: only include clients whose latest comment is AFTER the coach's last viewed timestamp
  const unviewedClientIds: string[] = []
  for (const [clientUserId, latestCommentAt] of clientLatestComment) {
    const viewedAt = viewedTimestamps[clientUserId]
    if (!viewedAt || latestCommentAt > viewedAt) {
      unviewedClientIds.push(clientUserId)
    }
  }

  return NextResponse.json({ clientUserIds: unviewedClientIds })
}

// POST /api/workout-comments/unread - Mark a client's comments as viewed
// Body: { clientUserId: string }
export async function POST(request: Request) {
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

  const body = await request.json()
  const { clientUserId } = body

  if (!clientUserId) {
    return NextResponse.json({ error: 'clientUserId is required' }, { status: 400 })
  }

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get current viewed timestamps
  let viewedTimestamps: Record<string, string> = {}
  try {
    const { data: prefs } = await adminClient
      .from('notification_preferences')
      .select('comment_viewed_at')
      .eq('user_id', user.id)
      .single()
    if (prefs?.comment_viewed_at && typeof prefs.comment_viewed_at === 'object') {
      viewedTimestamps = prefs.comment_viewed_at as Record<string, string>
    }
  } catch {
    // Column may not exist — will try to update anyway
  }

  // Update the timestamp for this client
  viewedTimestamps[clientUserId] = new Date().toISOString()

  // Save back to notification_preferences
  try {
    await adminClient
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        comment_viewed_at: viewedTimestamps,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
  } catch (err) {
    // If column doesn't exist, fail gracefully
    console.error('Failed to save comment_viewed_at:', err)
    return NextResponse.json({ success: true, fallback: true })
  }

  return NextResponse.json({ success: true })
}
