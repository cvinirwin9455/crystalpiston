import type Stripe from 'stripe'

// Helpers for managing recurring (monthly) subscription state on plans.
// A plan is linked to a Stripe subscription via plans.stripe_subscription_id
// (direct subscription on the coach's CONNECTED account). These helpers are
// called from the Stripe webhook and the coach-facing cancel endpoint.
//
// `admin` is a service-role Supabase client.

// Find the plan a Stripe subscription belongs to.
async function findPlanBySubscription(admin: any, subscriptionId: string) {
  const { data } = await admin
    .from('plans')
    .select('id, client_id, paid, subscription_status')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()
  return data || null
}

// Update a plan's subscription_status (and optional scheduled cancel time).
// Best-effort: swallows missing-column errors on older schemas.
export async function setSubscriptionStatus(
  admin: any,
  subscriptionId: string,
  status: string,
  cancelAt?: string | null
): Promise<void> {
  const update: Record<string, any> = { subscription_status: status }
  if (cancelAt !== undefined) update.subscription_cancel_at = cancelAt
  const res = await admin
    .from('plans')
    .update(update)
    .eq('stripe_subscription_id', subscriptionId)
  if (res.error) {
    // subscription_cancel_at may not exist — retry with status only.
    await admin
      .from('plans')
      .update({ subscription_status: status })
      .eq('stripe_subscription_id', subscriptionId)
  }
}

// Record a recurring monthly invoice as a payment against the plan, bumping
// plans.paid and adding a payment history row — mirroring how one-time and
// manual payments appear in the client's Account. De-duped by invoice id
// stored in notes (best-effort) so Stripe retries don't double-count.
export async function recordRecurringInvoice(
  admin: any,
  params: {
    subscriptionId: string
    amountCents: number
    currency: string
    paidAtUnix: number | null
    invoiceId?: string | null
  }
): Promise<void> {
  const plan = await findPlanBySubscription(admin, params.subscriptionId)
  if (!plan) return

  const amount = (Number(params.amountCents) || 0) / 100
  if (!(amount > 0)) return

  const paidDate = params.paidAtUnix
    ? new Date(params.paidAtUnix * 1000).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

  // De-dupe on invoice id when we have one (stored in the notes string).
  if (params.invoiceId) {
    const { data: existing } = await admin
      .from('payments')
      .select('id')
      .eq('plan_id', plan.id)
      .ilike('notes', `%${params.invoiceId}%`)
      .maybeSingle()
    if (existing) return
  }

  const notes = params.invoiceId
    ? `Monthly subscription payment (${params.invoiceId})`
    : 'Monthly subscription payment'

  // Record the payment (with legacy fallback), then bump plans.paid.
  const base: Record<string, any> = {
    plan_id: plan.id,
    amount,
    payment_date: paidDate,
    notes,
  }
  const full = await admin
    .from('payments')
    .insert({ ...base, payment_type: 'programming', client_id: plan.client_id })
    .select('id')
    .single()
  if (full.error) {
    await admin.from('payments').insert(base)
  }

  const newPaid = (Number(plan.paid) || 0) + amount
  await admin.from('plans').update({ paid: newPaid }).eq('id', plan.id)

  // A successful recurring charge means the subscription is active again.
  await setSubscriptionStatus(admin, params.subscriptionId, 'active')
}

// If a subscription was configured to run only N months, cancel it once N
// invoices have been paid. We count paid monthly-subscription payment rows for
// the plan and compare to recur_months stored on the originating payment
// request. Cancels on the CONNECTED account.
export async function enforceRecurMonths(
  admin: any,
  stripe: Stripe,
  params: { subscriptionId: string; connectedAccount: string | null }
): Promise<void> {
  const plan = await findPlanBySubscription(admin, params.subscriptionId)
  if (!plan) return

  // recur_months lives on the payment_request that created this subscription.
  const { data: pr } = await admin
    .from('payment_requests')
    .select('recur_months')
    .eq('stripe_subscription_id', params.subscriptionId)
    .maybeSingle()
  const recurMonths = pr?.recur_months ? Number(pr.recur_months) : 0
  if (!recurMonths || recurMonths <= 0) return // open-ended; nothing to enforce

  // Count monthly subscription payments recorded for this plan.
  const { count } = await admin
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', plan.id)
    .ilike('notes', '%subscription payment%')
  const paidCount = count || 0

  if (paidCount >= recurMonths) {
    // Stop at period end so the client keeps access through the month they
    // already paid for; subscription.deleted will complete the plan when it
    // actually ends.
    try {
      await stripe.subscriptions.update(
        params.subscriptionId,
        { cancel_at_period_end: true },
        params.connectedAccount ? { stripeAccount: params.connectedAccount } : undefined
      )
      await setSubscriptionStatus(admin, params.subscriptionId, 'canceling')
    } catch (err: any) {
      console.error('[subscriptions] enforceRecurMonths cancel failed:', err?.message)
    }
  }
}

// Store the current billing period on the plan (shown instead of the fixed
// start/end dates for a subscription). Values are Stripe UNIX seconds.
// Best-effort: swallows missing-column errors on older schemas.
export async function setCurrentPeriod(
  admin: any,
  subscriptionId: string,
  periodStartUnix: number | null,
  periodEndUnix: number | null
): Promise<void> {
  if (!periodStartUnix && !periodEndUnix) return
  const update: Record<string, any> = {}
  if (periodStartUnix) update.current_period_start = new Date(periodStartUnix * 1000).toISOString()
  if (periodEndUnix) update.current_period_end = new Date(periodEndUnix * 1000).toISOString()
  const res = await admin
    .from('plans')
    .update(update)
    .eq('stripe_subscription_id', subscriptionId)
  if (res.error) {
    // Columns may not exist yet — ignore silently.
  }
}

// Subscription ended — mark the plan completed so it no longer shows as an
// active recurring plan on the client's account.
export async function endSubscription(admin: any, subscriptionId: string): Promise<void> {
  const plan = await findPlanBySubscription(admin, subscriptionId)
  if (!plan) return
  await setSubscriptionStatus(admin, subscriptionId, 'canceled')
  // Complete the plan (best-effort; keep status update even if reason col missing).
  const res = await admin
    .from('plans')
    .update({ status: 'completed', completion_reason: 'Subscription ended' })
    .eq('id', plan.id)
  if (res.error) {
    await admin.from('plans').update({ status: 'completed' }).eq('id', plan.id)
  }
}
