import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/plans?client_id=xxx - Get all plans for a client
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  if (!clientId) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Try with new columns first, fall back to base columns if they don't exist yet
  let plans: any[] | null = null
  let error: any = null

  const fullResult = await adminClient
    .from('plans')
    .select('id, client_id, start_date, end_date, goal, owed, paid, status, completion_reason, target_distance, race_date, goal_pace, injury_notes, program_template_id, race_date_same_as_end, created_at')
    .eq('client_id', clientId)
    .order('start_date', { ascending: false })

  if (fullResult.error) {
    // Columns may not exist yet — fall back to base columns
    const fallbackResult = await adminClient
      .from('plans')
      .select('id, client_id, start_date, end_date, goal, owed, paid, status, completion_reason, created_at')
      .eq('client_id', clientId)
      .order('start_date', { ascending: false })
    plans = fallbackResult.data
    error = fallbackResult.error
  } else {
    plans = fullResult.data
    error = fullResult.error
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(plans || [])
}

// POST /api/plans - Create a new plan for a client
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
  const { clientId, startDate, endDate, owed, goal, targetDistance, raceDate, goalPace, injuryNotes, programTemplateId, raceDateSameAsEnd } = body

  if (!clientId || !startDate || !endDate) {
    return NextResponse.json({ error: 'clientId, startDate, and endDate are required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  const { data: plan, error } = await adminClient
    .from('plans')
    .insert({
      client_id: clientId,
      start_date: startDate,
      end_date: endDate,
      goal: goal || null,
      owed: owed ? parseFloat(owed) : 0,
      paid: 0,
      status: 'active',
      target_distance: targetDistance || null,
      race_date: raceDate || null,
      goal_pace: goalPace || null,
      injury_notes: injuryNotes || null,
      program_template_id: programTemplateId || null,
      race_date_same_as_end: raceDateSameAsEnd !== undefined ? raceDateSameAsEnd : true,
    })
    .select()
    .single()

  // If insert failed (columns may not exist), retry with base columns only
  if (error) {
    const fallback = await adminClient
      .from('plans')
      .insert({
        client_id: clientId,
        start_date: startDate,
        end_date: endDate,
        goal: goal || null,
        owed: owed ? parseFloat(owed) : 0,
        paid: 0,
        status: 'active',
      })
      .select()
      .single()

    if (fallback.error) {
      return NextResponse.json({ error: fallback.error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, plan: fallback.data })
  }

  return NextResponse.json({ success: true, plan })
}

// PATCH /api/plans - Update a plan (payment, status, dates)
export async function PATCH(request: Request) {
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
  const { planId, startDate, endDate, owed, paid, status, completionReason, goal, targetDistance, raceDate, goalPace, injuryNotes, programTemplateId, raceDateSameAsEnd } = body

  if (!planId) {
    return NextResponse.json({ error: 'planId is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  const updates: Record<string, any> = {}
  if (startDate !== undefined) updates.start_date = startDate
  if (endDate !== undefined) updates.end_date = endDate
  if (owed !== undefined) updates.owed = parseFloat(owed)
  if (paid !== undefined) updates.paid = parseFloat(paid)
  if (status !== undefined) updates.status = status
  if (completionReason !== undefined) updates.completion_reason = completionReason
  if (goal !== undefined) updates.goal = goal || null
  if (targetDistance !== undefined) updates.target_distance = targetDistance || null
  if (raceDate !== undefined) updates.race_date = raceDate || null
  if (goalPace !== undefined) updates.goal_pace = goalPace || null
  if (injuryNotes !== undefined) updates.injury_notes = injuryNotes || null
  if (programTemplateId !== undefined) updates.program_template_id = programTemplateId || null
  if (raceDateSameAsEnd !== undefined) updates.race_date_same_as_end = raceDateSameAsEnd

  let { error } = await adminClient
    .from('plans')
    .update(updates)
    .eq('id', planId)

  // If the update failed (e.g. completion_reason column doesn't exist yet), retry without it
  if (error && updates.completion_reason !== undefined) {
    const fallbackUpdates = { ...updates }
    delete fallbackUpdates.completion_reason
    const result = await adminClient
      .from('plans')
      .update(fallbackUpdates)
      .eq('id', planId)
    error = result.error
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
