import { sendClientInviteEmail, getBrandFromDomain } from '@/lib/invite-emails'
import { loadPackage, createPlanFromPackage } from '@/lib/plan-from-package'

// Shared "create (or link) a client account and assign a coach" logic.
//
// This is the SINGLE source of truth for provisioning a client from an
// accepted application — used by:
//   * POST /api/coach-applications (coach manually accepts), and
//   * the Stripe payment-success handler (auto-provision on paid application).
//
// It mirrors the original inline logic exactly:
//   existing user  -> ensure clients row + assign coach (dual-role)
//   new user       -> generateLink(invite) + sendClientInviteEmail + users
//                     update + clients insert + client_coaches insert
//
// Idempotent & safe to call more than once (payment webhooks can retry):
//   - if the application is already accepted, it no-ops
//   - if a user already exists for the email, it links instead of re-inviting
//
// `admin` must be a service-role Supabase client.

export type ProvisionResult = {
  ok: boolean
  status: 'accepted' | 'already_accepted' | 'error'
  userId?: string
  clientId?: string
  planId?: string
  dualRole?: boolean
  emailSent?: boolean
  message?: string
  error?: string
}

// Create a plan (from the application's selected package) on a freshly
// provisioned client, so an application-based client lands with the same
// Plans & Payments structure as a manually-created one. Best-effort: never
// fails provisioning — if there's no package or the plan can't be created, the
// coach can still set up the plan manually. Returns the created plan id (if any).
async function createPlanForProvisionedClient(
  admin: any,
  params: { application: any; clientId: string; coachId: string; organizationId?: string | null; startDate?: string | null }
): Promise<string | undefined> {
  const packageId = params.application?.selected_package_id
  if (!packageId) return undefined // no package selected -> coach sets up the plan manually

  // Don't create a second plan if this client already has an active one.
  const { data: existingPlan } = await admin
    .from('plans')
    .select('id')
    .eq('client_id', params.clientId)
    .eq('status', 'active')
    .maybeSingle()
  if (existingPlan) return existingPlan.id

  try {
    const pkg = await loadPackage(admin, packageId)
    if (!pkg) return undefined
    const result = await createPlanFromPackage(admin, {
      clientId: params.clientId,
      coachId: params.coachId,
      organizationId: params.organizationId,
      pkg,
      application: params.application,
      startDate: params.startDate || null,
    })
    return result.ok ? result.planId : undefined
  } catch (err) {
    console.error('[provision] createPlanFromPackage failed (non-fatal):', err)
    return undefined
  }
}

// Apply the coach's setup choices to a client once it exists:
//   * request_assessment    -> set client_assessments.status = 'review_requested'
//   * request_cycle_tracking -> set clients.cycle_tracking_requested = true (women)
// Best-effort — never fails provisioning.
async function applyClientSetup(
  admin: any,
  params: { clientId: string; requestAssessment?: boolean; requestCycleTracking?: boolean }
): Promise<void> {
  if (params.requestAssessment) {
    try {
      await admin
        .from('client_assessments')
        .upsert(
          { client_id: params.clientId, status: 'review_requested', review_requested_at: new Date().toISOString() },
          { onConflict: 'client_id' }
        )
    } catch (err) {
      console.error('[provision] request assessment failed (non-fatal):', err)
    }
  }
  if (params.requestCycleTracking) {
    try {
      await admin.from('clients').update({ cycle_tracking_requested: true }).eq('id', params.clientId)
    } catch (err) {
      console.error('[provision] request cycle tracking failed (non-fatal):', err)
    }
  }
}

