// Shared "turn a package into a client plan (+ payment)" logic.
//
// A coach_packages row is a reusable PLAN RECIPE: it carries the same inputs a
// per-client plan needs (price/owed, billing_mode, duration, session bundle,
// optional program template). This module stamps that recipe out onto a client
// so that an application-provisioned client ends up with the EXACT same
// structure as a manually-created one:
//   * a `plans` row (owed = package price, billing_mode, dates, program_template_id)
//   * a `session_packages` row for per_session / hybrid packages
//   * clients.billing_mode updated
//   * (optionally) a `payments` row recording money collected, bumping plans.paid
//
// Used by BOTH:
//   * provision-client.ts (coach manually accepts an application, no Stripe)
//   * fulfill-payment.ts  (Stripe payment succeeds)
//
// `admin` must be a service-role Supabase client.

type Package = {
  id: string
  coach_id: string
  organization_id: string | null
  name: string | null
  price_cents: number
  currency?: string | null
  billing_interval?: string | null
  program_template_id?: string | null
  billing_mode?: 'programming_only' | 'per_session' | 'hybrid' | null
  duration_weeks?: number | null
  session_count?: number | null
  session_cost?: number | string | null
  programming_cost?: number | string | null
}

export type PlanFromPackageResult = {
  ok: boolean
  planId?: string
  error?: string
}

function toNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

// Fetch a coach_packages row by id (service-role).
export async function loadPackage(admin: any, packageId: string): Promise<Package | null> {
  const { data } = await admin
    .from('coach_packages')
    .select('*')
    .eq('id', packageId)
    .maybeSingle()
  return (data as Package) || null
}

// Compute the plan's `owed` from a package, mirroring POST /api/plans:
//   per_session     -> 0 (money lives on the session package)
//   hybrid          -> programming_cost (fallback: package price)
//   programming_only-> programming_cost (fallback: package price)
function planOwedFromPackage(pkg: Package): number {
  const billingMode = pkg.billing_mode || 'programming_only'
  const priceDollars = toNumber(pkg.price_cents) / 100
  const programmingCost =
    pkg.programming_cost != null && String(pkg.programming_cost) !== ''
      ? toNumber(pkg.programming_cost)
      : priceDollars
  if (billingMode === 'per_session') return 0
  // hybrid + programming_only both use the programming cost as owed.
  return programmingCost
}

