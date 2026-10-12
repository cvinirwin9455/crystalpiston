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
const VALID_DELIVERY_FORMATS = ['programming', 'in_person', 'hybrid']

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
    delivery_format,
    client_cap, is_active, sort_order,
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
  const deliveryFmt = VALID_DELIVERY_FORMATS.includes(delivery_format) ? delivery_format : 'programming'

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
    delivery_format: deliveryFmt,
    client_cap: Number.isInteger(client_cap) && client_cap > 0 ? client_cap : null,
    is_active: is_active === undefined ? true : !!is_active,
    sort_order: Number.isInteger(sort_order) ? sort_order : 0,
  }

  const { data, error } = await admin
    .from('coach_packages')
    .insert(insert)
    .select('*')
    .single()

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
    delivery_format,
    client_cap, is_active, sort_order,
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
  if (delivery_format !== undefined) {
    if (!VALID_DELIVERY_FORMATS.includes(delivery_format)) {
      return NextResponse.json({ error: 'delivery_format must be "programming", "in_person", or "hybrid"' }, { status: 400 })
    }
    updates.delivery_format = delivery_format
  }
  if (client_cap !== undefined) {
    updates.client_cap = Number.isInteger(client_cap) && client_cap > 0 ? client_cap : null
  }
  if (is_active !== undefined) updates.is_active = !!is_active
  if (sort_order !== undefined && Number.isInteger(sort_order)) updates.sort_order = sort_order

  // Scope the update to the coach so a super admin can't edit another coach's row.
  const { data, error } = await admin
    .from('coach_packages')
    .update(updates)
    .eq('id', id)
    .eq('coach_id', coachId)
    .select('*')
    .maybeSingle()

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

  const { error } = await admin
    .from('coach_packages')
    .delete()
    .eq('id', id)
    .eq('coach_id', coachId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
