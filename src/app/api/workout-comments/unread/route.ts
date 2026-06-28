import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/workout-comments/unread - Get clients who have unread (from-client) workout comments
// Returns a set of client user IDs that have comments from clients (not coach) in the last 7 days
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify admin
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

  // Get all workout comments from clients (non-admin users) in the last 14 days
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

  // Filter to only comments from clients
  const clientComments = comments.filter(c => clientAuthors.has(c.user_id))
  if (clientComments.length === 0) return NextResponse.json({ clientUserIds: [] })

  // Get the workout -> week -> client mapping
  const workoutIds = [...new Set(clientComments.map(c => c.workout_id))]
  const { data: workouts } = await adminClient
    .from('workouts')
    .select('id, week_id')
    .in('id', workoutIds)

  if (!workouts || workouts.length === 0) return NextResponse.json({ clientUserIds: [] })

  const weekIds = [...new Set(workouts.map(w => w.week_id))]
  const { data: weeks } = await adminClient
    .from('weeks')
    .select('id, client_id')
    .in('id', weekIds)

  if (!weeks || weeks.length === 0) return NextResponse.json({ clientUserIds: [] })

  // Map client_id (from clients table) to user_id
  const clientIds = [...new Set(weeks.map(w => w.client_id))]
  const { data: clients } = await adminClient
    .from('clients')
    .select('id, user_id')
    .in('id', clientIds)

  // Build the chain: comment -> workout -> week -> client -> user_id
  const workoutToWeek = new Map(workouts.map(w => [w.id, w.week_id]))
  const weekToClient = new Map(weeks.map(w => [w.id, w.client_id]))
  const clientToUser = new Map((clients || []).map(c => [c.id, c.user_id]))

  const clientUserIdsWithComments = new Set<string>()
  for (const comment of clientComments) {
    const weekId = workoutToWeek.get(comment.workout_id)
    if (!weekId) continue
    const clientId = weekToClient.get(weekId)
    if (!clientId) continue
    const userId = clientToUser.get(clientId)
    if (userId) clientUserIdsWithComments.add(userId)
  }

  return NextResponse.json({ clientUserIds: [...clientUserIdsWithComments] })
}
