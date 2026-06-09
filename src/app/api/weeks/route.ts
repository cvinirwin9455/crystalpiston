import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/weeks?client_id=xxx - Get all weeks for a client
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  if (!clientId) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  const { data: weeks, error } = await supabase
    .from('weeks')
    .select(`
      id,
      client_id,
      date_range,
      focus,
      coach_message,
      status,
      created_at,
      workouts (
        id,
        day,
        type,
        training_type,
        title,
        miles,
        description,
        pace_target,
        location,
        coach_notes,
        sort_order,
        workout_logs (
          id,
          status,
          skip_reason,
          rpe,
          actual_miles,
          actual_pace,
          stress,
          notes,
          on_period,
          duration,
          energy,
          motivation,
          sleep,
          strength,
          recovery,
          mood,
          hunger
        )
      )
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Format response
  const formatted = weeks?.map(w => ({
    weekId: w.id,
    clientId: w.client_id,
    dateRange: w.date_range,
    focus: w.focus,
    coachMessage: w.coach_message,
    status: w.status,
    createdAt: w.created_at,
    workouts: (w.workouts || [])
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((wo: any) => ({
        id: wo.id,
        day: wo.day,
        type: wo.type,
        trainingType: wo.training_type,
        title: wo.title,
        miles: wo.miles ? parseFloat(wo.miles) : null,
        description: wo.description,
        paceTarget: wo.pace_target,
        location: wo.location,
        coachNotes: wo.coach_notes,
        sortOrder: wo.sort_order,
        completed: wo.workout_logs && wo.workout_logs.length > 0,
        status: wo.workout_logs?.[0]?.status || null,
        skipReason: wo.workout_logs?.[0]?.skip_reason || null,
        log: wo.workout_logs?.[0] ? {
          rpe: wo.workout_logs[0].rpe?.toString() || '',
          stress: wo.workout_logs[0].stress?.toString() || '',
          notes: wo.workout_logs[0].notes || '',
          energy: wo.workout_logs[0].energy?.toString() || '',
          motivation: wo.workout_logs[0].motivation?.toString() || '',
          sleep: wo.workout_logs[0].sleep?.toString() || '',
          strength: wo.workout_logs[0].strength?.toString() || '',
          recovery: wo.workout_logs[0].recovery?.toString() || '',
          mood: wo.workout_logs[0].mood?.toString() || '',
          hunger: wo.workout_logs[0].hunger?.toString() || '',
          actualMiles: wo.workout_logs[0].actual_miles?.toString() || '',
          actualPace: wo.workout_logs[0].actual_pace || '',
          onPeriod: wo.workout_logs[0].on_period ? 'yes' : 'no',
          duration: wo.workout_logs[0].duration || '',
        } : undefined,
      })),
  })) || []

  return NextResponse.json(formatted)
}

// POST /api/weeks - Create a new week with workouts
export async function POST(request: Request) {
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

  const body = await request.json()
  const { clientId, dateRange, focus, coachMessage, status, workouts } = body

  if (!clientId || !dateRange) {
    return NextResponse.json({ error: 'clientId and dateRange are required' }, { status: 400 })
  }

  // Create the week
  const { data: week, error: weekError } = await supabase
    .from('weeks')
    .insert({
      client_id: clientId,
      date_range: dateRange,
      focus: focus || null,
      coach_message: coachMessage || null,
      status: status || 'draft',
    })
    .select()
    .single()

  if (weekError) {
    return NextResponse.json({ error: weekError.message }, { status: 500 })
  }

  // Create workouts if provided
  if (workouts && workouts.length > 0) {
    const workoutRows = workouts.map((w: any, index: number) => ({
      week_id: week.id,
      day: w.day,
      type: w.type || 'run',
      training_type: w.trainingType || null,
      title: w.title || null,
      miles: w.miles ? parseFloat(w.miles) : null,
      description: w.description || null,
      pace_target: w.paceTarget || null,
      location: w.location || null,
      coach_notes: w.coachNotes || null,
      sort_order: index,
    }))

    const { error: workoutsError } = await supabase
      .from('workouts')
      .insert(workoutRows)

    if (workoutsError) {
      return NextResponse.json({ error: workoutsError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, weekId: week.id })
}
