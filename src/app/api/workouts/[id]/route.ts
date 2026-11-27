import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { hasCoachAccess } from '@/lib/roles'
import { getWorkoutDistanceForDisplay, normalizeWorkoutDistance } from '@/lib/workout-distance'

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Monday of a week from its label ("Nov 9 - Nov 15"). Labels carry no year, so use
// the current year and roll forward if that lands more than ~6 months in the past
// (same heuristic as the rest of the app). Built at local noon to dodge DST edges.
function weekMondayFromRange(dateRange: string): Date | null {
  const startStr = (dateRange || '').split(' - ')[0]?.trim()
  if (!startStr) return null
  const now = new Date()
  let parsed = new Date(`${startStr}, ${now.getFullYear()} 12:00:00`)
  if (isNaN(parsed.getTime())) return null
  if (parsed.getTime() < now.getTime() - 180 * 24 * 60 * 60 * 1000) {
    parsed = new Date(`${startStr}, ${now.getFullYear() + 1} 12:00:00`)
  }
  return parsed
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateForDay(monday: Date, dayName: string): Date {
  const d = new Date(monday)
  d.setDate(d.getDate() + WEEK_DAYS.indexOf(dayName))
  return d
}

// Rules for a COACH moving a programmed workout to another day. Returns an error
// message if the move isn't allowed, or null when it is. The client-side screen
// applies the same rules, but they are enforced here too.
async function validateCoachMove(adminClient: any, workoutId: string, newDay: string): Promise<string | null> {
  if (!WEEK_DAYS.includes(newDay)) return 'Invalid day. Must be Monday-Sunday.'

  // The session_type column may not exist on older databases, so retry without it.
  let workout: any = null
  const withSession = await adminClient.from('workouts').select('id, day, type, week_id, session_type').eq('id', workoutId).maybeSingle()
  if (!withSession.error) {
    workout = withSession.data
  } else {
    const base = await adminClient.from('workouts').select('id, day, type, week_id').eq('id', workoutId).maybeSingle()
    workout = base.data
  }
  if (!workout) return 'Workout not found.'
  if (workout.day === newDay) return null // nothing to move

  const { data: week } = await adminClient.from('weeks').select('id, client_id, date_range').eq('id', workout.week_id).maybeSingle()
  if (!week) return 'Week not found.'

  const monday = weekMondayFromRange(week.date_range)
  if (!monday) return 'Could not read this week\u2019s dates.'

  // Past weeks are locked. One day of grace so a week that ended last night in the
  // coach's timezone (already "tomorrow" on the server) can still be fixed.
  const sunday = dateForDay(monday, 'Sunday')
  const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); cutoff.setDate(cutoff.getDate() - 1)
  if (sunday.getTime() < cutoff.getTime()) return 'This week is in the past and is locked.'

  // Completed / skipped / partial workouts and Strava-matched workouts stay put.
  const { data: log } = await adminClient.from('workout_logs').select('id').eq('workout_id', workoutId).maybeSingle()
  if (log) return 'This workout has already been logged, so it can\u2019t be moved.'
  const { data: stravaMatch } = await adminClient.from('strava_activities').select('id').eq('matched_workout_id', workoutId).eq('match_status', 'matched').maybeSingle()
  if (stravaMatch) return 'This workout is matched to a Strava activity, so it can\u2019t be moved.'

  // In-person days are tied to a scheduled session by DATE. Moving onto a session
  // date would silently make the workout in-person; moving off would strand the
  // session. Reschedule the session from the Sessions tab instead.
  if (workout.type !== 'rest') {
    const sessionDates = new Set<string>()
    try {
      const { data: sessions } = await adminClient
        .from('sessions')
        .select('scheduled_at')
        .eq('client_id', week.client_id)
        .eq('status', 'scheduled')
        .gte('scheduled_at', `${isoDate(monday)}T00:00:00`)
        .lte('scheduled_at', `${isoDate(sunday)}T23:59:59`)
      for (const s of sessions || []) {
        const m = String(s.scheduled_at).match(/^(\d{4}-\d{2}-\d{2})/)
        if (m) sessionDates.add(m[1])
      }
    } catch { /* sessions table may not exist yet */ }

    if (workout.session_type === 'in_person' || sessionDates.has(isoDate(dateForDay(monday, workout.day)))) {
      return 'This is an in-person session day. Reschedule the session from the Sessions tab instead of moving the workout.'
    }
    if (sessionDates.has(isoDate(dateForDay(monday, newDay)))) {
      return `${newDay} has an in-person session scheduled. Pick a different day, or reschedule the session from the Sessions tab.`
    }
  }

  return null
}

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

  // Moving a workout to another day has extra rules; check them BEFORE changing anything.
  if (day !== undefined) {
    const moveError = await validateCoachMove(adminClient, workoutId, day)
    if (moveError) return NextResponse.json({ error: moveError }, { status: 400 })
  }

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
  // Rest days never carry a structure, even if the caller sent a stale one.
  if (effectiveType === 'rest') updates.structure = null

  const { error } = await adminClient
    .from('workouts')
    .update(updates)
    .eq('id', workoutId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // The coach is the source of truth for a workout's programmed day. If the client
  // had moved this workout earlier, drop that record, otherwise the client's
  // "Reset Week" would later put it back on the OLD day and undo the coach's move.
  if (day !== undefined) {
    try {
      await adminClient.from('workout_moves').delete().eq('workout_id', workoutId).eq('workout_type', 'programmed')
    } catch { /* workout_moves table may not exist yet */ }
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
