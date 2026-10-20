import { NextResponse } from 'next/server'
import { getStripe, isStripeConfigured } from '@/lib/stripe'

// Stripe Connect OAuth callback.
//   GET /api/stripe-connect/callback?code=...&state=...   (success)
//   GET /api/stripe-connect/callback?error=...&state=...  (coach cancelled/denied)
//
// Stripe redirects the coach here after they authorize (or decline) the
// connection. We validate the `state` token we issued, exchange the `code` for
// the coach's connected account id (stripe_user_id), store it, then bounce the
// coach back to Account Preferences (where the Stripe card now lives) so they
// see the connection confirmed.
//
// This route has NO cookie session (the coach is coming from Stripe), so it
// resolves the coach purely from the signed `state` token via the service-role
// client.

async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function siteUrl(request: Request): Promise<string> {
  try {
    const origin = new URL(request.url).origin
    if (origin && !origin.includes('localhost')) return origin.replace(/\/$/, '')
  } catch { /* fall through */ }
  const { getProductionUrl } = await import('@/lib/email')
  return getProductionUrl(request.url)
}

function redirect(base: string, status: 'return' | 'refresh' | 'error', message?: string) {
  // Land on Account Preferences — that's where the Stripe Connect card lives,
  // so the coach sees the connection confirmed (and any stripe status message).
  const params = new URLSearchParams({ view: 'account', stripe: status })
  if (message) params.set('stripe_msg', message)
  return NextResponse.redirect(`${base}/admin?${params.toString()}`)
}

export async function GET(request: Request) {
  const base = await siteUrl(request)

  if (!isStripeConfigured()) {
    return redirect(base, 'error', 'Stripe is not configured.')
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')
  const oauthErrorDesc = searchParams.get('error_description')

  // Coach declined or Stripe returned an error.
  if (oauthError) {
    return redirect(base, 'error', oauthErrorDesc || 'Connection was cancelled.')
  }
  if (!code || !state) {
    return redirect(base, 'error', 'Missing authorization details from Stripe.')
  }

  const admin = await createAdminClient()

  // Validate the state token: it must match a coach we issued it to.
  const { data: coach } = await admin
    .from('users')
    .select('id, stripe_oauth_state')
    .eq('stripe_oauth_state', state)
    .maybeSingle()

  if (!coach) {
    return redirect(base, 'error', 'This connection link is invalid or expired. Please try again.')
  }

  try {
    const stripe = getStripe()
    // Exchange the authorization code for the coach's account id.
    const token = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    })
    const connectedAccountId = token.stripe_user_id
    if (!connectedAccountId) {
      return redirect(base, 'error', 'Stripe did not return an account id.')
    }

    // Read live status of the newly connected account.
    let chargesEnabled = false
    let detailsSubmitted = false
    let payoutsEnabled = false
    try {
      const acct = await stripe.accounts.retrieve(connectedAccountId)
      chargesEnabled = !!acct.charges_enabled
      detailsSubmitted = !!acct.details_submitted
      payoutsEnabled = !!acct.payouts_enabled
    } catch (e) {
      /* status will refresh on next GET */
    }

    await admin
      .from('users')
      .update({
        stripe_account_id: connectedAccountId,
        stripe_charges_enabled: chargesEnabled,
        stripe_details_submitted: detailsSubmitted,
        stripe_payouts_enabled: payoutsEnabled,
        stripe_connected_at: new Date().toISOString(),
        stripe_oauth_state: null, // consume the one-time state
      })
      .eq('id', coach.id)

    return redirect(base, 'return')
  } catch (err: any) {
    console.error('Stripe OAuth token exchange failed:', err?.message)
    // Clear the state so a fresh attempt can be made.
    await admin.from('users').update({ stripe_oauth_state: null }).eq('id', coach.id)
    return redirect(base, 'error', err?.message || 'Could not complete the Stripe connection.')
  }
}
