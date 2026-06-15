import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/my-weeks - Get the logged-in client's published weeks
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service role to bypass RLS
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get the client record for this user
  const { data: client } = await adminClient
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client record not found' }, { status: 404 })
  }

  // Fetch published weeks
  const { data: weeks, error: weeksError } = await adminClient
    .from('weeks')
    .select('id, date_range, focus, coach_message, status, created_at')
    .eq('client_id', client.id)
    .eq('status', 'published')
    .order('date_range', { ascending: true })

  if (weeksError) {
    return NextResponse.json({ error: weeksError.message }, { status: 500 })
  }

  if (!weeks || weeks.length === 0) {
    return NextResponse.json([])
  }

  // Fetch all workouts for these weeks
  const weekIds = weeks.map(w => w.id)
  const { data: workouts } = await adminClient
    .from('workouts')
    .select('id, week_id, day, type, training_type, title, miles, description, pace_target, location, coach_notes, sort_order, distance_unit, distance_unit')
    .in('week_id', weekIds)
    .order('sort_order', { ascending: true })

  // Fetch all workout logs for these workouts
  const workoutIds = (workouts || []).map(wo => wo.id)
  let logs: any[] = []
  if (workoutIds.length > 0) {
    const { data: logsData } = await adminClient
      .from('workout_logs')
      .select('id, workout_id, status, skip_reason, rpe, actual_miles, actual_pace, stress, notes, on_period, duration, energy, motivation, sleep, strength, recovery, mood, hunger')
      .in('workout_id', workoutIds)
    logs = logsData || []
  }

  // Build lookup maps
  const logsByWorkoutId = new Map<string, any>()
  for (const log of logs) {
    logsByWorkoutId.set(log.workout_id, log)
  }

  const workoutsByWeekId = new Map<string, any[]>()
  for (const wo of workouts || []) {
    if (!workoutsByWeekId.has(wo.week_id)) {
      workoutsByWeekId.set(wo.week_id, [])
    }
    workoutsByWeekId.get(wo.week_id)!.push(wo)
  }

  // Fetch client-added workouts for these weeks
  let clientWorkoutsByWeekId = new Map<string, any[]>()
  if (weekIds.length > 0) {
    const { data: clientWorkouts } = await adminClient
      .from('client_workouts')
      .select('id, week_id, day, type, training_type, miles, notes, created_at')
      .in('week_id', weekIds)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    
    for (const cw of clientWorkouts || []) {
      if (!clientWorkoutsByWeekId.has(cw.week_id)) {
        clientWorkoutsByWeekId.set(cw.week_id, [])
      }
      clientWorkoutsByWeekId.get(cw.week_id)!.push(cw)
    }
  }

  // Format response
  const formatted = weeks.map(w => {
    const weekWorkouts = workoutsByWeekId.get(w.id) || []
    const weekClientWorkouts = clientWorkoutsByWeekId.get(w.id) || []
    return {
      weekId: w.id,
      dateRange: w.date_range,
      focus: w.focus || '',
      coachMessage: w.coach_message || '',
      clientWorkouts: weekClientWorkouts.map(cw => ({
        id: cw.id,
        day: cw.day,
        type: cw.type,
        trainingType: cw.training_type,
        miles: cw.miles ? parseFloat(cw.miles) : null,
        notes: cw.notes,
        createdAt: cw.created_at,
        isClientAdded: true,
      })),
      workouts: weekWorkouts.map(wo => {
        const log = logsByWorkoutId.get(wo.id)
        return {
          id: wo.id,
          day: wo.day,
          type: wo.type || 'run',
          trainingType: wo.training_type || '',
          title: wo.title || '',
          miles: wo.miles ? parseFloat(wo.miles) : null,
          distanceUnit: wo.distance_unit || 'mi',
          description: wo.description || '',
          paceTarget: wo.pace_target || '',
          location: wo.location || '',
          coachNotes: wo.coach_notes || '',
          completed: !!log,
          status: log?.status || null,
          skipReason: log?.skip_reason || null,
          log: log ? {
            rpe: log.rpe?.toString() || '',
            stress: log.stress?.toString() || '',
            notes: log.notes || '',
            energy: log.energy?.toString() || '',
            motivation: log.motivation?.toString() || '',
            sleep: log.sleep?.toString() || '',
            strength: log.strength?.toString() || '',
            recovery: log.recovery?.toString() || '',
            mood: log.mood?.toString() || '',
            hunger: log.hunger?.toString() || '',
            actualMiles: log.actual_miles?.toString() || '',
            actualPace: log.actual_pace || '',
            onPeriod: log.on_period ? 'yes' : 'no',
            duration: log.duration || '',
          } : undefined,
        }
      }),
    }
  })

  return NextResponse.json(formatted)
}
