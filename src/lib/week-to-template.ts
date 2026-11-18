import {
  getWorkoutDistanceForDisplay,
  getWorkoutDistanceUnitForDisplay,
  getWorkoutStructureForDisplay,
} from '@/lib/workout-distance'

// Turn a SAVED week (rows from `weeks` + `workouts`) into a reusable week template
// (`templates.data`), in the same shape the Create Week form saves and loads:
//   { focus, coachMessage, days: [7 x { day, sessionType, sessionConflict, workouts: [...] }] }
//
// Only the coach's PROGRAMMING is copied. Nothing client-specific that was recorded
// afterwards (logs, Strava matches, in-person sessions) ever reaches a template.

export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export type TemplateWorkout = {
  type: string
  trainingType: string
  title: string
  miles: string
  description: string
  paceTarget: string
  location: string
  coachNotes: string
  distanceUnit?: 'mi' | 'km'
  structure?: unknown
  crossTrainingStructure?: unknown
}

export type TemplateDay = {
  day: string
  sessionType: 'remote'
  sessionConflict: false
  workouts: TemplateWorkout[]
}

export type WeekTemplateData = {
  focus: string
  coachMessage: string
  days: TemplateDay[]
}

const restWorkout = (): TemplateWorkout => ({
  type: 'rest', trainingType: 'Rest', title: '', miles: '', description: '',
  paceTarget: '', location: '', coachNotes: '', distanceUnit: 'mi',
})

/**
 * @param week        the saved week (`focus`, `coach_message`)
 * @param workouts    its rows from the `workouts` table
 * @param originalDay workout id -> the day the COACH programmed it on. A client who moves a
 *                    workout overwrites `workouts.day`; the original is kept in
 *                    `workout_moves.original_day`. A template should reflect what the coach
 *                    programmed, not the client's rearranging, so it is preferred here.
 */
export function buildWeekTemplateData(
  week: { focus?: string | null; coach_message?: string | null },
  workouts: any[],
  originalDay: Map<string, string> | Record<string, string> = {}
): WeekTemplateData {
  const lookup = (id: string): string | undefined =>
    originalDay instanceof Map ? originalDay.get(id) : (originalDay as Record<string, string>)[id]

  const ordered = [...(workouts || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const byDay = new Map<string, any[]>(WEEK_DAYS.map((d) => [d, []]))
  for (const w of ordered) {
    const moved = lookup(w.id)
    const day = moved && WEEK_DAYS.includes(moved) ? moved : w.day
    if (byDay.has(day)) byDay.get(day)!.push(w)
  }

  const days: TemplateDay[] = WEEK_DAYS.map((day) => {
    const rows = byDay.get(day) || []
    // A client moving a workout onto a rest day leaves that day's rest row behind;
    // a day with real workouts is not also a rest day.
    const real = rows.filter((w) => (w.type || 'rest') !== 'rest')
    const workoutsForDay: TemplateWorkout[] = real.length > 0
      ? real.map((w) => {
          const type = w.type || 'rest'
          const distance = getWorkoutDistanceForDisplay(w)
          const unit = getWorkoutDistanceUnitForDisplay(w)
          const structure = getWorkoutStructureForDisplay(w)
          const out: TemplateWorkout = {
            type,
            trainingType: w.training_type || '',
            title: w.title || '',
            miles: distance != null ? String(distance) : '',
            description: w.description || '',
            paceTarget: w.pace_target || '',
            location: w.location || '',
            coachNotes: w.coach_notes || '',
            distanceUnit: type === 'swimming' ? undefined : (unit || 'mi'),
          }
          if (structure) {
            out.structure = structure
            if (type === 'cross') out.crossTrainingStructure = structure
          }
          return out
        })
      : [restWorkout()]
    // Templates carry no schedule: whether a day is in-person depends on the client the
    // template is later loaded for, so every day is saved as remote.
    return { day, sessionType: 'remote', sessionConflict: false, workouts: workoutsForDay }
  })

  return { focus: week.focus || '', coachMessage: week.coach_message || '', days }
}