// Create a plan (+ session package) for a client from a package recipe.
// Idempotent-ish: callers guard against double-creation via payment_requests.plan_id.
export async function createPlanFromPackage(
  admin: any,
  params: {
    clientId: string
    coachId: string
    organizationId?: string | null
    pkg: Package
    application?: any // optional coach_applications row for goal/race fields
  }
): Promise<PlanFromPackageResult> {
  const { clientId, coachId, pkg, application } = params
  const organizationId = params.organizationId ?? pkg.organization_id ?? null
  const billingMode = pkg.billing_mode || 'programming_only'

  // Dates: start today; end today + duration_weeks (default 1 week so the
  // required NOT NULL end_date is always populated). per_session has no span.
  const today = new Date()
  const startDate = today.toISOString().split('T')[0]
  let endDate = startDate
  if (billingMode !== 'per_session') {
    const weeks = pkg.duration_weeks && pkg.duration_weeks > 0 ? pkg.duration_weeks : 1
    const end = new Date(today)
    end.setDate(end.getDate() + weeks * 7)
    endDate = end.toISOString().split('T')[0]
  }

  const owed = planOwedFromPackage(pkg)
  const hasProgram = !!pkg.program_template_id

  // Goal/race metadata from the application, when available.
  const goal = application?.primary_goal || application?.pt_goal || null
  const targetDistance = application?.target_race || null
  const injuryNotes = application?.injuries || null

  // Build the plan row. Use fallbacks (like /api/plans) so older schemas that
  // lack the newer columns still get a plan created.
  const fullInsert: Record<string, any> = {
    client_id: clientId,
    start_date: startDate,
    end_date: endDate,
    goal,
    owed,
    paid: 0,
    status: 'active',
    target_distance: targetDistance,
    injury_notes: injuryNotes,
    program_template_id: pkg.program_template_id || null,
    billing_mode: billingMode,
    source_package_id: pkg.id,
    // If there's a program template, it still needs loading onto the client;
    // if there's none, mark as "loaded" so no indicator shows.
    program_loaded: !hasProgram,
  }

  let plan: any = null
  const attempt1 = await admin.from('plans').insert(fullInsert).select('id').single()
  if (!attempt1.error) {
    plan = attempt1.data
  } else {
    // Retry without the newest columns (source_package_id / program_loaded).
    const mid = { ...fullInsert }
    delete mid.source_package_id
    delete mid.program_loaded
    const attempt2 = await admin.from('plans').insert(mid).select('id').single()
    if (!attempt2.error) {
      plan = attempt2.data
    } else {
      // Retry without billing_mode.
      const mid2 = { ...mid }
      delete mid2.billing_mode
      const attempt3 = await admin.from('plans').insert(mid2).select('id').single()
      if (!attempt3.error) {
        plan = attempt3.data
      } else {
        // Last resort: base columns only.
        const base = await admin
          .from('plans')
          .insert({
            client_id: clientId,
            start_date: startDate,
            end_date: endDate,
            goal,
            owed,
            paid: 0,
            status: 'active',
          })
          .select('id')
          .single()
        if (base.error) return { ok: false, error: base.error.message }
        plan = base.data
      }
    }
  }

  // Session bundle for per_session / hybrid packages.
  if ((billingMode === 'per_session' || billingMode === 'hybrid') && (pkg.session_count || 0) > 0) {
    const orgId = organizationId || coachId
    const owedValue = toNumber(pkg.session_cost)
    const spInsert: Record<string, any> = {
      client_id: clientId,
      organization_id: orgId,
      coach_id: coachId,
      sessions_purchased: pkg.session_count,
      amount_paid: 0,
      notes: `Initial package from "${pkg.name || 'package'}"`,
    }
    const spFull = await admin.from('session_packages').insert({ ...spInsert, amount_owed: owedValue })
    if (spFull.error) {
      // amount_owed may not exist on older schemas — fall back.
      await admin.from('session_packages').insert({ ...spInsert, amount_paid: owedValue })
    }
  }

  // Keep clients.billing_mode in sync (same as /api/plans).
  if (billingMode && billingMode !== 'programming_only') {
    try {
      await admin.from('clients').update({ billing_mode: billingMode }).eq('id', clientId)
    } catch {
      /* column may not exist yet */
    }
  }

  return { ok: true, planId: plan.id }
}

// Record a payment against a plan and bump plans.paid — the same shape the
// coach's "Log Payment" UI writes, so Stripe/offline payments appear in the
// client's payment history identically.
//
// `paymentRequestId` (optional) links the payment to its Stripe request AND
// guards against double-recording (unique index on payments.payment_request_id).
export async function recordProgrammingPayment(
  admin: any,
  params: {
    planId: string
    clientId: string
    amount: number
    notes?: string
    packageId?: string | null
    paymentRequestId?: string | null
  }
): Promise<{ ok: boolean; paymentId?: string; error?: string }> {
  const { planId, clientId, amount } = params
  if (!(amount > 0)) return { ok: true } // nothing collected yet (e.g. offline, $0)

  // If this payment_request already produced a payment, don't double-record.
  if (params.paymentRequestId) {
    const { data: existing } = await admin
      .from('payments')
      .select('id')
      .eq('payment_request_id', params.paymentRequestId)
      .maybeSingle()
    if (existing) return { ok: true, paymentId: existing.id }
  }

  const base: Record<string, any> = {
    plan_id: planId,
    amount,
    payment_date: new Date().toISOString().split('T')[0],
    notes: params.notes || null,
  }

  let payment: any = null
  const full = await admin
    .from('payments')
    .insert({
      ...base,
      payment_type: 'programming',
      client_id: clientId,
      package_id: params.packageId || null,
      payment_request_id: params.paymentRequestId || null,
    })
    .select('id')
    .single()
  if (!full.error) {
    payment = full.data
  } else {
    // Legacy fallback: base columns only.
    const legacy = await admin.from('payments').insert(base).select('id').single()
    if (legacy.error) return { ok: false, error: legacy.error.message }
    payment = legacy.data
  }

  // Bump the running total on the plan.
  const { data: plan } = await admin.from('plans').select('paid').eq('id', planId).single()
  const newPaid = toNumber(plan?.paid) + amount
  await admin.from('plans').update({ paid: newPaid }).eq('id', planId)

  return { ok: true, paymentId: payment?.id }
}
