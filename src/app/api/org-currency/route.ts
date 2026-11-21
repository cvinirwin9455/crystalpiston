import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOrgIdForUser } from '@/lib/org'
import { resolveCoachRequestScope } from '@/lib/coach-scope'
import { CURRENCY_CODES, normalizeCurrencyCode } from '@/lib/currency'

// Helper: create admin client with service role key
async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/org-currency - Currency for the current user's organization.
// Works for coaches and clients (a client's user row carries their coach's
// organization). Super admins can pass ?org=<id> to read another organization
// while "viewing as" a coach.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await createAdminClient()
  const orgOverride = new URL(request.url).searchParams.get('org')

  let orgId: string | null = null
  if (orgOverride) {
    const { data: me } = await adminClient
      .from('users')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()
    if (me?.is_super_admin) orgId = orgOverride
  }
  if (!orgId) orgId = await getOrgIdForUser(adminClient, user.id)

  if (!orgId) {
    return NextResponse.json({ currency: 'USD' })
  }

  const { data: org, error } = await adminClient
    .from('organizations')
    .select('currency')
    .eq('id', orgId)
    .single()

  if (error || !org) {
    return NextResponse.json({ currency: 'USD' })
  }

  return NextResponse.json({ currency: normalizeCurrencyCode(org.currency) })
}

// PUT /api/org-currency - Update the organization's currency (account owners only).
// Body: { currency: 'GBP', org?: <id> } (org override is super admin only).
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const requested = String(body?.currency || '').toUpperCase()
  if (!requested || !CURRENCY_CODES.includes(requested as any)) {
    return NextResponse.json({ error: `Invalid currency. Must be one of: ${CURRENCY_CODES.join(', ')}` }, { status: 400 })
  }

  const adminClient = await createAdminClient()
  const scopeResult = await resolveCoachRequestScope(adminClient, user.id, body?.org || null, body?.coach || null)
  if (!scopeResult.scope) {
    return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  }
  const { actorProfile, organizationId, isImpersonating } = scopeResult.scope

  // Only account owners (or a super admin acting for one) can change currency.
  if (!isImpersonating && actorProfile.coach_level === 'coach') {
    return NextResponse.json({ error: 'Only account owners can change currency' }, { status: 403 })
  }
  if (!organizationId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 })
  }

  const { data: current } = await adminClient
    .from('organizations')
    .select('currency')
    .eq('id', organizationId)
    .single()
  const previous = normalizeCurrencyCode(current?.currency)
  if (previous === requested) {
    return NextResponse.json({ success: true, currency: requested, relabeledPackages: 0 })
  }

  // Stripe prices are created in a fixed currency and can't be changed. Block the
  // switch while any package is already synced to Stripe.
  const { data: stripePkgs } = await adminClient
    .from('coach_packages')
    .select('id')
    .eq('organization_id', organizationId)
    .not('stripe_price_id', 'is', null)
    .limit(1)
  if (stripePkgs && stripePkgs.length > 0) {
    return NextResponse.json(
      { error: 'Some of your packages are already set up for online card payments in the current currency, so it can\'t be changed. Contact support to switch currency.' },
      { status: 409 }
    )
  }

  const { error } = await adminClient
    .from('organizations')
    .update({ currency: requested })
    .eq('id', organizationId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Keep package prices consistent with the organization's currency. Amounts are
  // relabelled, not converted: a 300 package stays 300 in the new currency.
  const { data: relabeled } = await adminClient
    .from('coach_packages')
    .update({ currency: requested.toLowerCase() })
    .eq('organization_id', organizationId)
    .select('id')

  return NextResponse.json({ success: true, currency: requested, relabeledPackages: relabeled?.length || 0 })
}
