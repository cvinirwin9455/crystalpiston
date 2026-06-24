import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { findBestMatch } from '@/lib/strava-matching'
import type { MatchCandidate } from '@/lib/strava-matching'

// POST /api/strava/fix-matches - Admin-only: re-run matching on all unmatched Strava activities
// and auto-confirm high-confidence matches (>= 80)
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

  // Find all unmatched Strava activities (suggested or pending) that have a week_id
  const { data: unmatchedActivities, error: fetchError } = await adminClient
    .from('strava_activities')
    .select('*')
    .in('match_status', ['suggested', 'pending'])
    .not('week_id', 'is', null)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!unmatchedActivities || unmatchedActivities.length === 0) {
    return NextResponse.json({ message: 'No unmatched activities found', fixed: 0, reMatched: 0, total: 0 })
  }

  let fixed = 0
  let reMatched = 0
  const results: { userId: string; activityName: string; action: string; confidence: number }[] = []

  // Group by week_id for efficient processing
  const byWeek = new Map<string, typeof unmatchedActivities>()
  for (const act of unmatchedActivities) {
    if (!byWeek.has(act.week_id)) byWeek.set(act.week_id, [])
    byWeek.get(act.week_id)!.push(act)
  }

  for (const [weekId, activities] of byWeek) {
    // Get programmed workouts for this week
    const { data: programmedWorkouts } = await adminClient
      .from('workouts')
      .select('id, day, type, training_type, title, miles')
      .eq('week_id', weekId)

    if (!programmedWorkouts || programmedWorkouts.length === 0) continue

    // Get existing workout logs
    const workoutIds = programmedWorkouts.map(w => w.id)
    let completedIds: string[] = []
    if (workoutIds.length > 0) {
      const { data: logs } = await adminClient
        .from('workout_logs')
        .select('workout_id')
        .in('workout_id', workoutIds)
      completedIds = (logs || []).map(l => l.workout_id)
    }

    // Get already-matched strava activities for this week (to avoid double-matching)
    const { data: alreadyMatched } = await adminClient
      .from('strava_activities')
      .select('matched_workout_id')
      .eq('week_id', weekId)
      .eq('match_status', 'matched')
      .not('matched_workout_id', 'is', null)
    const alreadyMatchedIds = new Set((alreadyMatched || []).map(m => m.matched_workout_id).filter(Boolean))

    // Process each unmatched activity in this week
    for (const activity of activities) {
      // Skip if the workout it was previously suggested to match is already completed by another strava activity
      if (activity.matched_workout_id && alreadyMatchedIds.has(activity.matched_workout_id)) {
        continue
      }

      // Build candidate list
      const candidates: MatchCandidate[] = programmedWorkouts
        .filter(w => w.type !== 'rest')
        .filter(w => !alreadyMatchedIds.has(w.id))
        .map(w => ({
          id: w.id,
          type: 'programmed' as const,
          day: w.day,
          workoutType: w.type,
          trainingType: w.training_type || null,
          miles: w.miles ? parseFloat(w.miles) : null,
          title: w.title || null,
          completed: completedIds.includes(w.id),
        }))

      // Run matching
      const matchResult = findBestMatch(
        activity.type,
        activity.miles || 0,
        activity.duration,
        activity.day,
        activity.training_type,
        candidates
      )

      if (matchResult.candidateId && matchResult.confidence >= 80) {
        // High confidence — auto-confirm this match
        const workoutId = matchResult.candidateId

        // Update strava_activities to matched
        await adminClient
          .from('strava_activities')
          .update({
            match_status: 'matched',
            matched_workout_id: workoutId,
          })
          .eq('id', activity.id)

        // Create/upsert workout_log
        const { data: existingLog } = await adminClient
          .from('workout_logs')
          .select('id')
          .eq('workout_id', workoutId)
          .single()

        const logData = {
          workout_id: workoutId,
          status: 'complete',
          actual_miles: activity.miles,
          actual_pace: activity.average_pace,
          duration: activity.duration,
          notes: `Auto-synced from Strava: ${activity.activity_name}`,
          avg_heartrate: activity.avg_heartrate || null,
          max_heartrate: activity.max_heartrate || null,
        }

        if (existingLog) {
          await adminClient.from('workout_logs').update(logData).eq('id', existingLog.id)
        } else {
          await adminClient.from('workout_logs').insert(logData)
        }

        // Delete the orphaned client_workouts "Extra" entry
        await adminClient
          .from('client_workouts')
          .delete()
          .eq('strava_activity_id', activity.id)
          .eq('user_id', activity.user_id)

        // Track that this workout is now matched
        alreadyMatchedIds.add(workoutId)
        completedIds.push(workoutId)

        fixed++
        results.push({
          userId: activity.user_id,
          activityName: activity.activity_name || 'Unknown',
          action: 'auto-matched',
          confidence: matchResult.confidence,
        })

      } else if (matchResult.candidateId && matchResult.confidence >= 50) {
        // Medium confidence — update suggestion but don't auto-confirm
        await adminClient
          .from('strava_activities')
          .update({
            match_status: 'suggested',
            matched_workout_id: matchResult.candidateId,
          })
          .eq('id', activity.id)

        reMatched++
        results.push({
          userId: activity.user_id,
          activityName: activity.activity_name || 'Unknown',
          action: 're-suggested',
          confidence: matchResult.confidence,
        })
      }
    }
  }

  return NextResponse.json({
    message: `Fixed ${fixed} activities (auto-matched), re-suggested ${reMatched}`,
    fixed,
    reMatched,
    total: unmatchedActivities.length,
    results,
  })
}
