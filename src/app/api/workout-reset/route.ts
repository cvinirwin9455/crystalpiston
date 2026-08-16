import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/workout-reset - Reset all moved workouts in a week back to their original days
// Body: { weekId }
// Only resets workouts that are NOT completed/skipped/strava-synced
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { weekId } = body

  if (!weekId) {
    return NextResponse.json({ error: 'weekId is required' }, { status: 400 })
  }

  // Use service role to bypass RLS
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

  // Get all move records for this week
  const { data: moveRecords } = await adminClient
    .from('workout_moves')
    .select('id, workout_id, workout_type, original_day, current_day')
    .eq('week_id', weekId)
    .eq('user_id', user.id)

  if (!moveRecords || moveRecords.length === 0) {
    return NextResponse.json({ message: 'No moves to reset', resetCount: 0 })
  }

  let resetCount = 0
  const resetDetails: { workoutId: string; from: string; to: string }[] = []

  for (const move of moveRecords) {
    // Skip if already back at original day
    if (move.original_day === move.current_day) continue

    if (move.workout_type === 'programmed') {
      // Check if workout is completed or strava-synced (skip if so)
      const { data: log } = await adminClient
        .from('workout_logs')
        .select('id, status')
        .eq('workout_id', move.workout_id)
        .maybeSingle()

      if (log && (log.status === 'complete' || log.status === 'partial' || log.status === 'skipped')) {
        continue // Don't reset completed workouts
      }

      const { data: stravaMatch } = await adminClient
        .from('strava_activities')
        .select('id')
        .eq('matched_workout_id', move.workout_id)
        .eq('match_status', 'matched')
        .maybeSingle()

      if (stravaMatch) {
        continue // Don't reset strava-synced workouts
      }

      // Reset the programmed workout back to its original day
      const { error } = await adminClient
        .from('workouts')
        .update({ day: move.original_day })
        .eq('id', move.workout_id)

      if (!error) {
        resetCount++
        resetDetails.push({ workoutId: move.workout_id, from: move.current_day, to: move.original_day })
      }
    } else {
      // Client-added workout
      const { data: clientWorkout } = await adminClient
        .from('client_workouts')
        .select('id, completed, source, strava_activity_id')
        .eq('id', move.workout_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!clientWorkout) continue

      // Don't reset completed or strava-synced
      if (clientWorkout.completed) continue
      if (clientWorkout.source === 'strava' && clientWorkout.strava_activity_id) continue

      const { error } = await adminClient
        .from('client_workouts')
        .update({ day: move.original_day })
        .eq('id', move.workout_id)

      if (!error) {
        resetCount++
        resetDetails.push({ workoutId: move.workout_id, from: move.current_day, to: move.original_day })
      }
    }
  }

  // Delete the move records that were successfully reset
  if (resetDetails.length > 0) {
    const resetWorkoutIds = resetDetails.map(r => r.workoutId)
    await adminClient
      .from('workout_moves')
      .delete()
      .eq('week_id', weekId)
      .eq('user_id', user.id)
      .in('workout_id', resetWorkoutIds)
  }

  return NextResponse.json({ success: true, resetCount, details: resetDetails })
}
