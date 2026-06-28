import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/workout-comments/unread - Get clients who have recent workout comments from clients
// Returns user IDs of clients whose workouts have comments from non-coach users in the last 14 days
// Checks both programmed workouts (workouts table) and client-added workouts (client_workouts table)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify admin/coach role
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

  // Get the user roles for ALL comment authors to identify client comments
  const authorIds = [...new Set(comments.map(c => c.user_id))]
  const { data: authors } = await adminClient
    .from('users')
    .select('id, role')
    .in('id', authorIds)

  // We want comments FROM clients (role != 'admin')
  const clientAuthors = new Set((authors || []).filter(a => a.role === 'client').map(a => a.id))

  // Filter to only comments authored by clients
  const clientComments = comments.filter(c => clientAuthors.has(c.user_id))
  if (clientComments.length === 0) return NextResponse.json({ clientUserIds: [] })

  // The workout_id in comments can point to either:
  // 1. workouts table (programmed workouts) -> has week_id -> weeks.client_id -> clients.user_id
  // 2. client_workouts table (client-added workouts) -> has user_id directly
  const workoutIds = [...new Set(clientComments.map(c => c.workout_id))]

  const clientUserIdsWithComments = new Set<string>()

  // Strategy: First try to find in workouts table (programmed workouts)
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

  // For IDs found in workouts table, trace: workout -> week -> client -> user_id
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
        if (userId) clientUserIdsWithComments.add(userId)
      }
    }
  }

  // For IDs NOT found in workouts table, check client_workouts table
  // client_workouts has user_id directly (the client who created it)
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
          clientUserIdsWithComments.add(cw.user_id)
        }
      }
    }
  }

  return NextResponse.json({ clientUserIds: [...clientUserIdsWithComments] })
}
