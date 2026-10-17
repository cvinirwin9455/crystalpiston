import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { hasCoachAccess } from '@/lib/roles'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/session-packages?client_id=xxx - Get packages and balance for a client
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  // Optional: scope to a single plan's packages (per-plan isolation). When
  // provided, purchased/paid/owed reflect ONLY that plan's packages, and
  // "remaining" is that plan's purchased minus used (capped at purchased).
  const planId = searchParams.get('plan_id')

  if (!clientId) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Fetch all packages for the client
  // Try selecting the richest column set first, peeling optional columns
  // (plan_id, status, amount_owed) that may not exist in a given DB yet.
  // When plan_id is requested we need it in the select to filter.
  let packages: any[] | null = null
  let pkgError: any = null
  let planScoped = false // did we actually filter by plan_id?
  const selectVariants = [
    'id, plan_id, sessions_purchased, amount_paid, amount_owed, status, notes, purchased_at',
    'id, sessions_purchased, amount_paid, amount_owed, status, notes, purchased_at',
    'id, sessions_purchased, amount_paid, amount_owed, notes, purchased_at',
    'id, sessions_purchased, amount_paid, notes, purchased_at',
  ]
  for (const sel of selectVariants) {
    let q = adminClient
      .from('session_packages')
      .select(sel)
      .eq('client_id', clientId)
    // Only filter by plan_id if the select includes plan_id (first variant).
    const canScope = planId && sel.includes('plan_id')
    if (canScope) q = q.eq('plan_id', planId)
    const attempt = await q.order('purchased_at', { ascending: false })
    if (!attempt.error) {
      packages = attempt.data
      pkgError = null
      planScoped = !!canScope
      break
    }
    pkgError = attempt.error
  }

  if (pkgError) {
    // Table may not exist yet
    return NextResponse.json({ packages: [], sessionsRemaining: 0 })
  }

  // Purchased = active packages in the current scope (this plan, or client-wide).
  const totalPurchased = (packages || [])
    .filter((p: any) => (p.status ?? 'active') === 'active')
    .reduce((sum: number, p: any) => sum + (p.sessions_purchased || 0), 0)

  // Used sessions are tracked client-wide (not plan-linked).
  const { count: usedCount } = await adminClient
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .in('status', ['completed', 'cancelled_charged', 'no_show'])
  const used = usedCount || 0

  let sessionsRemaining = 0
  if (planScoped) {
    // Per-plan: this plan's purchased minus used, capped at the plan's
    // purchased (used is client-wide so it can't drive remaining negative
    // for this plan, nor exceed what this plan sold).
    sessionsRemaining = Math.max(0, totalPurchased - Math.min(used, totalPurchased))
  } else {
    // Client-wide: prefer the balance view, else compute manually.
    const { data: balance, error: balanceError } = await adminClient
      .from('client_session_balances')
      .select('sessions_remaining')
      .eq('client_id', clientId)
      .single()
    sessionsRemaining = !balanceError && balance
      ? (balance.sessions_remaining ?? 0)
      : totalPurchased - used
  }

  return NextResponse.json({
    packages: packages || [],
    sessionsRemaining,
  })
}

// POST /api/session-packages - Add a new session package
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, has_coach_access')
    .eq('id', user.id)
    .single()

  if (!hasCoachAccess(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { clientId, planId, sessionsPurchased, amountPaid, amountOwed, notes } = body

  if (!clientId || !sessionsPurchased || sessionsPurchased <= 0) {
    return NextResponse.json({ error: 'clientId and sessionsPurchased (>0) are required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Get client's organization_id
  const { data: client } = await adminClient
    .from('clients')
    .select('organization_id')
    .eq('id', clientId)
    .single()

  const orgId = client?.organization_id || user.id

  const insertData: any = {
    client_id: clientId,
    organization_id: orgId,
    coach_id: user.id,
    sessions_purchased: parseInt(sessionsPurchased),
    amount_paid: amountPaid ? parseFloat(amountPaid) : 0,
    notes: notes || null,
  }
  if (planId) insertData.plan_id = planId
  // amount_owed defaults to amountPaid if not provided (backwards compatible)
  const owedValue = amountOwed !== undefined && amountOwed !== null && amountOwed !== ''
    ? parseFloat(amountOwed)
    : (amountPaid ? parseFloat(amountPaid) : 0)

  // Insert with the richest column set, peeling optional columns
  // (amount_owed, then plan_id) that may not exist on older schemas.
  let pkg: any = null
  let error: any = null
  const fullInsert = await adminClient
    .from('session_packages')
    .insert({ ...insertData, amount_owed: owedValue })
    .select()
    .single()

  if (!fullInsert.error) {
    pkg = fullInsert.data
  } else {
    // Retry without amount_owed.
    const noOwed = await adminClient
      .from('session_packages')
      .insert(insertData)
      .select()
      .single()
    if (!noOwed.error) {
      pkg = noOwed.data
    } else {
      // Retry without plan_id too (oldest schemas).
      const { plan_id, ...noPlan } = insertData
      const noPlanInsert = await adminClient
        .from('session_packages')
        .insert(noPlan)
        .select()
        .single()
      pkg = noPlanInsert.data
      error = noPlanInsert.error
    }
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, package: pkg })
}

// PATCH /api/session-packages - Log a payment against a package (increment amount_paid)
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, has_coach_access')
    .eq('id', user.id)
    .single()

  if (!hasCoachAccess(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { packageId, paymentAmount, action, clientId, planId } = body

  const adminClient = await getAdminClient()

  // --- Status actions: close out / reopen a client's session packages ---
  // Used when a coach completes a per-session/hybrid plan and chooses what to
  // do with unused sessions. 'close_all' marks the client's active packages
  // inactive (balance -> 0); 'reopen_all' brings closed packages back.
  if (action === 'close_all' || action === 'reopen_all') {
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required for this action' }, { status: 400 })
    }
    const from = action === 'close_all' ? 'active' : 'closed'
    const to = action === 'close_all' ? 'closed' : 'active'
    let q = adminClient
      .from('session_packages')
      .update({ status: to })
      .eq('client_id', clientId)
      .eq('status', from)
    // Scope to a single plan's packages when a planId is provided, so
    // completing one plan doesn't close packages belonging to another.
    if (planId) q = q.eq('plan_id', planId)
    const { data: updated, error: statusErr } = await q.select('id')

    if (statusErr) {
      // status column may not exist yet — surface a clear message
      return NextResponse.json(
        { error: 'Could not update session packages. Run RUN_THIS_session_package_status.sql first.', detail: statusErr.message },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true, updated: updated?.length ?? 0 })
  }

  // --- Default: log a payment against a package (increment amount_paid) ---
  if (!packageId || !paymentAmount) {
    return NextResponse.json({ error: 'packageId and paymentAmount are required' }, { status: 400 })
  }

  // Get current amount_paid
  const { data: pkg, error: fetchErr } = await adminClient
    .from('session_packages')
    .select('amount_paid')
    .eq('id', packageId)
    .single()

  if (fetchErr || !pkg) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  }

  const newPaid = (parseFloat(pkg.amount_paid) || 0) + parseFloat(paymentAmount)

  const { error } = await adminClient
    .from('session_packages')
    .update({ amount_paid: newPaid })
    .eq('id', packageId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, newAmountPaid: newPaid })
}
