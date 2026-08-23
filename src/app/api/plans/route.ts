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

  // Try full query with billing_mode
  const fullResult = await adminClient
    .from('plans')
    .select('id, client_id, start_date, end_date, goal, owed, paid, status, completion_reason, target_distance, race_date, goal_pace, injury_notes, program_template_id, billing_mode, created_at')
    .eq('client_id', clientId)
    .order('start_date', { ascending: false })

  if (fullResult.error) {
    // billing_mode column may not exist — try without it
    const midResult = await adminClient
      .from('plans')
      .select('id, client_id, start_date, end_date, goal, owed, paid, status, completion_reason, target_distance, race_date, goal_pace, injury_notes, program_template_id, created_at')
      .eq('client_id', clientId)
      .order('start_date', { ascending: false })

    if (midResult.error) {
      // Fall back to base columns only
      const fallbackResult = await adminClient
        .from('plans')
        .select('id, client_id, start_date, end_date, goal, owed, paid, status, completion_reason, created_at')
        .eq('client_id', clientId)
        .order('start_date', { ascending: false })
      plans = fallbackResult.data
      error = fallbackResult.error
    } else {
      plans = midResult.data
      error = midResult.error
    }
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
  const { clientId, startDate, endDate, owed, goal, targetDistance, raceDate, goalPace, injuryNotes, programTemplateId, billingMode, sessionCount, sessionCost, perSessionCost, programmingCost } = body

  // Dates are required for programming_only and hybrid, but not per_session
  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }
  if (billingMode !== 'per_session' && (!startDate || !endDate)) {
    return NextResponse.json({ error: 'startDate and endDate are required for this billing mode' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Determine the plan cost (owed) based on billing mode
  let planOwed = owed ? parseFloat(owed) : 0
  if (billingMode === 'per_session') {
    planOwed = 0 // per_session clients don't have a programming cost
  } else if (billingMode === 'hybrid') {
    planOwed = programmingCost ? parseFloat(programmingCost) : 0
  } else if (billingMode === 'programming_only') {
    planOwed = programmingCost ? parseFloat(programmingCost) : (owed ? parseFloat(owed) : 0)
  }

  // For per_session mode without explicit dates, use today as start
  const effectiveStartDate = startDate || new Date().toISOString().split('T')[0]
  const effectiveEndDate = endDate || null

  // Try inserting with billing_mode column
  const { data: plan, error } = await adminClient
    .from('plans')
    .insert({
      client_id: clientId,
      start_date: effectiveStartDate,
      end_date: effectiveEndDate || effectiveStartDate,
      goal: goal || null,
      owed: planOwed,
      paid: 0,
      status: 'active',
      target_distance: targetDistance || null,
      race_date: raceDate || null,
      goal_pace: goalPace || null,
      injury_notes: injuryNotes || null,
      program_template_id: programTemplateId || null,
      billing_mode: billingMode || 'programming_only',
    })
    .select()
    .single()

  // If insert failed (billing_mode column may not exist yet), retry without it
  if (error) {
    const fallback = await adminClient
      .from('plans')
      .insert({
        client_id: clientId,
        start_date: effectiveStartDate,
        end_date: effectiveEndDate || effectiveStartDate,
        goal: goal || null,
        owed: planOwed,
        paid: 0,
        status: 'active',
        target_distance: targetDistance || null,
        race_date: raceDate || null,
        goal_pace: goalPace || null,
        injury_notes: injuryNotes || null,
        program_template_id: programTemplateId || null,
      })
      .select()
      .single()

    if (fallback.error) {
      // Last resort: base columns only
      const baseFallback = await adminClient
        .from('plans')
        .insert({
          client_id: clientId,
          start_date: effectiveStartDate,
          end_date: effectiveEndDate || effectiveStartDate,
          goal: goal || null,
          owed: planOwed,
          paid: 0,
          status: 'active',
        })
        .select()
        .single()

      if (baseFallback.error) {
        return NextResponse.json({ error: baseFallback.error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, plan: baseFallback.data })
    }

    // Plan created without billing_mode column — still create session package if needed
    const createdPlan = fallback.data
    await createSessionPackageIfNeeded(adminClient, user.id, clientId, billingMode, sessionCount, sessionCost)
    await updateClientBillingMode(adminClient, clientId, billingMode)
    return NextResponse.json({ success: true, plan: createdPlan })
  }

  // Plan created successfully with billing_mode — create session package if needed
  await createSessionPackageIfNeeded(adminClient, user.id, clientId, billingMode, sessionCount, sessionCost)
  await updateClientBillingMode(adminClient, clientId, billingMode)

  return NextResponse.json({ success: true, plan })
}

// Helper: create initial session package when billing mode includes sessions
async function createSessionPackageIfNeeded(adminClient: any, coachId: string, clientId: string, billingMode: string, sessionCount: number, sessionCost: string) {
  if ((billingMode === 'per_session' || billingMode === 'hybrid') && sessionCount > 0) {
    // Get the client's organization_id
    const { data: client } = await adminClient
      .from('clients')
      .select('organization_id')
      .eq('id', clientId)
      .single()

    const orgId = client?.organization_id || coachId // fallback to coach id if no org

    await adminClient
      .from('session_packages')
      .insert({
        client_id: clientId,
        organization_id: orgId,
        coach_id: coachId,
        sessions_purchased: sessionCount,
        amount_paid: sessionCost ? parseFloat(sessionCost) : 0,
        notes: 'Initial package from plan creation',
      })
  }
}

// Helper: update client's billing_mode field
async function updateClientBillingMode(adminClient: any, clientId: string, billingMode: string) {
  if (billingMode && billingMode !== 'programming_only') {
    // Only update if it's not the default, to avoid errors if column doesn't exist
    try {
      await adminClient
        .from('clients')
        .update({ billing_mode: billingMode })
        .eq('id', clientId)
    } catch {
      // Silently ignore — column may not exist yet
    }
  }
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
  const { planId, startDate, endDate, owed, paid, status, completionReason, goal, targetDistance, raceDate, goalPace, injuryNotes, programTemplateId } = body

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

  let { error } = await adminClient
    .from('plans')
    .update(updates)
    .eq('id', planId)

  // If the update failed, retry without completion_reason (older schemas)
  if (error) {
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
