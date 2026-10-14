import { provisionClientFromApplication } from '@/lib/provision-client'

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
  }

  await admin
    .from('payment_requests')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: params.paymentIntentId || pr.stripe_payment_intent_id || null,
      provisioned_user_id: provisionedUserId || pr.provisioned_user_id || null,
    })
    .eq('id', pr.id)

  return { ok: true, userId: provisionedUserId }
}
