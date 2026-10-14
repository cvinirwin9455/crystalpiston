import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveCoachRequestScope } from '@/lib/coach-scope'
import { getStripe, isStripeConfigured, getConnectClientId } from '@/lib/stripe'

// Stripe Connect for a coach — STANDARD accounts via the OAuth connect flow.
//   GET  /api/stripe-connect   -> current connection status (refreshed from Stripe)
//   POST /api/stripe-connect   -> build a Stripe OAuth authorize URL to redirect
//                                 the coach to (connect existing / create new)
//
// We use STANDARD accounts connected via OAuth on purpose:
//   * A coach who ALREADY has a Stripe account signs in and authorizes First
//     Mile — their existing account becomes the connected account.
//   * A coach WITHOUT a Stripe account can create one in the same flow.
// Either way the coach owns a FULL, independent Stripe account (their own
// dashboard, support, refunds, disputes). The coach is the merchant of record
// and is SOLELY responsible for everything financial. First Mile's platform
// account only facilitates the connection — it never holds the coach's money,
// takes no fee, and bears no financial liability.
//
// The OAuth code exchange happens in ./callback. Here we only start the flow
// and report status.
//
// Super-admin "view as coach" is honored via ?org=&coach= (GET) or org/coach in
// the body (POST), resolved through resolveCoachRequestScope.

async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Absolute base URL for the OAuth redirect_uri.
// Prefer the origin of the actual request so a PREVIEW deployment returns the
// coach to the preview (not production). Fall back to the production URL helper.
async function siteUrl(request: Request): Promise<string> {
  try {
    const origin = new URL(request.url).origin
    if (origin && !origin.includes('localhost')) return origin.replace(/\/$/, '')
  } catch { /* fall through */ }
  const { getProductionUrl } = await import('@/lib/email')
  return getProductionUrl(request.url)
}

// Base URL used for the OAuth redirect_uri. This MUST exactly match one of the
// redirect URIs registered in the Stripe Connect settings, so we prefer an
// explicit, STABLE value (STRIPE_CONNECT_REDIRECT_BASE) over the per-deployment
// request origin. Per-deployment preview URLs (random hash) are never
// registered in Stripe, so relying on the request origin breaks OAuth there.
// Falls back to the request origin only if the env var isn't set.
async function oauthRedirectBase(request: Request): Promise<string> {
  const explicit = process.env.STRIPE_CONNECT_REDIRECT_BASE || process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')
  return siteUrl(request)
}

// --- GET: current connection status for the resolved coach ---
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

  const { data: coach } = await admin
    .from('users')
    .select('stripe_account_id, stripe_charges_enabled, stripe_details_submitted, stripe_payouts_enabled, stripe_connected_at')
    .eq('id', coachId)
    .maybeSingle()

  const accountId: string | null = coach?.stripe_account_id || null

  // Not configured on the server yet — report so the UI can explain.
  if (!isStripeConfigured() || !getConnectClientId()) {
    return NextResponse.json({
      configured: false,
      connected: !!accountId,
      chargesEnabled: !!coach?.stripe_charges_enabled,
      detailsSubmitted: !!coach?.stripe_details_submitted,
      payoutsEnabled: !!coach?.stripe_payouts_enabled,
    })
  }

  // If the coach has an account, refresh the live status from Stripe so the UI
  // reflects reality even if a webhook hasn't fired yet.
  if (accountId) {
    try {
      const stripe = getStripe()
      const acct = await stripe.accounts.retrieve(accountId)
      const chargesEnabled = !!acct.charges_enabled
      const detailsSubmitted = !!acct.details_submitted
      const payoutsEnabled = !!acct.payouts_enabled

      if (
        chargesEnabled !== !!coach?.stripe_charges_enabled ||
        detailsSubmitted !== !!coach?.stripe_details_submitted ||
        payoutsEnabled !== !!coach?.stripe_payouts_enabled
      ) {
        await admin
          .from('users')
          .update({
            stripe_charges_enabled: chargesEnabled,
            stripe_details_submitted: detailsSubmitted,
            stripe_payouts_enabled: payoutsEnabled,
          })
          .eq('id', coachId)
      }

      return NextResponse.json({
        configured: true,
        connected: true,
        chargesEnabled,
        detailsSubmitted,
        payoutsEnabled,
      })
    } catch (err: any) {
      console.error('Stripe account retrieve failed:', err?.message)
      return NextResponse.json({
        configured: true,
        connected: true,
        chargesEnabled: !!coach?.stripe_charges_enabled,
        detailsSubmitted: !!coach?.stripe_details_submitted,
        payoutsEnabled: !!coach?.stripe_payouts_enabled,
        warning: 'Could not refresh status from Stripe.',
      })
    }
  }

  return NextResponse.json({
    configured: true,
    connected: false,
    chargesEnabled: false,
    detailsSubmitted: false,
    payoutsEnabled: false,
  })
}

