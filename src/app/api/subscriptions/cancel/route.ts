import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveCoachRequestScope } from '@/lib/coach-scope'
import { getStripe, isStripeConfigured } from '@/lib/stripe'

// Coach-facing: cancel a client's recurring monthly subscription.
//   POST /api/subscriptions/cancel  { planId, immediate?, org?, coach? }
//
// Cancels the Stripe subscription on the coach's CONNECTED account. By default
// we cancel at period end (the client keeps access through the month they've
// paid for); pass immediate:true to end it right away. The plan is completed
// when Stripe fires customer.subscription.deleted (handled in the webhook),
// so the client's account reflects the real subscription state.

async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Payments are not available right now.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { planId, immediate, org: orgOverride, coach: coachOverride } = body || {}
  if (!planId) {
    return NextResponse.json({ error: 'planId is required' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const scopeResult = await resolveCoachRequestScope(admin, user.id, orgOverride, coachOverride)
  if (!scopeResult.scope) {
    return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  }
  const { coachId } = scopeResult.scope

  // Load the plan + its subscription, and verify this coach is assigned to the client.
  const { data: plan } = await admin
    .from('plans')
    .select('id, client_id, stripe_subscription_id, subscription_status')
    .eq('id', planId)
    .maybeSingle()
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  if (!plan.stripe_subscription_id) {
    return NextResponse.json({ error: 'This plan has no active subscription.' }, { status: 400 })
  }

  const { data: assignment } = await admin
    .from('client_coaches')
    .select('id')
    .eq('client_id', plan.client_id)
    .eq('coach_id', coachId)
    .maybeSingle()
  if (!assignment) {
    return NextResponse.json({ error: 'This client isn\u2019t assigned to you.' }, { status: 403 })
  }

  // The coach's connected account (where the subscription lives).
  const { data: coach } = await admin
    .from('users')
    .select('stripe_account_id')
    .eq('id', coachId)
    .maybeSingle()
  if (!coach?.stripe_account_id) {
    return NextResponse.json({ error: 'Coach Stripe account not found.' }, { status: 400 })
  }

  const stripe = getStripe()
  try {
    if (immediate) {
      // Cancel now — customer.subscription.deleted will complete the plan.
      await stripe.subscriptions.cancel(
        plan.stripe_subscription_id,
        { stripeAccount: coach.stripe_account_id }
      )
    } else {
      // Cancel at period end — keep access through the paid month.
      await stripe.subscriptions.update(
        plan.stripe_subscription_id,
        { cancel_at_period_end: true },
        { stripeAccount: coach.stripe_account_id }
      )
      await admin
        .from('plans')
        .update({ subscription_status: 'canceling' })
        .eq('id', plan.id)
    }
  } catch (err: any) {
    console.error('Subscription cancel failed:', err?.message)
    return NextResponse.json({ error: err?.message || 'Could not cancel the subscription.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, immediate: !!immediate })
}
