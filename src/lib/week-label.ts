/**
 * Week labels like "Jan 4 - Jan 10" carry no year. Guessing "the current year" breaks as
 * soon as a plan crosses New Year: with a plan of Nov 16, 2026 to May 17, 2027, the week
 * "Jan 4 - Jan 10" was read as January 2026 and rejected as "outside the plan".
 * These helpers pick the year from context instead.
 */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

// Strict "Mon D" (e.g. "Jan 4"), so junk such as "garbage" is rejected rather than guessed at.
function parseMonthDay(text: string): { month: number; day: number } | null {
  const m = /^([A-Za-z]{3,9})\.? (\d{1,2})$/.exec((text || '').trim())
  if (!m) return null
  const month = MONTHS[m[1].slice(0, 3).toLowerCase()]
  const day = Number(m[2])
  if (month === undefined || day < 1 || day > 31) return null
  return { month, day }
}

function splitLabel(label: string): { start: { month: number; day: number }; end: { month: number; day: number } } | null {
  const [startStr, endStr] = (label || '').split(' - ')
  const start = parseMonthDay(startStr)
  const end = parseMonthDay(endStr ?? startStr)
  return start && end ? { start, end } : null
}

function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 0, 0, 0, 0)
}

/**
 * Resolve a week label to real start/end dates using the plan as the anchor: the year that
 * puts the week inside the plan wins; if no year does, the closest one to the plan wins
 * (so a week that really is outside the plan is still reported as outside).
 */
export function resolveWeekRangeNearPlan(label: string, planStart: Date, planEnd: Date): { start: Date; end: Date } | null {
  const parts = splitLabel(label)
  if (!parts) return null
  let best: { start: Date; end: Date; distance: number } | null = null
  for (let year = planStart.getFullYear() - 1; year <= planEnd.getFullYear() + 1; year++) {
    const start = localDate(year, parts.start.month, parts.start.day)
    // A week that runs over New Year ("Dec 28 - Jan 3") ends in the following year.
    let end = localDate(year, parts.end.month, parts.end.day)
    if (end.getTime() < start.getTime()) end = localDate(year + 1, parts.end.month, parts.end.day)
    const distance = end.getTime() < planStart.getTime()
      ? planStart.getTime() - end.getTime()
      : start.getTime() > planEnd.getTime()
        ? start.getTime() - planEnd.getTime()
        : 0
    if (!best || distance < best.distance) best = { start, end, distance }
  }
  return best ? { start: best.start, end: best.end } : null
}

/** Monday of a week label, using whichever year puts it closest to `reference` (default today). */
export function weekStartNearest(label: string, reference: Date = new Date()): Date | null {
  const parts = splitLabel(label)
  if (!parts) return null
  let best: { date: Date; distance: number } | null = null
  for (let year = reference.getFullYear() - 1; year <= reference.getFullYear() + 1; year++) {
    const date = localDate(year, parts.start.month, parts.start.day)
    const distance = Math.abs(date.getTime() - reference.getTime())
    if (!best || distance < best.distance) best = { date, distance }
  }
  return best ? best.date : null
}
