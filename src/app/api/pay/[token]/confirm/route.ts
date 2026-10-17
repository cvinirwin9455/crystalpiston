import { NextResponse } from 'next/server'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { fulfillPaymentRequest } from '@/lib/fulfill-payment'

// PUBLIC confirm endpoint, called by the /pay/<token> page when Stripe returns
// with ?status=success. It verifies with Stripe that the Checkout Session was
// actually paid, then fulfills (marks paid + provisions the client account).
//
// This is a convenience path so fulfillment works immediately in testing even
// before the webhook is configured. The webhook (/api/webhooks/stripe) is the
// authoritative source of truth; both call the same idempotent fulfill helper.

async function adminClient() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(
  _request: Request,
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

  // Already fulfilled.
  if (pr.status === 'paid') {
    return NextResponse.json({ status: 'paid' })
  }

  if (!pr.stripe_checkout_session_id) {
    return NextResponse.json({ status: pr.status })
  }

  // The coach's connected account (the session lives there).
  const { data: coach } = await supabase
    .from('users')
    .select('stripe_account_id')
    .eq('id', pr.coach_id)
    .maybeSingle()
  if (!coach?.stripe_account_id) {
    return NextResponse.json({ error: 'coach account missing' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    // NOTE: retrieve(id, params, options) — the connected-account header is the
    // THIRD arg (options). Passing { stripeAccount } as the 2nd arg sends it as
    // a query param and Stripe rejects it ("unknown parameter: stripeAccount"),
    // which previously made confirm throw and fulfillment never run.
    const session = await stripe.checkout.sessions.retrieve(
      pr.stripe_checkout_session_id,
      undefined,
      { stripeAccount: coach.stripe_account_id }
    )

    if (session.payment_status === 'paid') {
      const result = await fulfillPaymentRequest(supabase, {
        paymentRequestId: pr.id,
        paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      })
      if (!result.ok) {
        return NextResponse.json({ status: 'paid', warning: result.error })
      }
      return NextResponse.json({ status: 'paid' })
    }

    return NextResponse.json({ status: pr.status })
  } catch (err: any) {
    console.error('Payment confirm failed:', err?.message)
    return NextResponse.json({ error: err?.message || 'Could not confirm payment.' }, { status: 500 })
  }
}
