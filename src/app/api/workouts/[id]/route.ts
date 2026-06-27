import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/workouts/[id] - Update a workout
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service role to bypass RLS for admin operations
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Check role using service role client (bypasses RLS on users table)
  const { data: profile } = await adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const workoutId = params.id
  const body = await request.json()
  const { day, type, trainingType, title, miles, description, paceTarget, location, coachNotes, sortOrder, distanceUnit } = body

  const updates: Record<string, any> = {}
  if (day !== undefined) updates.day = day
  if (type !== undefined) updates.type = type
  if (trainingType !== undefined) updates.training_type = trainingType
  if (title !== undefined) updates.title = title
  if (miles !== undefined) updates.miles = miles ? parseFloat(miles) : null
  if (description !== undefined) updates.description = description
  if (paceTarget !== undefined) updates.pace_target = paceTarget
  if (location !== undefined) updates.location = location
  if (coachNotes !== undefined) updates.coach_notes = coachNotes
  if (sortOrder !== undefined) updates.sort_order = sortOrder
  if (distanceUnit !== undefined) updates.distance_unit = distanceUnit

  const { error } = await adminClient
    .from('workouts')
    .update(updates)
    .eq('id', workoutId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/workouts/[id] - Delete a workout
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

  const workoutId = params.id

  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', workoutId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
