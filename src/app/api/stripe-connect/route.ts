import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveCoachRequestScope } from '@/lib/coach-scope'
import { getStripe, isStripeConfigured } from '@/lib/stripe'

// Stripe Connect onboarding for a coach (Accounts v2 API).
//   GET  /api/stripe-connect   -> current connection status (refreshed from Stripe)
//   POST /api/stripe-connect   -> create/reuse the coach's connected account and
//                                 return a hosted onboarding link to redirect to
//
// First Mile is a SaaS platform: each coach runs their own coaching business,
// owns their clients, and is the merchant of record (direct charges). Money
// goes directly to the coach's connected account — no platform fee.
//
// We use the v2 "merchant" configuration with the full Stripe Dashboard,
// Stripe as fees + losses collector (recommended SaaS defaults). Readiness is
// read from configuration.merchant.capabilities.card_payments.status === 'active'
// (NOT the deprecated v1 charges_enabled field).
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

// Pull the three readiness signals out of a v2 Account object. We map them onto
// the same column names we already store (charges/payouts/details) so the rest
// of the app and the DB schema stay stable.
function readV2Status(acct: any): {
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
} {
  const merchant = acct?.configuration?.merchant
  const cardStatus = merchant?.capabilities?.card_payments?.status
  const chargesEnabled = cardStatus === 'active'

  // v2 payouts/transfers live under the recipient configuration (if requested)
  // or are implied by an active merchant for direct-charge SaaS. We treat an
  // active merchant as "payouts enabled" for display purposes.
  const payoutsEnabled = chargesEnabled

  // "details submitted" ~ the account has no outstanding onboarding
  // requirements that are currently due.
  const dueNow = acct?.requirements?.entries?.filter?.(
    (e: any) => e?.minimum_deadline?.status === 'currently_due' || e?.minimum_deadline?.status === 'past_due'
  )
  const detailsSubmitted = Array.isArray(dueNow) ? dueNow.length === 0 : chargesEnabled

  return { chargesEnabled, payoutsEnabled, detailsSubmitted }
}

// Retrieve a v2 account including the fields we need to judge readiness.
async function retrieveV2Account(stripe: any, accountId: string) {
  return stripe.v2.core.accounts.retrieve(accountId, {
    include: [
      'configuration.merchant',
      'requirements',
      'identity',
    ],
  })
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
      const acct = await retrieveV2Account(stripe, accountId)
      const { chargesEnabled, detailsSubmitted, payoutsEnabled } = readV2Status(acct)

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

// --- POST: create/reuse the connected account and return an onboarding link ---
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
    // Create the connected account on first connect (Accounts v2 API).
    // SaaS / direct-charge defaults: full dashboard, Stripe collects fees and
    // owns losses, merchant configuration requesting card_payments.
    if (!accountId) {
      const account = await stripe.v2.core.accounts.create({
        contact_email: coach.email || undefined,
        display_name: coach.name || undefined,
        dashboard: 'full',
        identity: {
          // Coach's business country. Default to GB (First Mile's home market);
          // Stripe collects/corrects this during onboarding.
          country: 'gb',
        },
        defaults: {
          responsibilities: {
            fees_collector: 'stripe',
            losses_collector: 'stripe',
          },
        },
        configuration: {
          merchant: {
            capabilities: {
              card_payments: { requested: true },
            },
          },
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

    // Build the hosted onboarding link (Accounts v2 Account Links).
    // return_url / refresh_url must be absolute and land the coach back on the
    // Applications view.
    const base = await siteUrl(request)
    const accountLink = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          return_url: `${base}/admin?view=applications&stripe=return`,
          refresh_url: `${base}/admin?view=applications&stripe=refresh`,
        },
      },
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
