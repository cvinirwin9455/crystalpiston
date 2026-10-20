import { NextResponse } from 'next/server'
import { getStripe, isStripeConfigured } from '@/lib/stripe'

// PUBLIC (unauthenticated) checkout endpoints for a payment request.
//   GET  /api/pay/<token>   -> read the request details for the checkout page
//   POST /api/pay/<token>   -> create a Stripe Checkout Session (on the coach's
//                             connected account) and return its URL
//
// The payer has no First Mile account yet, so these run with the service-role
// client (same pattern as /api/apply/<slug>). The charge is a DIRECT charge on
// the coach's connected account — no platform fee.

async function adminClient() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(
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

// --- GET: details for the checkout page ---
export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  const supabase = await adminClient()

  // Try with the newest columns (is_renewal controls renewal wording;
  // recur_months describes a capped subscription); peel back if absent.
  let { data: pr } = await supabase
    .from('payment_requests')
    .select('id, coach_id, package_name, amount_cents, currency, billing_interval, client_name, status, is_renewal, recur_months')
    .eq('token', params.token)
    .maybeSingle()
  if (!pr) {
    const retry = await supabase
      .from('payment_requests')
      .select('id, coach_id, package_name, amount_cents, currency, billing_interval, client_name, status, is_renewal')
      .eq('token', params.token)
      .maybeSingle()
    pr = retry.data
  }
  if (!pr) {
    const retry2 = await supabase
      .from('payment_requests')
      .select('id, coach_id, package_name, amount_cents, currency, billing_interval, client_name, status')
      .eq('token', params.token)
      .maybeSingle()
    pr = retry2.data
  }

  if (!pr) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: coach } = await supabase
    .from('users')
    .select('name, avatar_url')
    .eq('id', pr.coach_id)
    .maybeSingle()

  return NextResponse.json({
    coachName: coach?.name || 'Your coach',
    coachAvatar: coach?.avatar_url || null,
    packageName: pr.package_name,
    amountCents: pr.amount_cents,
    currency: pr.currency,
    billingInterval: pr.billing_interval,
    recurMonths: (pr as any).recur_months ?? null, // capped subscription length, if any
    clientName: pr.client_name,
    status: pr.status,
    isRenewal: !!(pr as any).is_renewal, // continuing-training copy only for renewals
  })
}

// --- POST: create a Stripe Checkout Session and return its URL ---
export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Payments are not available right now.' }, { status: 503 })
  }

  const supabase = await adminClient()

  const { data: pr } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('token', params.token)
    .maybeSingle()

  if (!pr) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (pr.status === 'paid') {
    return NextResponse.json({ error: 'This payment has already been completed.' }, { status: 409 })
  }

  // The coach's connected account.
  const { data: coach } = await supabase
    .from('users')
    .select('stripe_account_id, stripe_charges_enabled')
    .eq('id', pr.coach_id)
    .maybeSingle()
  if (!coach?.stripe_account_id || !coach.stripe_charges_enabled) {
    return NextResponse.json({ error: 'This coach cannot accept payments right now.' }, { status: 400 })
  }

  const base = await siteUrl(request)
  const stripe = getStripe()

  // Shared metadata — surfaced on the Checkout Session AND propagated to the
  // objects the webhook reads (PaymentIntent for one-time, Subscription for
  // recurring) so fulfillment can always find the originating request.
  const sharedMeta: Record<string, string> = {
    payment_request_id: pr.id,
    token: pr.token,
    coach_id: pr.coach_id,
    application_id: pr.application_id || '',
  }

  // Monthly package => a recurring subscription; everything else => one-time.
  const isSubscription = pr.billing_interval === 'monthly'

  try {
    // DIRECT charge on the coach's connected account (stripeAccount header).
    // No application_fee => First Mile takes no cut; the coach is merchant of
    // record.
    let session

    if (isSubscription) {
      // Recurring monthly subscription (mode 'subscription'). An inline
      // recurring price_data avoids having to pre-create/store a Stripe Price.
      // recur_months (if set) is carried on the subscription metadata; the
      // webhook counts paid invoices and cancels once N have been billed.
      // Blank recur_months => runs until the coach cancels.
      const subMeta: Record<string, string> = { ...sharedMeta }
      if (pr.recur_months && Number(pr.recur_months) > 0) {
        subMeta.recur_months = String(Number(pr.recur_months))
      }
      session = await stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          customer_email: pr.client_email || undefined,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: pr.currency || 'usd',
                unit_amount: pr.amount_cents,
                recurring: { interval: 'month' },
                product_data: { name: pr.package_name || 'Coaching' },
              },
            },
          ],
          success_url: `${base}/pay/${pr.token}?status=success`,
          cancel_url: `${base}/pay/${pr.token}?status=cancelled`,
          metadata: sharedMeta,
          // Propagate metadata onto the Subscription so invoice.paid /
          // subscription.* webhook events can resolve the payment request.
          subscription_data: { metadata: subMeta },
        },
        { stripeAccount: coach.stripe_account_id }
      )
    } else {
      // One-time payment (mode 'payment').
      session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          // NOTE: do NOT set payment_method_types — Stripe now auto-manages the
          // available payment methods from the connected account's Dashboard
          // settings. Passing it is rejected by current API versions.
          customer_email: pr.client_email || undefined,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: pr.currency || 'usd',
                unit_amount: pr.amount_cents,
                product_data: { name: pr.package_name || 'Coaching' },
              },
            },
          ],
          success_url: `${base}/pay/${pr.token}?status=success`,
          cancel_url: `${base}/pay/${pr.token}?status=cancelled`,
          metadata: sharedMeta,
          // Surface metadata on the PaymentIntent too (webhook reads it).
          payment_intent_data: { metadata: sharedMeta },
        },
        { stripeAccount: coach.stripe_account_id }
      )
    }

    // Save the session id so the webhook/success can reconcile.
    await supabase
      .from('payment_requests')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', pr.id)

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Checkout session create failed:', err?.message)
    return NextResponse.json({ error: err?.message || 'Could not start checkout.' }, { status: 500 })
  }
}
