import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOrgIdForUser } from '@/lib/org'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * GET /api/client-stats?client_id=xxx
 * 
 * Returns aggregated running stats for a client:
 * - Distance PRs (fastest pace for key distances)
 * - Weekly mileage totals (last 12 weeks)
 * - Recent runs (last 20 with distance, pace, time, date)
 * - Totals (all-time distance, total runs, avg pace)
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  if (!clientId) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Get the client's user_id from clients table
  const { data: clientRecord } = await adminClient
    .from('clients')
    .select('id, user_id')
    .eq('id', clientId)
    .single()

  if (!clientRecord) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const userId = clientRecord.user_id

  // Get all weeks for this client
  const { data: weeks } = await adminClient
    .from('weeks')
    .select('id, date_range, created_at')
    .eq('client_id', clientId)
    .eq('status', 'published')

  const weekIds = (weeks || []).map(w => w.id)

  // Get all workouts for those weeks (programmed)
  let workouts: any[] = []
  if (weekIds.length > 0) {
    const { data } = await adminClient
      .from('workouts')
      .select('id, week_id, day, type, training_type, miles, distance_unit')
      .in('week_id', weekIds)
      .eq('type', 'run')
    workouts = data || []
  }

  // Get workout logs (completed runs with actual data)
  const workoutIds = workouts.map(w => w.id)
  let logs: any[] = []
  if (workoutIds.length > 0) {
    const { data } = await adminClient
      .from('workout_logs')
      .select('id, workout_id, status, actual_miles, actual_pace, duration, avg_heartrate, max_heartrate')
      .in('workout_id', workoutIds)
      .eq('status', 'completed')
    logs = data || []
  }

  // Get Strava activities for this user
  let stravaActivities: any[] = []
  if (weekIds.length > 0) {
    const { data } = await adminClient
      .from('strava_activities')
      .select('id, week_id, day, type, miles, duration, average_pace, distance_meters, moving_time_seconds, avg_heartrate, max_heartrate, activity_name, created_at')
      .eq('user_id', userId)
      .in('week_id', weekIds)
      .eq('type', 'run')
    stravaActivities = data || []
  }

  // Also get Strava activities not tied to weeks (if any exist outside week scope)
  const { data: allStravaRuns } = await adminClient
    .from('strava_activities')
    .select('id, miles, duration, average_pace, distance_meters, moving_time_seconds, avg_heartrate, max_heartrate, activity_name, start_date')
    .eq('user_id', userId)
    .eq('type', 'run')
    .order('start_date', { ascending: false })
    .limit(100)

  // Combine all run data into a unified format
  type RunEntry = {
    date: string;
    miles: number;
    pace: string; // min/mi format
    duration: string; // HH:MM:SS or MM:SS
    durationSeconds: number;
    avgHr: number | null;
    maxHr: number | null;
    name: string;
    source: 'programmed' | 'strava';
  }

  const runs: RunEntry[] = []

  // From Strava activities (most reliable data)
  for (const activity of (allStravaRuns || [])) {
    const miles = activity.miles ? parseFloat(activity.miles) : (activity.distance_meters ? activity.distance_meters / 1609.34 : 0)
    if (miles <= 0) continue

    const durationSec = activity.moving_time_seconds || 0
    const paceSecPerMile = durationSec > 0 && miles > 0 ? durationSec / miles : 0
    const paceMin = Math.floor(paceSecPerMile / 60)
    const paceSec = Math.round(paceSecPerMile % 60)
    const pace = paceSecPerMile > 0 ? `${paceMin}:${paceSec.toString().padStart(2, '0')}` : (activity.average_pace || '')

    const hours = Math.floor(durationSec / 3600)
    const mins = Math.floor((durationSec % 3600) / 60)
    const secs = durationSec % 60
    const duration = hours > 0 
      ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${mins}:${secs.toString().padStart(2, '0')}`

    runs.push({
      date: activity.start_date ? activity.start_date.split('T')[0] : '',
      miles,
      pace,
      duration,
      durationSeconds: durationSec,
      avgHr: activity.avg_heartrate || null,
      maxHr: activity.max_heartrate || null,
      name: activity.activity_name || 'Run',
      source: 'strava',
    })
  }

  // From workout logs (if no Strava, use manual logging)
  for (const log of logs) {
    const workout = workouts.find(w => w.id === log.workout_id)
    if (!workout) continue

    // Skip if we already have this from Strava (avoid duplicates)
    const miles = log.actual_miles ? parseFloat(log.actual_miles) : (workout.miles ? parseFloat(workout.miles) : 0)
    if (miles <= 0) continue

    // Check if there's already a Strava entry with similar miles for this workout
    const week = weeks?.find(w => w.id === workout.week_id)
    const alreadyCounted = runs.some(r => Math.abs(r.miles - miles) < 0.5 && r.source === 'strava' && week && r.date && r.date >= (week.created_at || '').split('T')[0])
    if (alreadyCounted) continue

    runs.push({
      date: week?.created_at ? week.created_at.split('T')[0] : '',
      miles,
      pace: log.actual_pace || '',
      duration: log.duration || '',
      durationSeconds: 0,
      avgHr: log.avg_heartrate || null,
      maxHr: log.max_heartrate || null,
      name: workout.training_type || 'Run',
      source: 'programmed',
    })
  }

  // Sort by date descending
  runs.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  // Calculate totals
  const totalMiles = runs.reduce((sum, r) => sum + r.miles, 0)
  const totalRuns = runs.length
  const avgPaceSeconds = runs.length > 0 && runs.some(r => r.durationSeconds > 0)
    ? runs.filter(r => r.durationSeconds > 0).reduce((sum, r) => sum + (r.durationSeconds / r.miles), 0) / runs.filter(r => r.durationSeconds > 0).length
    : 0
  const avgPaceMin = Math.floor(avgPaceSeconds / 60)
  const avgPaceSec = Math.round(avgPaceSeconds % 60)
  const avgPace = avgPaceSeconds > 0 ? `${avgPaceMin}:${avgPaceSec.toString().padStart(2, '0')}` : ''

  // Distance PRs - fastest pace for standard distances
  const distancePRs: { distance: string; miles: number; pace: string; date: string; name: string }[] = []
  const prDistances = [
    { label: '1 Mile', min: 0.9, max: 1.1 },
    { label: '5K', min: 3.0, max: 3.3 },
    { label: '10K', min: 6.0, max: 6.4 },
    { label: 'Half Marathon', min: 13.0, max: 13.3 },
    { label: 'Marathon', min: 26.0, max: 26.4 },
  ]

  for (const dist of prDistances) {
    const matching = runs.filter(r => r.miles >= dist.min && r.miles <= dist.max && r.durationSeconds > 0)
    if (matching.length === 0) continue

    // Find fastest (lowest pace per mile)
    const fastest = matching.reduce((best, r) => {
      const paceSec = r.durationSeconds / r.miles
      const bestPaceSec = best.durationSeconds / best.miles
      return paceSec < bestPaceSec ? r : best
    })

    distancePRs.push({
      distance: dist.label,
      miles: fastest.miles,
      pace: fastest.pace,
      date: fastest.date,
      name: fastest.name,
    })
  }

  // Weekly mileage (last 12 weeks)
  const weeklyMileage: { week: string; miles: number }[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1) - (i * 7))
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    const weekMiles = runs
      .filter(r => r.date >= weekStartStr && r.date <= weekEndStr)
      .reduce((sum, r) => sum + r.miles, 0)

    const label = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    weeklyMileage.push({ week: label, miles: Math.round(weekMiles * 10) / 10 })
  }

  return NextResponse.json({
    totals: {
      totalMiles: Math.round(totalMiles * 10) / 10,
      totalRuns,
      avgPace,
    },
    distancePRs,
    weeklyMileage,
    recentRuns: runs.slice(0, 20).map(r => ({
      date: r.date,
      miles: Math.round(r.miles * 100) / 100,
      pace: r.pace,
      duration: r.duration,
      avgHr: r.avgHr,
      maxHr: r.maxHr,
      name: r.name,
      source: r.source,
    })),
  })
}
