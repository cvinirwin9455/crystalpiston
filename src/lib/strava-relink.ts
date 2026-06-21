// Re-link orphaned Strava activities to a newly published week
// Called when Crystal publishes a week — finds activities that were imported
// before the week existed and links them now.

import { findBestMatch } from '@/lib/strava-matching'
import type { MatchCandidate } from '@/lib/strava-matching'

interface RelinkResult {
  linked: number
  matched: number
}

/**
 * Find Strava activities for a user that have week_id = NULL and fall within
 * the given week's date range, then link them and run smart matching.
 */
export async function relinkOrphanedStravaActivities(
  adminClient: any,
  userId: string,
  weekId: string,
  dateRange: string
): Promise<RelinkResult> {
  // Parse the week's date range to find the Monday and Sunday
  // Date range format: "Jun 15 - Jun 21" or "Jun 15, 2026 - Jun 21, 2026"
  const weekMonday = parseDateRangeStart(dateRange)
  if (!weekMonday) return { linked: 0, matched: 0 }

  const weekSunday = new Date(weekMonday)
  weekSunday.setDate(weekMonday.getDate() + 6)
  weekSunday.setHours(23, 59, 59, 999)

  // Find orphaned Strava activities (week_id is NULL) for this user
  // whose start_date falls within this week
  const { data: orphans } = await adminClient
    .from('strava_activities')
    .select('*')
    .eq('user_id', userId)
    .is('week_id', null)

  if (!orphans || orphans.length === 0) return { linked: 0, matched: 0 }

  // Filter to activities within this week's date range
  const activitiesInWeek = orphans.filter((sa: any) => {
    if (!sa.start_date) return false
    const actDate = new Date(sa.start_date)
    return actDate >= weekMonday && actDate <= weekSunday
  })

  if (activitiesInWeek.length === 0) return { linked: 0, matched: 0 }

  // Get programmed workouts for this week (for matching)
  const { data: programmedWorkouts } = await adminClient
    .from('workouts')
    .select('id, day, type, training_type, title, miles')
    .eq('week_id', weekId)

  // Get existing workout logs (to know which are already completed)
  const workoutIds = (programmedWorkouts || []).map((w: any) => w.id)
  let completedIds: string[] = []
  if (workoutIds.length > 0) {
    const { data: logs } = await adminClient
      .from('workout_logs')
      .select('workout_id')
      .in('workout_id', workoutIds)
    completedIds = (logs || []).map((l: any) => l.workout_id)
  }

  // Get already-matched workout IDs in this week
  const { data: existingMatches } = await adminClient
    .from('strava_activities')
    .select('matched_workout_id')
    .eq('user_id', userId)
    .eq('week_id', weekId)
    .not('matched_workout_id', 'is', null)
  const alreadyMatchedIds = (existingMatches || []).map((m: any) => m.matched_workout_id).filter(Boolean)

  let linked = 0
  let matched = 0

  for (const activity of activitiesInWeek) {
    // Build candidate list (exclude already matched)
    const candidates: MatchCandidate[] = (programmedWorkouts || [])
      .filter((w: any) => w.type !== 'rest')
      .filter((w: any) => !alreadyMatchedIds.includes(w.id))
      .map((w: any) => ({
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

    let suggestedMatchId: string | null = null
    let matchStatus = 'pending'

    if (matchResult.candidateId && matchResult.confidence >= 50) {
      suggestedMatchId = matchResult.candidateId
      matchStatus = 'suggested'
      alreadyMatchedIds.push(suggestedMatchId) // Don't double-match
      matched++
    }

    // Update the activity with the week_id and match info
    await adminClient
      .from('strava_activities')
      .update({
        week_id: weekId,
        match_status: matchStatus,
        matched_workout_id: suggestedMatchId,
      })
      .eq('id', activity.id)

    // Also update or create the client_workouts entry
    const { data: existingCw } = await adminClient
      .from('client_workouts')
      .select('id')
      .eq('strava_activity_id', activity.id)
      .eq('user_id', userId)
      .single()

    if (existingCw) {
      // Update existing entry with week_id
      await adminClient
        .from('client_workouts')
        .update({ week_id: weekId })
        .eq('id', existingCw.id)
    } else {
      // Create a new client_workouts entry
      await adminClient
        .from('client_workouts')
        .insert({
          user_id: userId,
          week_id: weekId,
          day: activity.day,
          type: activity.type,
          training_type: activity.training_type,
          miles: activity.miles,
          notes: activity.activity_name,
          source: 'strava',
          strava_activity_id: activity.id,
          duration: activity.duration,
          average_pace: activity.average_pace,
          activity_name: activity.activity_name,
        })
    }

    linked++
  }

  return { linked, matched }
}

/**
 * Parse the start date from a week date_range string.
 * Handles formats like "Jun 15 - Jun 21" or "Jun 15, 2026 - Jun 21, 2026"
 */
function parseDateRangeStart(dateRange: string): Date | null {
  try {
    const startStr = dateRange.split(' - ')[0].trim()
    // Try parsing with current year if no year specified
    let date = new Date(startStr)
    if (isNaN(date.getTime())) {
      date = new Date(startStr + ', ' + new Date().getFullYear())
    }
    if (isNaN(date.getTime())) return null
    date.setHours(0, 0, 0, 0)
    return date
  } catch {
    return null
  }
}
