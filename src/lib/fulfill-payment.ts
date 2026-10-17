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
      // Setup choices the coach made when requesting payment.
      startDate: pr.start_date || null,
      requestAssessment: !!pr.request_assessment,
      requestCycleTracking: !!pr.request_cycle_tracking,
      // The payment request is the source of truth for what the client paid for.
      // Use ITS package (the coach's choice at request time), NOT the applicant's
      // original selected_package_id. null here = custom charge (no package) →
      // provisioning skips plan creation and we build a minimal plan below.
      overridePackageId: pr.package_id || null,
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
  // Existing-client renewal: no application/provisioning — the client already
  // exists. Charge produces a NEW plan + payment on their account.
  const isRenewal = !application && !!pr.client_id
  if (isRenewal) clientId = pr.client_id

  try {
    if (!clientId && provisionedUserId) {
      const { data: c } = await admin
        .from('clients')
        .select('id')
        .eq('user_id', provisionedUserId)
        .maybeSingle()
      clientId = c?.id
    }

    // The payment request's package is authoritative — do NOT fall back to the
    // applicant's original selected_package_id (the coach may have changed it,
    // or chosen a custom amount with no package).
    const packageId = pr.package_id || null

    // A renewal always creates a NEW plan. Mark any existing active plan
    // complete first so the client has a single active plan (the new one).
    if (isRenewal && clientId) {
      try {
        await admin
          .from('plans')
          .update({ status: 'completed', completion_reason: 'Renewed into a new plan' })
          .eq('client_id', clientId)
          .eq('status', 'active')
      } catch {
        await admin.from('plans').update({ status: 'completed' }).eq('client_id', clientId).eq('status', 'active')
      }
    }

    if (!planId && clientId) {
      // For a NEW signup, reuse an existing active plan if present. For a
      // renewal we skip that (we just completed it) and always create a new one.
      const { data: activePlan } = isRenewal
        ? { data: null as any }
        : await admin
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
            startDate: pr.start_date || null,
          })
          if (created.ok) planId = created.planId
        }
      } else {
        // Custom one-time charge (no package): create a MINIMAL programming-only
        // plan so the client's Account shows what they paid, spanning the
        // coach-chosen program length. The coach fleshes out the program after.
        const start = (pr.start_date && /^\d{4}-\d{2}-\d{2}$/.test(pr.start_date))
          ? pr.start_date
          : new Date().toISOString().split('T')[0]
        const weeks = Number(pr.custom_duration_weeks) > 0 ? Number(pr.custom_duration_weeks) : 1
        const endObj = new Date(start + 'T00:00:00')
        endObj.setDate(endObj.getDate() + weeks * 7)
        const end = endObj.toISOString().split('T')[0]
        const owed = (Number(pr.amount_cents) || 0) / 100
        const minimal: Record<string, any> = {
          client_id: clientId,
          start_date: start,
          end_date: end,
          goal: application?.primary_goal || pr.package_name || null,
          owed,
          paid: 0,
          status: 'active',
          billing_mode: 'programming_only',
          program_loaded: true,
        }
        let created = await admin.from('plans').insert(minimal).select('id').single()
        if (created.error) {
          // Retry without newer columns for older schemas.
          const base = { client_id: clientId, start_date: start, end_date: end, goal: minimal.goal, owed, paid: 0, status: 'active' }
          created = await admin.from('plans').insert(base).select('id').single()
        }
        if (!created.error) planId = created.data.id
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
