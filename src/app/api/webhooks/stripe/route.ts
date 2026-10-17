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

// Resolve the subscription id from an invoice across Stripe API versions:
// older versions expose invoice.subscription; newer ones nest it under
// invoice.parent.subscription_details.subscription.
function invoiceSubscriptionId(invoice: any): string | null {
  if (typeof invoice?.subscription === 'string') return invoice.subscription
  const nested = invoice?.parent?.subscription_details?.subscription
  if (typeof nested === 'string') return nested
  return null
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

  // For Connect webhooks, event.account is the connected account the event
  // came from — needed to make follow-up API calls (e.g. cancel a subscription)
  // against that account.
  const connectedAccount: string | null = (event as any).account || null

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        // One-time: payment_status 'paid'. Subscription: 'paid' or 'no_payment_required';
        // the first invoice is paid as part of checkout, so fulfill here too.
        const ok = session.payment_status === 'paid' || session.mode === 'subscription'
        if (ok) {
          const prId = session.metadata?.payment_request_id
          if (prId) {
            const admin = await adminClient()
            await fulfillPaymentRequest(admin, {
              paymentRequestId: prId,
              paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
              subscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
              customerId: typeof session.customer === 'string' ? session.customer : null,
            })
          }
        }
        break
      }

      case 'invoice.paid': {
        // A recurring monthly charge succeeded. The FIRST invoice is handled by
        // checkout.session.completed (fulfillment); subsequent ones are logged
        // here as additional payments against the plan.
        const invoice = event.data.object
        const subscriptionId = invoiceSubscriptionId(invoice)
        if (subscriptionId && invoice.billing_reason && invoice.billing_reason !== 'subscription_create') {
          const admin = await adminClient()
          const { recordRecurringInvoice, enforceRecurMonths } = await import('@/lib/subscriptions')
          await recordRecurringInvoice(admin, {
            subscriptionId,
            amountCents: invoice.amount_paid ?? invoice.amount_due ?? 0,
            currency: invoice.currency || 'usd',
            paidAtUnix: invoice.status_transitions?.paid_at || invoice.created || null,
            invoiceId: typeof invoice.id === 'string' ? invoice.id : null,
          })
          // If the subscription was set to run only N months, cancel it once
          // that many invoices have been paid.
          await enforceRecurMonths(admin, stripe, { subscriptionId, connectedAccount })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subscriptionId = invoiceSubscriptionId(invoice)
        if (subscriptionId) {
          const admin = await adminClient()
          const { setSubscriptionStatus } = await import('@/lib/subscriptions')
          await setSubscriptionStatus(admin, subscriptionId, 'past_due')
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const admin = await adminClient()
        const { setSubscriptionStatus } = await import('@/lib/subscriptions')
        // Keep local status in sync; include the scheduled cancel time if any.
        const cancelAt = sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null
        await setSubscriptionStatus(admin, sub.id, sub.status, cancelAt)
        break
      }

      case 'customer.subscription.deleted': {
        // Subscription ended (cancelled by coach, or ran its course). Complete
        // the plan so it stops showing as an active recurring plan.
        const sub = event.data.object
        const admin = await adminClient()
        const { endSubscription } = await import('@/lib/subscriptions')
        await endSubscription(admin, sub.id)
        break
      }

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
