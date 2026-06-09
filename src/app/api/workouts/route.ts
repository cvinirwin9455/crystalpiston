import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/workouts - Create a workout
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
  const { weekId, day, type, trainingType, title, miles, description, paceTarget, location, coachNotes, sortOrder } = body

  if (!weekId || !day) {
    return NextResponse.json({ error: 'weekId and day are required' }, { status: 400 })
  }

  const { data: workout, error } = await supabase
    .from('workouts')
    .insert({
      week_id: weekId,
      day,
      type: type || 'run',
      training_type: trainingType || null,
      title: title || null,
      miles: miles ? parseFloat(miles) : null,
      description: description || null,
      pace_target: paceTarget || null,
      location: location || null,
      coach_notes: coachNotes || null,
      sort_order: sortOrder || 0,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, workoutId: workout.id })
}
