import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveCoachRequestScope } from '@/lib/coach-scope'

// Authenticated CRUD for a coach's packages (the offerings they charge for).
//   GET    /api/coach-packages            -> list the coach's packages
//   POST   /api/coach-packages            -> create a package
//   PATCH  /api/coach-packages            -> update a package (body.id)
//   DELETE /api/coach-packages?id=<id>    -> delete a package
//
// Super-admin "view as coach" is honored via ?org=&coach= (GET/DELETE) or
// org/coach in the body (POST/PATCH), resolved through resolveCoachRequestScope
// (overrides allowed for super admins only). All reads/writes are scoped to the
// resolved coachId.

async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const VALID_INTERVALS = ['monthly', 'one_time']
const VALID_BILLING_MODES = ['programming_only', 'per_session', 'hybrid']
const VALID_MONTHLY_PRICING = ['direct', 'split']

// Parse a dollar amount into a NUMERIC-friendly number, or null if blank/invalid.
function parseAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const cleaned = String(raw).replace(/[^0-9.]/g, '')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// Parse a positive integer, or null if blank/invalid.
function parsePositiveInt(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10)
  return Number.isInteger(n) && n > 0 ? n : null
}

// Parse a user-entered price (e.g. "125", "125.00", "$1,250.50") into integer
// cents. Returns null if it can't be parsed to a non-negative amount.
function parsePriceToCents(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const cleaned = String(raw).replace(/[^0-9.]/g, '')
  if (cleaned === '') return null
  const dollars = Number(cleaned)
  if (!Number.isFinite(dollars) || dollars < 0) return null
  return Math.round(dollars * 100)
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const orgOverride = searchParams.get('org')
  const coachOverride = searchParams.get('coach')

  const admin = await createAdminClient()
  const scopeResult = await resolveCoachRequestScope(admin, user.id, orgOverride, coachOverride)
  if (!scopeResult.scope) {
    return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  }
  const { coachId } = scopeResult.scope

  const { data, error } = await admin
    .from('coach_packages')
    .select('*')
    .eq('coach_id', coachId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ packages: data || [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const {
    name, description, price, currency, billing_interval,
    includes_running, includes_strength, includes_in_person, includes_programming,
    client_cap, is_active, sort_order,
    program_template_id, billing_mode, duration_weeks, session_count, session_cost, programming_cost, recur_months,
    monthly_pricing_mode,
    org: orgOverride, coach: coachOverride,
  } = body || {}

  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: 'Package name is required' }, { status: 400 })
  }
  const priceCents = parsePriceToCents(price)
  if (priceCents === null) {
    return NextResponse.json({ error: 'A valid price is required' }, { status: 400 })
  }
  const interval = VALID_INTERVALS.includes(billing_interval) ? billing_interval : 'monthly'
  const mode = VALID_BILLING_MODES.includes(billing_mode) ? billing_mode : 'programming_only'

  const admin = await createAdminClient()
  const scopeResult = await resolveCoachRequestScope(admin, user.id, orgOverride, coachOverride)
  if (!scopeResult.scope) {
    return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  }
  const { coachId, organizationId } = scopeResult.scope

  const insert: Record<string, any> = {
    coach_id: coachId,
    organization_id: organizationId || null,
    name: String(name).trim(),
    description: description ? String(description).trim() : null,
    price_cents: priceCents,
    currency: currency ? String(currency).toLowerCase() : 'usd',
    billing_interval: interval,
    includes_running: includes_running !== false,
    includes_strength: !!includes_strength,
    includes_in_person: !!includes_in_person,
    includes_programming: includes_programming !== false,
    client_cap: Number.isInteger(client_cap) && client_cap > 0 ? client_cap : null,
    is_active: is_active === undefined ? true : !!is_active,
    sort_order: Number.isInteger(sort_order) ? sort_order : 0,
    // Plan-recipe fields
    program_template_id: program_template_id || null,
    billing_mode: mode,
    duration_weeks: parsePositiveInt(duration_weeks),
    session_count: parsePositiveInt(session_count) ?? 0,
    session_cost: parseAmount(session_cost),
    programming_cost: parseAmount(programming_cost),
    // Recurring duration: only for monthly packages; null = until cancelled.
    recur_months: interval === 'monthly' ? parsePositiveInt(recur_months) : null,
    // How a monthly package's per-month price was set (direct vs split a total).
    monthly_pricing_mode: interval === 'monthly' && VALID_MONTHLY_PRICING.includes(monthly_pricing_mode)
      ? monthly_pricing_mode
      : 'direct',
  }

  let { data, error } = await admin
    .from('coach_packages')
    .insert(insert)
    .select('*')
    .single()

  // If the plan-recipe columns don't exist yet, retry with the base fields.
  if (error) {
    const base = { ...insert }
    delete base.program_template_id
    delete base.billing_mode
    delete base.duration_weeks
    delete base.session_count
    delete base.session_cost
    delete base.programming_cost
    delete base.recur_months
    delete base.monthly_pricing_mode
    const retry = await admin.from('coach_packages').insert(base).select('*').single()
    data = retry.data
    error = retry.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ package: data })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const {
    id, name, description, price, currency, billing_interval,
    includes_running, includes_strength, includes_in_person, includes_programming,
    client_cap, is_active, sort_order,
    program_template_id, billing_mode, duration_weeks, session_count, session_cost, programming_cost, recur_months,
    monthly_pricing_mode,
    org: orgOverride, coach: coachOverride,
  } = body || {}

  if (!id) return NextResponse.json({ error: 'Package id is required' }, { status: 400 })

  const admin = await createAdminClient()
  const scopeResult = await resolveCoachRequestScope(admin, user.id, orgOverride, coachOverride)
  if (!scopeResult.scope) {
    return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  }
  const { coachId } = scopeResult.scope

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (name !== undefined) {
    if (!String(name).trim()) return NextResponse.json({ error: 'Package name cannot be empty' }, { status: 400 })
    updates.name = String(name).trim()
  }
  if (description !== undefined) updates.description = description ? String(description).trim() : null
  if (price !== undefined) {
    const priceCents = parsePriceToCents(price)
    if (priceCents === null) return NextResponse.json({ error: 'A valid price is required' }, { status: 400 })
    updates.price_cents = priceCents
  }
  if (currency !== undefined) updates.currency = String(currency).toLowerCase()
  if (billing_interval !== undefined) {
    if (!VALID_INTERVALS.includes(billing_interval)) {
      return NextResponse.json({ error: 'billing_interval must be "monthly" or "one_time"' }, { status: 400 })
    }
    updates.billing_interval = billing_interval
  }
  if (includes_running !== undefined) updates.includes_running = !!includes_running
  if (includes_strength !== undefined) updates.includes_strength = !!includes_strength
  if (includes_in_person !== undefined) updates.includes_in_person = !!includes_in_person
  if (includes_programming !== undefined) updates.includes_programming = !!includes_programming
  if (client_cap !== undefined) {
    updates.client_cap = Number.isInteger(client_cap) && client_cap > 0 ? client_cap : null
  }
  if (is_active !== undefined) updates.is_active = !!is_active
  if (sort_order !== undefined && Number.isInteger(sort_order)) updates.sort_order = sort_order
  // Plan-recipe fields
  if (program_template_id !== undefined) updates.program_template_id = program_template_id || null
  if (billing_mode !== undefined) {
    if (!VALID_BILLING_MODES.includes(billing_mode)) {
      return NextResponse.json({ error: 'Invalid billing_mode' }, { status: 400 })
    }
    updates.billing_mode = billing_mode
  }
  if (duration_weeks !== undefined) updates.duration_weeks = parsePositiveInt(duration_weeks)
  if (session_count !== undefined) updates.session_count = parsePositiveInt(session_count) ?? 0
  if (session_cost !== undefined) updates.session_cost = parseAmount(session_cost)
  if (programming_cost !== undefined) updates.programming_cost = parseAmount(programming_cost)
  if (recur_months !== undefined) updates.recur_months = parsePositiveInt(recur_months)
  if (monthly_pricing_mode !== undefined) {
    updates.monthly_pricing_mode = VALID_MONTHLY_PRICING.includes(monthly_pricing_mode) ? monthly_pricing_mode : 'direct'
  }

  // Scope the update to the coach so a super admin can't edit another coach's row.
  // The new plan-recipe columns may not exist yet — retry without them on failure.
  const planRecipeKeys = ['program_template_id', 'billing_mode', 'duration_weeks', 'session_count', 'session_cost', 'programming_cost', 'recur_months', 'monthly_pricing_mode']
  let { data, error } = await admin
    .from('coach_packages')
    .update(updates)
    .eq('id', id)
    .eq('coach_id', coachId)
    .select('*')
    .maybeSingle()

  if (error) {
    const base = { ...updates }
    for (const k of planRecipeKeys) delete base[k]
    const retry = await admin
      .from('coach_packages')
      .update(base)
      .eq('id', id)
      .eq('coach_id', coachId)
      .select('*')
      .maybeSingle()
    data = retry.data
    error = retry.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  return NextResponse.json({ package: data })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const orgOverride = searchParams.get('org')
  const coachOverride = searchParams.get('coach')
  if (!id) return NextResponse.json({ error: 'Package id is required' }, { status: 400 })

  const admin = await createAdminClient()
  const scopeResult = await resolveCoachRequestScope(admin, user.id, orgOverride, coachOverride)
  if (!scopeResult.scope) {
    return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  }
  const { coachId } = scopeResult.scope

  // Refuse to delete a package that clients are actively on, or that has an
  // outstanding payment request — deleting would unlink it from those plans
  // and lose the record. Tell the coach to turn it off instead. (Plans/payment
  // requests use ON DELETE SET NULL, so a delete wouldn't destroy them, but it
  // WOULD strip the link; blocking keeps the client's purchase traceable.)
  try {
    const { count: activePlanCount } = await admin
      .from('plans')
      .select('id', { count: 'exact', head: true })
      .eq('source_package_id', id)
      .eq('status', 'active')
    if ((activePlanCount || 0) > 0) {
      return NextResponse.json(
        { error: `This package is in use by ${activePlanCount} active client plan${activePlanCount === 1 ? '' : 's'}. Turn it off instead of deleting so it stays linked to their plans.` },
        { status: 409 }
      )
    }
    const { count: pendingPrCount } = await admin
      .from('payment_requests')
      .select('id', { count: 'exact', head: true })
      .eq('package_id', id)
      .eq('status', 'pending')
    if ((pendingPrCount || 0) > 0) {
      return NextResponse.json(
        { error: `This package has ${pendingPrCount} payment request${pendingPrCount === 1 ? '' : 's'} awaiting payment. Cancel those or turn the package off instead of deleting.` },
        { status: 409 }
      )
    }
  } catch {
    /* source_package_id column may not exist on older schemas — allow delete */
  }

  const { error } = await admin
    .from('coach_packages')
    .delete()
    .eq('id', id)
    .eq('coach_id', coachId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
