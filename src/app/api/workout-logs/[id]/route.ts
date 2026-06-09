import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/workout-logs/[id] - Update an existing workout log
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const logId = params.id
  const body = await request.json()

  const updates: Record<string, any> = {}
  if (body.status !== undefined) updates.status = body.status
  if (body.skipReason !== undefined) updates.skip_reason = body.skipReason || null
  if (body.rpe !== undefined) updates.rpe = body.rpe ? parseInt(body.rpe) : null
  if (body.actualMiles !== undefined) updates.actual_miles = body.actualMiles ? parseFloat(body.actualMiles) : null
  if (body.actualPace !== undefined) updates.actual_pace = body.actualPace || null
  if (body.stress !== undefined) updates.stress = body.stress ? parseInt(body.stress) : null
  if (body.notes !== undefined) updates.notes = body.notes || null
  if (body.onPeriod !== undefined) updates.on_period = body.onPeriod === 'yes' || body.onPeriod === true
  if (body.duration !== undefined) updates.duration = body.duration || null
  if (body.energy !== undefined) updates.energy = body.energy ? parseInt(body.energy) : null
  if (body.motivation !== undefined) updates.motivation = body.motivation ? parseInt(body.motivation) : null
  if (body.sleep !== undefined) updates.sleep = body.sleep ? parseInt(body.sleep) : null
  if (body.strength !== undefined) updates.strength = body.strength ? parseInt(body.strength) : null
  if (body.recovery !== undefined) updates.recovery = body.recovery ? parseInt(body.recovery) : null
  if (body.mood !== undefined) updates.mood = body.mood ? parseInt(body.mood) : null
  if (body.hunger !== undefined) updates.hunger = body.hunger ? parseInt(body.hunger) : null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Use service role to bypass RLS
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await adminClient
    .from('workout_logs')
    .update(updates)
    .eq('id', logId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