// --- POST: start the OAuth connect flow — return an authorize URL ---
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe is not configured on the server yet. Add STRIPE_SECRET_KEY in Vercel.' },
      { status: 503 }
    )
  }
  const clientId = getConnectClientId()
  if (!clientId) {
    return NextResponse.json(
      { error: 'Stripe Connect is not configured yet. Add STRIPE_CONNECT_CLIENT_ID in Vercel.' },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const { org: orgOverride, coach: coachOverride } = body || {}

  const admin = await createAdminClient()
  const scopeResult = await resolveCoachRequestScope(admin, user.id, orgOverride, coachOverride)
  if (!scopeResult.scope) {
    return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  }
  const { coachId } = scopeResult.scope

  const { data: coach } = await admin
    .from('users')
    .select('id, email, name')
    .eq('id', coachId)
    .maybeSingle()

  if (!coach) return NextResponse.json({ error: 'Coach not found' }, { status: 404 })

  try {
    // Generate a random state token for CSRF protection and to identify which
    // coach is connecting when Stripe redirects back to the callback.
    const nonce = (globalThis.crypto?.randomUUID?.() as string) || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const state = `${coachId}.${nonce}`
    const { error: stateErr } = await admin
      .from('users')
      .update({ stripe_oauth_state: state })
      .eq('id', coachId)
    if (stateErr) {
      // Most likely the stripe_oauth_state column doesn't exist yet.
      return NextResponse.json(
        { error: `Could not save connect state: ${stateErr.message}. Has the stripe_oauth_state migration been run?` },
        { status: 500 }
      )
    }

    const stripe = getStripe()
    // Use the STABLE redirect base so the redirect_uri matches what's registered
    // in Stripe, even when testing on a per-deployment preview URL.
    const base = await oauthRedirectBase(request)

    // Build the Stripe OAuth authorize URL. scope=read_write grants the platform
    // the ability to create charges on the connected (Standard) account.
    // stripe_user prefills the coach's details to speed up sign-up/sign-in.
    const url = stripe.oauth.authorizeUrl({
      client_id: clientId,
      response_type: 'code',
      scope: 'read_write',
      redirect_uri: `${base}/api/stripe-connect/callback`,
      state,
      stripe_user: {
        email: coach.email || undefined,
        business_name: coach.name || undefined,
      },
    } as any)

    return NextResponse.json({ url })
  } catch (err: any) {
    console.error('Stripe Connect start failed:', err?.message, err)
    return NextResponse.json(
      { error: err?.message || 'Could not start the Stripe connection.' },
      { status: 500 }
    )
  }
}

// --- DELETE: disconnect / clear the coach's stored Stripe account ---
// Clears the stale/half-connected account so the coach can start the OAuth
// connect flow cleanly. Does NOT delete the coach's actual Stripe account
// (that belongs to them) — it only removes the link stored in First Mile.
export async function DELETE(request: Request) {
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

  const { error } = await admin
    .from('users')
    .update({
      stripe_account_id: null,
      stripe_charges_enabled: false,
      stripe_details_submitted: false,
      stripe_payouts_enabled: false,
      stripe_oauth_state: null,
    })
    .eq('id', coachId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
