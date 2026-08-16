import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/workout-move - Move a workout to a different day
// Body: { workoutId, weekId, newDay, workoutType: 'programmed' | 'client' }
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { workoutId, weekId, newDay, workoutType } = body

  if (!workoutId || !weekId || !newDay || !workoutType) {
    return NextResponse.json({ error: 'workoutId, weekId, newDay, and workoutType are required' }, { status: 400 })
  }

  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  if (!validDays.includes(newDay)) {
    return NextResponse.json({ error: 'Invalid day. Must be Monday-Sunday.' }, { status: 400 })
  }

  if (workoutType !== 'programmed' && workoutType !== 'client') {
    return NextResponse.json({ error: 'workoutType must be "programmed" or "client"' }, { status: 400 })
  }

  // Use service role to bypass RLS for certain operations
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify the week belongs to this user and is published
  const { data: clientRecord } = await adminClient
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!clientRecord) {
    return NextResponse.json({ error: 'Client record not found' }, { status: 404 })
  }

  const { data: week } = await adminClient
    .from('weeks')
    .select('id, status, client_id')
    .eq('id', weekId)
    .eq('client_id', clientRecord.id)
    .eq('status', 'published')
    .single()

  if (!week) {
    return NextResponse.json({ error: 'Published week not found for this client' }, { status: 404 })
  }

  let oldDay: string | null = null
  let workoutTitle: string = ''

  if (workoutType === 'programmed') {
    // Fetch the programmed workout
    const { data: workout } = await adminClient
      .from('workouts')
      .select('id, day, title, type, training_type, week_id')
      .eq('id', workoutId)
      .eq('week_id', weekId)
      .single()

    if (!workout) {
      return NextResponse.json({ error: 'Workout not found in this week' }, { status: 404 })
    }

    // Check if the workout is completed or strava-synced (cannot be moved)
    const { data: log } = await adminClient
      .from('workout_logs')
      .select('id, status')
      .eq('workout_id', workoutId)
      .maybeSingle()

    if (log && (log.status === 'complete' || log.status === 'partial' || log.status === 'skipped')) {
      return NextResponse.json({ error: 'Cannot move a completed or skipped workout' }, { status: 400 })
    }

    // Check if it's Strava-synced
    const { data: stravaMatch } = await adminClient
      .from('strava_activities')
      .select('id')
      .eq('matched_workout_id', workoutId)
      .eq('match_status', 'matched')
      .maybeSingle()

    if (stravaMatch) {
      return NextResponse.json({ error: 'Cannot move a Strava-synced workout' }, { status: 400 })
    }

    oldDay = workout.day
    workoutTitle = workout.title || `${workout.training_type || workout.type} workout`

    if (oldDay === newDay) {
      return NextResponse.json({ message: 'No change needed' })
    }

    // Store original_day if not already stored (for reset feature)
    // We use a metadata field - if original_day isn't stored yet, save it
    const { data: existingMeta } = await adminClient
      .from('workout_moves')
      .select('id')
      .eq('workout_id', workoutId)
      .eq('workout_type', 'programmed')
      .maybeSingle()

    if (!existingMeta) {
      await adminClient
        .from('workout_moves')
        .insert({
          workout_id: workoutId,
          week_id: weekId,
          workout_type: 'programmed',
          original_day: oldDay,
          current_day: newDay,
          user_id: user.id,
        })
    } else {
      await adminClient
        .from('workout_moves')
        .update({ current_day: newDay })
        .eq('workout_id', workoutId)
        .eq('workout_type', 'programmed')
    }

    // Update the workout's day
    const { error: updateError } = await adminClient
      .from('workouts')
      .update({ day: newDay })
      .eq('id', workoutId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

  } else {
    // Client-added workout
    const { data: clientWorkout } = await adminClient
      .from('client_workouts')
      .select('id, day, type, training_type, notes, activity_name, completed, source, strava_activity_id')
      .eq('id', workoutId)
      .eq('user_id', user.id)
      .eq('week_id', weekId)
      .single()

    if (!clientWorkout) {
      return NextResponse.json({ error: 'Client workout not found' }, { status: 404 })
    }

    // Check if completed or strava-synced
    if (clientWorkout.completed) {
      return NextResponse.json({ error: 'Cannot move a completed workout' }, { status: 400 })
    }

    if (clientWorkout.source === 'strava' && clientWorkout.strava_activity_id) {
      return NextResponse.json({ error: 'Cannot move a Strava-synced workout' }, { status: 400 })
    }

    oldDay = clientWorkout.day
    workoutTitle = clientWorkout.activity_name || clientWorkout.notes || `${clientWorkout.training_type || clientWorkout.type} workout`

    if (oldDay === newDay) {
      return NextResponse.json({ message: 'No change needed' })
    }

    // Store move record for reset
    const { data: existingMeta } = await adminClient
      .from('workout_moves')
      .select('id')
      .eq('workout_id', workoutId)
      .eq('workout_type', 'client')
      .maybeSingle()

    if (!existingMeta) {
      await adminClient
        .from('workout_moves')
        .insert({
          workout_id: workoutId,
          week_id: weekId,
          workout_type: 'client',
          original_day: oldDay,
          current_day: newDay,
          user_id: user.id,
        })
    } else {
      await adminClient
        .from('workout_moves')
        .update({ current_day: newDay })
        .eq('workout_id', workoutId)
        .eq('workout_type', 'client')
    }

    // Update the client workout's day
    const { error: updateError } = await adminClient
      .from('client_workouts')
      .update({ day: newDay })
      .eq('id', workoutId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, oldDay, newDay, workoutTitle })
}
