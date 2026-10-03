import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { hasCoachAccess } from '@/lib/roles'
import { getWorkoutDistanceForDisplay, normalizeWorkoutDistance } from '@/lib/workout-distance'

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
    .select('role, has_coach_access')
    .eq('id', user.id)
    .single()

  if (!hasCoachAccess(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const workoutId = params.id
  const body = await request.json()
  const { day, type, trainingType, title, miles, description, paceTarget, location, coachNotes, sortOrder, distanceUnit, structure } = body

  const updates: Record<string, any> = {}
  let effectiveType = type
  if (day !== undefined) updates.day = day
  if (type !== undefined) updates.type = type
  if (trainingType !== undefined) updates.training_type = trainingType
  if (title !== undefined) updates.title = title
  if (miles !== undefined || type !== undefined || distanceUnit !== undefined || structure !== undefined) {
    const { data: currentWorkout, error: currentWorkoutError } = await adminClient
      .from('workouts')
      .select('type, miles, distance_unit, structure')
      .eq('id', workoutId)
      .single()

    if (currentWorkoutError || !currentWorkout) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
    }

    effectiveType = type ?? currentWorkout.type
    const typeChanged = type !== undefined && type !== currentWorkout.type
    const effectiveMiles = miles !== undefined
      ? miles
      : (typeChanged ? null : getWorkoutDistanceForDisplay(currentWorkout))
    const effectiveStructure = structure !== undefined
      ? structure
      : (typeChanged ? null : currentWorkout.structure)

    const normalizedDistance = normalizeWorkoutDistance({
      type: effectiveType,
      miles: effectiveMiles,
      distanceUnit: distanceUnit ?? currentWorkout.distance_unit,
      structure: effectiveStructure,
    })
    if (normalizedDistance.error) {
      return NextResponse.json(
        { error: `This workout ${normalizedDistance.error}. Correct the distance and try again.` },
        { status: 400 }
      )
    }
    updates.miles = normalizedDistance.miles
    updates.distance_unit = normalizedDistance.distanceUnit
    if (effectiveType === 'swimming') updates.structure = normalizedDistance.structure
    if (typeChanged && structure === undefined && effectiveType !== 'swimming') updates.structure = null
  }
  if (description !== undefined) updates.description = description
  if (paceTarget !== undefined) updates.pace_target = paceTarget
  if (location !== undefined) updates.location = location
  if (coachNotes !== undefined) updates.coach_notes = coachNotes
  if (sortOrder !== undefined) updates.sort_order = sortOrder
  if (distanceUnit !== undefined && effectiveType !== 'swimming') updates.distance_unit = distanceUnit
  if (structure !== undefined && effectiveType !== 'swimming') updates.structure = structure

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
    .select('role, has_coach_access')
    .eq('id', user.id)
    .single()

  if (!hasCoachAccess(profile)) {
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
