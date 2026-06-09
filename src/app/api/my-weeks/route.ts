import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/my-weeks - Get the logged-in client's published weeks
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get the client record for this user
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client record not found' }, { status: 404 })
  }

  // Fetch published weeks with workouts and logs
  const { data: weeks, error } = await supabase
    .from('weeks')
    .select(`
      id,
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
    .eq('client_id', client.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Format for frontend
  const formatted = weeks?.map(w => ({
    weekId: w.id,
    dateRange: w.date_range,
    focus: w.focus || '',
    coachMessage: w.coach_message || '',
    workouts: (w.workouts || [])
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((wo: any) => ({
        id: wo.id,
        day: wo.day,
        type: wo.type || 'run',
        trainingType: wo.training_type || '',
        title: wo.title || '',
        miles: wo.miles ? parseFloat(wo.miles) : null,
        description: wo.description || '',
        paceTarget: wo.pace_target || '',
        location: wo.location || '',
        coachNotes: wo.coach_notes || '',
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
