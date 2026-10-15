import { NextResponse } from 'next/server'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { fulfillPaymentRequest } from '@/lib/fulfill-payment'

// Stripe webhook — authoritative fulfillment for payments.
//   POST /api/webhooks/stripe
//
// This should be registered in Stripe as a CONNECT webhook (so it receives
// events from connected accounts) listening for `checkout.session.completed`.
// On that event we look up the payment_request by the session metadata and
// fulfill it (mark paid + provision the client account) — idempotently, so it
// is safe alongside the /pay confirm path and Stripe's retries.
//
// Requires STRIPE_WEBHOOK_SECRET (the signing secret from the Stripe webhook
// endpoint config) in Vercel.
//
// Connect webhook endpoint configured in the Stripe sandbox (Connected
// accounts scope, checkout.session.completed) — redeploy to apply the secret.

// We need the raw body for signature verification — disable body parsing.
export const dynamic = 'force-dynamic'

async function adminClient() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  const stripe = getStripe()
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  // Raw body is required for signature verification.
  const rawBody = await request.text()

  let event: any
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret)
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err?.message)
    return NextResponse.json({ error: `Webhook Error: ${err?.message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.payment_status === 'paid') {
          const prId = session.metadata?.payment_request_id
          if (prId) {
            const admin = await adminClient()
            await fulfillPaymentRequest(admin, {
              paymentRequestId: prId,
              paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            })
          }
        }
        break
      }
      // Other events can be handled later (e.g. async payment success/failure).
      default:
        break
    }
  } catch (err: any) {
    console.error('Stripe webhook handler error:', err?.message)
    // Return 200 so Stripe doesn't hammer retries for a transient app error;
    // the /pay confirm path and manual retry remain as safety nets.
    return NextResponse.json({ received: true, warning: err?.message })
  }

  return NextResponse.json({ received: true })
}
