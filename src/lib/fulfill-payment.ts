import { provisionClientFromApplication } from '@/lib/provision-client'
import { loadPackage, createPlanFromPackage, recordProgrammingPayment } from '@/lib/plan-from-package'

// Shared fulfillment: mark a payment request paid and provision the client's
// account. Idempotent — safe to call from BOTH the Stripe webhook and the
// /pay success return, and safe to call more than once (webhooks retry).
//
// `admin` must be a service-role Supabase client.
export async function fulfillPaymentRequest(
  admin: any,
  params: { paymentRequestId: string; paymentIntentId?: string | null }
): Promise<{ ok: boolean; alreadyDone?: boolean; userId?: string; error?: string }> {
  const { data: pr } = await admin
    .from('payment_requests')
    .select('*')
    .eq('id', params.paymentRequestId)
    .maybeSingle()

  if (!pr) return { ok: false, error: 'payment request not found' }

  // Already fulfilled — no-op (idempotent).
  if (pr.status === 'paid' && pr.provisioned_user_id) {
    return { ok: true, alreadyDone: true, userId: pr.provisioned_user_id }
  }

  // Load the application this payment is for.
  let application: any = null
  if (pr.application_id) {
    const { data } = await admin
      .from('coach_applications')
      .select('*')
      .eq('id', pr.application_id)
      .maybeSingle()
    application = data
  }

  // Resolve the coach's display name for the invite email.
  const { data: coach } = await admin
    .from('users')
    .select('name')
    .eq('id', pr.coach_id)
    .maybeSingle()

  let provisionedUserId: string | undefined
  let clientId: string | undefined
  let planId: string | undefined

  if (application) {
    const result = await provisionClientFromApplication(admin, {
      application,
      coachId: pr.coach_id,
      organizationId: pr.organization_id,
      coachName: coach?.name || 'Your coach',
    })
    if (!result.ok) {
      // Still mark the payment as paid (money changed hands); surface the error
      // so it can be retried / handled, but don't lose the payment record.
      await admin
        .from('payment_requests')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: params.paymentIntentId || pr.stripe_payment_intent_id || null,
        })
        .eq('id', pr.id)
      return { ok: false, error: result.error || 'account provisioning failed' }
    }
    provisionedUserId = result.userId
    clientId = result.clientId
    planId = result.planId
  }

  // --- Ensure a plan + record the money collected on the client's account ---
  // Provisioning creates a plan from the application's selected package. On an
  // idempotent retry (already_accepted) it won't return clientId/planId, so
  // resolve them here; and if no plan exists yet (e.g. package only set on the
  // payment_request), create one from the package.
  try {
    if (!clientId && provisionedUserId) {
      const { data: c } = await admin
        .from('clients')
        .select('id')
        .eq('user_id', provisionedUserId)
        .maybeSingle()
      clientId = c?.id
    }

    const packageId = pr.package_id || application?.selected_package_id || null

    if (!planId && clientId) {
      // Reuse an existing active plan if present, else create one from the package.
      const { data: activePlan } = await admin
        .from('plans')
        .select('id')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .maybeSingle()
      if (activePlan) {
        planId = activePlan.id
      } else if (packageId) {
        const pkg = await loadPackage(admin, packageId)
        if (pkg) {
          const created = await createPlanFromPackage(admin, {
            clientId,
            coachId: pr.coach_id,
            organizationId: pr.organization_id,
            pkg,
            application,
          })
          if (created.ok) planId = created.planId
        }
      }
    }

    // Record the Stripe payment (full amount paid) against the plan — appears
    // in the client's payment history exactly like a manually-logged payment.
    let paymentId: string | undefined
    if (planId && clientId) {
      const amount = (Number(pr.amount_cents) || 0) / 100
      const paidDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      const rec = await recordProgrammingPayment(admin, {
        planId,
        clientId,
        amount,
        notes: `Paid on ${paidDate} via Stripe`,
        packageId,
        paymentRequestId: pr.id,
      })
      if (rec.ok) paymentId = rec.paymentId
    }

    // Mark the request paid and link it back to the plan/payment it produced.
    const paidUpdate = {
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: params.paymentIntentId || pr.stripe_payment_intent_id || null,
      provisioned_user_id: provisionedUserId || pr.provisioned_user_id || null,
    }
    const linkedUpdate = {
      ...paidUpdate,
      plan_id: planId || pr.plan_id || null,
      payment_id: paymentId || pr.payment_id || null,
    }
    const linkResult = await admin.from('payment_requests').update(linkedUpdate).eq('id', pr.id)
    if (linkResult.error) {
      // plan_id/payment_id columns may not exist yet — still mark it paid.
      await admin.from('payment_requests').update(paidUpdate).eq('id', pr.id)
    }
  } catch (err: any) {
    // Plan/payment linking is best-effort — never lose the "paid" status.
    console.error('[fulfill] plan/payment recording failed (non-fatal):', err?.message)
    await admin
      .from('payment_requests')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: params.paymentIntentId || pr.stripe_payment_intent_id || null,
        provisioned_user_id: provisionedUserId || pr.provisioned_user_id || null,
      })
      .eq('id', pr.id)
  }

  return { ok: true, userId: provisionedUserId }
}
