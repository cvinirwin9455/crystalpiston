import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { hasCoachAccess } from '@/lib/roles'

// PATCH /api/workout-unlink
//
// Un-complete a programmed workout AND clear any Strava match pointing at it,
// so the workout becomes editable/movable again. This is the escape hatch for
// when a single Strava activity gets mis-attributed (e.g. a 13mi run showing as
// "complete" on both a 13mi Long Run and a 4mi Easy Run on the same day).
//
// What it does, atomically-ish:
//   1. Deletes the workout_logs row for the workout (un-completes it).
//   2. Finds any strava_activities rows whose matched_workout_id === workoutId
//      and clears the match (matched_workout_id -> null, status -> 'pending').
//   3. Re-creates a standalone "Extra" client_workouts row for each unlinked
//      Strava activity so the run itself is NOT lost — it reappears as an
//      unmatched activity the client/coach can re-match or dismiss.
//
// Authorization: the caller must be EITHER
//   - the client who owns the workout's week, OR
//   - a coach (hasCoachAccess) — coaches can rescue any client's data.
//
// Body: { workoutId: string }
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { workoutId } = body
  if (!workoutId) {
    return NextResponse.json({ error: 'workoutId is required' }, { status: 400 })
  }

  // Service role to bypass RLS (we enforce authorization ourselves below).
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Load the workout, then its week (two-step, mirrors /api/workout-move — no
  // reliance on PostgREST relationship embedding).
  const { data: workout } = await adminClient
    .from('workouts')
    .select('id, day, title, type, week_id')
    .eq('id', workoutId)
    .single()

  if (!workout) {
    return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
  }

  const { data: week } = await adminClient
    .from('weeks')
    .select('id, client_id')
    .eq('id', workout.week_id)
    .single()

  const weekClientId = week?.client_id as string | undefined

  // --- Authorization ---------------------------------------------------------
  // Coach? Allowed outright.
  const { data: profile } = await supabase
    .from('users')
    .select('role, has_coach_access')
    .eq('id', user.id)
    .single()

  let authorized = hasCoachAccess(profile)

  // Otherwise, is this the client who owns the week?
  let ownerUserId: string | null = null
  if (weekClientId) {
    const { data: clientRecord } = await adminClient
      .from('clients')
      .select('id, user_id')
      .eq('id', weekClientId)
      .single()
    ownerUserId = clientRecord?.user_id ?? null
    if (!authorized && ownerUserId === user.id) {
      authorized = true
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // The Strava activities / client_workouts are owned by the CLIENT's auth user,
  // not necessarily the caller (a coach acting on behalf). Use the owner id.
  const dataOwnerUserId = ownerUserId || user.id

  // --- 1. Un-complete: delete the workout log --------------------------------
  const { error: logDeleteError } = await adminClient
    .from('workout_logs')
    .delete()
    .eq('workout_id', workoutId)

  if (logDeleteError) {
    return NextResponse.json({ error: `Failed to clear completion: ${logDeleteError.message}` }, { status: 500 })
  }

  // --- 2. Clear Strava matches pointing at this workout ----------------------
  const { data: matchedActivities } = await adminClient
    .from('strava_activities')
    .select('*')
    .eq('matched_workout_id', workoutId)

  let unlinkedCount = 0
  for (const sa of matchedActivities || []) {
    // Clear the match on the activity.
    await adminClient
      .from('strava_activities')
      .update({ match_status: 'pending', matched_workout_id: null, matched_client_workout_id: null })
      .eq('id', sa.id)

    // Re-create the standalone "Extra" client_workouts row so the run stays
    // visible as an unmatched activity (unless one already exists for it).
    const { data: existingExtra } = await adminClient
      .from('client_workouts')
      .select('id')
      .eq('strava_activity_id', sa.id)
      .maybeSingle()

    if (!existingExtra && sa.week_id) {
      await adminClient
        .from('client_workouts')
        .insert({
          user_id: dataOwnerUserId,
          week_id: sa.week_id,
          day: sa.day,
          type: sa.type,
          training_type: sa.training_type,
          miles: sa.miles,
          notes: sa.activity_name,
          source: 'strava',
          strava_activity_id: sa.id,
          duration: sa.duration,
          average_pace: sa.average_pace,
          activity_name: sa.activity_name,
          avg_heartrate: sa.avg_heartrate,
          max_heartrate: sa.max_heartrate,
        })
    }
    unlinkedCount++
  }

  return NextResponse.json({
    success: true,
    workoutId,
    uncompleted: true,
    stravaActivitiesUnlinked: unlinkedCount,
  })
}
