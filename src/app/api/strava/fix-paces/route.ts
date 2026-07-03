import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { secondsToMilePace } from '@/lib/strava'

// POST /api/strava/fix-paces - Admin-only: recalculate all stored pace values
// from raw moving_time_seconds and distance_meters to fix the "8:60" rounding bug
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service role
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify admin
  const { data: adminUser } = await adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (adminUser?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Find all strava_activities with raw time/distance data
  const { data: activities, error: fetchError } = await adminClient
    .from('strava_activities')
    .select('id, moving_time_seconds, distance_meters, average_pace, matched_workout_id')
    .not('moving_time_seconds', 'is', null)
    .not('distance_meters', 'is', null)
    .gt('distance_meters', 0)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  let fixedActivities = 0
  let fixedLogs = 0

  for (const act of (activities || [])) {
    const correctPace = secondsToMilePace(act.moving_time_seconds, act.distance_meters)
    if (!correctPace) continue

    // Only update if the pace actually changed
    if (act.average_pace !== correctPace) {
      // Update strava_activities table
      await adminClient
        .from('strava_activities')
        .update({ average_pace: correctPace })
        .eq('id', act.id)
      fixedActivities++

      // Also fix the corresponding workout_log if this activity is matched
      if (act.matched_workout_id) {
        const { data: log } = await adminClient
          .from('workout_logs')
          .select('id, actual_pace')
          .eq('workout_id', act.matched_workout_id)
          .single()

        if (log && log.actual_pace === act.average_pace) {
          await adminClient
            .from('workout_logs')
            .update({ actual_pace: correctPace })
            .eq('id', log.id)
          fixedLogs++
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    totalActivities: activities?.length || 0,
    fixedActivities,
    fixedLogs,
  })
}
