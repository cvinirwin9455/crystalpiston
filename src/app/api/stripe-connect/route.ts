import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveCoachRequestScope } from '@/lib/coach-scope'
import { getStripe, isStripeConfigured } from '@/lib/stripe'

// Stripe Connect (Express) onboarding for a coach.
//   GET  /api/stripe-connect   -> current connection status (refreshed from Stripe)
//   POST /api/stripe-connect   -> create/reuse the coach's Express account and
//                                 return a hosted onboarding link to redirect to
//
// Per-coach: money goes directly to the coach's connected account, no platform
// fee. Super-admin "view as coach" is honored via ?org=&coach= (GET) or
// org/coach in the body (POST), resolved through resolveCoachRequestScope.

async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Absolute base URL for Stripe return/refresh links.
// Prefer the origin of the actual request so a PREVIEW deployment returns the
// coach to the preview (not production) — important for testing. Fall back to
// NEXT_PUBLIC_SITE_URL / the production URL helper if the origin is missing.
async function siteUrl(request: Request): Promise<string> {
  try {
    const origin = new URL(request.url).origin
    if (origin && !origin.includes('localhost')) return origin.replace(/\/$/, '')
  } catch { /* fall through */ }
  const { getProductionUrl } = await import('@/lib/email')
  return getProductionUrl(request.url)
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
  if (!isStripeConfigured()) {
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

      // Persist any change so other reads (and later the webhook) stay in sync.
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
      // Account may have been deleted on Stripe's side, or key mismatch.
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

// --- POST: create/reuse the Express account and return an onboarding link ---
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
    .select('id, email, name, stripe_account_id')
    .eq('id', coachId)
    .maybeSingle()

  if (!coach) return NextResponse.json({ error: 'Coach not found' }, { status: 404 })

  const stripe = getStripe()
  let accountId: string | null = coach.stripe_account_id || null

  try {
    // Create the Express account on first connect.
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: coach.email || undefined,
        business_profile: {
          name: coach.name || undefined,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          coach_id: coachId,
          platform: 'first-mile-coach',
        },
      })
      accountId = account.id

      await admin
        .from('users')
        .update({
          stripe_account_id: accountId,
          stripe_connected_at: new Date().toISOString(),
        })
        .eq('id', coachId)
    }

    // Build the hosted onboarding link. return_url / refresh_url must be
    // absolute and land the coach back on the Applications view.
    const base = await siteUrl(request)
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: `${base}/admin?view=applications&stripe=return`,
      refresh_url: `${base}/admin?view=applications&stripe=refresh`,
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err: any) {
    console.error('Stripe Connect onboarding failed:', err?.message)
    return NextResponse.json(
      { error: err?.message || 'Could not start Stripe onboarding.' },
      { status: 500 }
    )
  }
}
