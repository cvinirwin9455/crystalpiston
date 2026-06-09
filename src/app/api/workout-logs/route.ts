import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/workout-logs - Create a workout log (upsert)
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    workoutId,
    status,
    skipReason,
    rpe,
    actualMiles,
    actualPace,
    stress,
    notes,
    onPeriod,
    duration,
    energy,
    motivation,
    sleep,
    strength,
    recovery,
    mood,
    hunger,
  } = body

  if (!workoutId) {
    return NextResponse.json({ error: 'workoutId is required' }, { status: 400 })
  }

  if (!status) {
    return NextResponse.json({ error: 'status is required (complete, partial, skipped)' }, { status: 400 })
  }

  // Use service role to bypass RLS
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Check if a log already exists for this workout (upsert)
  const { data: existing } = await adminClient
    .from('workout_logs')
    .select('id')
    .eq('workout_id', workoutId)
    .single()

  const logData = {
    status,
    skip_reason: skipReason || null,
    rpe: rpe ? parseInt(rpe) : null,
    actual_miles: actualMiles ? parseFloat(actualMiles) : null,
    actual_pace: actualPace || null,
    stress: stress ? parseInt(stress) : null,
    notes: notes || null,
    on_period: onPeriod === 'yes' || onPeriod === true,
    duration: duration || null,
    energy: energy ? parseInt(energy) : null,
    motivation: motivation ? parseInt(motivation) : null,
    sleep: sleep ? parseInt(sleep) : null,
    strength: strength ? parseInt(strength) : null,
    recovery: recovery ? parseInt(recovery) : null,
    mood: mood ? parseInt(mood) : null,
    hunger: hunger ? parseInt(hunger) : null,
  }

  if (existing) {
    // Update existing log
    const { error } = await adminClient
      .from('workout_logs')
      .update(logData)
      .eq('id', existing.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, logId: existing.id, updated: true })
  }

  // Create new log
  const { data: newLog, error } = await adminClient
    .from('workout_logs')
    .insert({ workout_id: workoutId, ...logData })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, logId: newLog.id, updated: false })
}
