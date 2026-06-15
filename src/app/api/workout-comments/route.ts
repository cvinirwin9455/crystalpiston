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
  if (userIds.length > 0) {
    const { data: users } = await adminClient
      .from('users')
      .select('id, name, role')
      .in('id', userIds)
    for (const u of users || []) {
      userNames[u.id] = u.name || 'Unknown'
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
      isCoach: c.user_id !== user.id, // If it's not the current user, it's the other party
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

  // Get user's name
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