export async function provisionClientFromApplication(
  admin: any,
  params: {
    application: any       // the coach_applications row
    coachId: string
    organizationId?: string | null
    coachName?: string
    // Coach setup choices (from the Accept / Request-payment modal):
    startDate?: string | null
    requestAssessment?: boolean
    requestCycleTracking?: boolean
  }
): Promise<ProvisionResult> {
  const { application, coachId } = params
  const organizationId = params.organizationId ?? null
  const coachName = params.coachName || 'Your coach'

  // Idempotency: if already accepted/provisioned, don't do it again.
  if (application.status === 'accepted' && application.accepted_user_id) {
    return { ok: true, status: 'already_accepted', userId: application.accepted_user_id }
  }

  const email = String(application.email).trim().toLowerCase()
  const name = String(application.full_name).trim()
  const orgId = organizationId || application.organization_id || null

  // --- Existing user (dual-role): link, don't re-invite ---
  const { data: existingUser } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingUser) {
    const { data: existingClient } = await admin
      .from('clients')
      .select('id')
      .eq('user_id', existingUser.id)
      .maybeSingle()

    let clientId = existingClient?.id
    if (!clientId) {
      const { data: created, error: createErr } = await admin
        .from('clients')
        .insert({
          user_id: existingUser.id,
          goal: application.primary_goal || null,
          owed: 0,
          paid: 0,
        })
        .select('id')
        .single()
      if (createErr) return { ok: false, status: 'error', error: createErr.message }
      clientId = created.id
    }

    try {
      const { data: existingAssignments } = await admin
        .from('client_coaches')
        .select('id')
        .eq('client_id', clientId)
      await admin
        .from('client_coaches')
        .upsert(
          { client_id: clientId, coach_id: coachId, is_default: !existingAssignments || existingAssignments.length === 0 },
          { onConflict: 'client_id,coach_id' }
        )
    } catch (err) {
      console.error('Failed to assign coach to existing user:', err)
    }

    await admin
      .from('coach_applications')
      .update({ status: 'accepted', reviewed_at: new Date().toISOString(), accepted_user_id: existingUser.id })
      .eq('id', application.id)

    // Stamp out a plan from the selected package (if any) so the client's
    // Account page shows the purchased plan + what they owe immediately.
    const planId = await createPlanForProvisionedClient(admin, {
      application,
      clientId,
      coachId,
      organizationId: orgId,
      startDate: params.startDate || null,
    })

    // Apply the coach's setup choices (assessment / cycle tracking).
    await applyClientSetup(admin, {
      clientId,
      requestAssessment: params.requestAssessment,
      requestCycleTracking: params.requestCycleTracking,
    })

    return {
      ok: true,
      status: 'accepted',
      userId: existingUser.id,
      clientId,
      planId,
      dualRole: true,
      message: `${name} already had an account and has been added as a client.`,
    }
  }

  // --- New user: invite link (no built-in email) + branded email ---
  // The invite must send the client back to THIS environment to set their
  // password. On staging/preview, STRIPE_CONNECT_REDIRECT_BASE (or
  // NEXT_PUBLIC_SITE_URL) points at the staging URL; otherwise default to
  // production. (This runs server-side with no request origin available.)
  const orgDomain = 'firstmilecoach.com'
  const explicitBase = process.env.STRIPE_CONNECT_REDIRECT_BASE || process.env.NEXT_PUBLIC_SITE_URL
  const baseUrl = (explicitBase ? explicitBase.replace(/\/$/, '') : 'https://www.firstmilecoach.com')

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: { name, role: 'client' },
      redirectTo: `${baseUrl}/auth/callback?next=/set-password`,
    },
  })

  if (linkError) {
    return { ok: false, status: 'error', error: linkError.message }
  }

  const newUserId = linkData.user.id
  const hashedToken = linkData.properties.hashed_token
  const confirmationUrl = `${baseUrl}/auth/callback?token_hash=${hashedToken}&type=invite&next=/set-password`

  let emailSent = false
  try {
    emailSent = await sendClientInviteEmail({
      to: email,
      clientName: name,
      coachName,
      confirmationUrl,
      brand: getBrandFromDomain(orgDomain),
    })
  } catch (err) {
    console.error(`[provision] invite email threw for ${email}:`, err)
  }
  if (!emailSent) {
    console.error(`[provision] Failed to send invite email to ${email}, but user ${newUserId} was created`)
  } else {
    console.log(`[provision] invite email sent to ${email}`)
  }

  const userUpdates: Record<string, any> = {}
  if (application.sex) userUpdates.gender = application.sex
  if (orgId) userUpdates.organization_id = orgId
  if (Object.keys(userUpdates).length > 0) {
    await admin.from('users').update(userUpdates).eq('id', newUserId)
  }

  const { data: newClientRecord, error: clientError } = await admin
    .from('clients')
    .insert({
      user_id: newUserId,
      goal: application.primary_goal || null,
      owed: 0,
      paid: 0,
    })
    .select('id')
    .single()

  if (clientError) {
    return { ok: false, status: 'error', error: clientError.message }
  }

  if (newClientRecord) {
    try {
      await admin
        .from('client_coaches')
        .insert({ client_id: newClientRecord.id, coach_id: coachId, is_default: true })
    } catch (err) {
      console.error('Failed to assign coach to new client:', err)
    }
  }

  await admin
    .from('coach_applications')
    .update({ status: 'accepted', reviewed_at: new Date().toISOString(), accepted_user_id: newUserId })
    .eq('id', application.id)

  // Stamp out a plan from the selected package (if any) so the client's
  // Account page shows the purchased plan + what they owe immediately.
  const planId = newClientRecord
    ? await createPlanForProvisionedClient(admin, {
        application,
        clientId: newClientRecord.id,
        coachId,
        organizationId: orgId,
        startDate: params.startDate || null,
      })
    : undefined

  // Apply the coach's setup choices (assessment / cycle tracking).
  if (newClientRecord) {
    await applyClientSetup(admin, {
      clientId: newClientRecord.id,
      requestAssessment: params.requestAssessment,
      requestCycleTracking: params.requestCycleTracking,
    })
  }

  return {
    ok: true,
    status: 'accepted',
    userId: newUserId,
    clientId: newClientRecord?.id,
    planId,
    emailSent,
    message: emailSent
      ? `Invite email sent to ${email}. ${name} is now a client.`
      : `${name} is now a client, but the invite email could not be sent.`,
  }
}
