import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveCoachRequestScope } from '@/lib/coach-scope'
import { loadPackage, createPlanFromPackage } from '@/lib/plan-from-package'

// Authenticated COACH-facing endpoint to create a payment request for an
// applicant, and list a coach's payment requests.
//   GET  /api/payment-requests?application=<id>  -> list (optionally for one app)
//   POST /api/payment-requests                   -> create + email the client a
//                                                   link to pay
//
// Payment goes directly to the coach's connected Stripe account (set up in
// Step B). On successful payment the client's account is auto-provisioned.
// Super-admin "view as coach" honored via ?org=&coach= / body org/coach.

async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function siteUrl(request: Request): Promise<string> {
  // The pay link in the email must point to an environment that actually has
  // the /pay page + payment_requests data. Prefer an explicit stable base
  // (STRIPE_CONNECT_REDIRECT_BASE / NEXT_PUBLIC_SITE_URL), else the request
  // origin (so a preview links back to the preview), else production.
  const explicit = process.env.STRIPE_CONNECT_REDIRECT_BASE || process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')
  try {
    const origin = new URL(request.url).origin
    if (origin && !origin.includes('localhost')) return origin.replace(/\/$/, '')
  } catch { /* fall through */ }
  const { getProductionUrl } = await import('@/lib/email')
  return getProductionUrl(request.url)
}

function randomToken(): string {
  const uuid = (globalThis.crypto?.randomUUID?.() as string) || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return uuid.replace(/-/g, '')
}

// --- GET: list payment requests for the coach (optionally one application) ---
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const orgOverride = searchParams.get('org')
  const coachOverride = searchParams.get('coach')
  const applicationId = searchParams.get('application')
  const clientFilter = searchParams.get('client')

  const admin = await createAdminClient()
  const scopeResult = await resolveCoachRequestScope(admin, user.id, orgOverride, coachOverride)
  if (!scopeResult.scope) {
    return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  }
  const { coachId } = scopeResult.scope

  let query = admin
    .from('payment_requests')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })
  if (applicationId) query = query.eq('application_id', applicationId)
  if (clientFilter) query = query.eq('client_id', clientFilter)

  const { data, error } = await query
  if (error) {
    // client_id column may not exist yet — retry without that filter.
    if (clientFilter) {
      const retry = await admin
        .from('payment_requests')
        .select('*')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false })
      if (!retry.error) return NextResponse.json({ paymentRequests: retry.data || [] })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ paymentRequests: data || [] })
}

// --- POST: create a payment request for an application + package ---
//   body: { application_id, package_id?, amount?, org?, coach? }
// If package_id is given, amount/currency/interval are snapshotted from it.
// If amount is given instead (custom one-off), it's used directly (one_time).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const {
    application_id, client_id, package_id, amount, custom_name, custom_duration_weeks,
    start_date, request_assessment, request_cycle_tracking, manual, recur_months,
    org: orgOverride, coach: coachOverride,
  } = body || {}

  // A request targets EITHER a new application OR an existing client (renewal).
  if (!application_id && !client_id) {
    return NextResponse.json({ error: 'application_id or client_id is required' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const scopeResult = await resolveCoachRequestScope(admin, user.id, orgOverride, coachOverride)
  if (!scopeResult.scope) {
    return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  }
  const { coachId, organizationId } = scopeResult.scope

  // The coach must have a Stripe account that can accept charges.
  const { data: coach } = await admin
    .from('users')
    .select('name, stripe_account_id, stripe_charges_enabled')
    .eq('id', coachId)
    .maybeSingle()
  if (!coach?.stripe_account_id || !coach.stripe_charges_enabled) {
    return NextResponse.json(
      { error: 'Connect your Stripe account (and finish onboarding) before requesting payments.' },
      { status: 400 }
    )
  }

  // Resolve the target: an application (new signup) OR an existing client.
  let application: any = null
  let existingClient: any = null
  if (application_id) {
    const { data } = await admin
      .from('coach_applications')
      .select('*')
      .eq('id', application_id)
      .maybeSingle()
    if (!data) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    if (data.coach_id !== coachId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    application = data
  } else {
    // Existing client renewal: load the client + verify this coach is assigned.
    // NOTE: clients has no organization_id column — the org lives on users.
    const { data: cli, error: cliErr } = await admin
      .from('clients')
      .select('id, user_id')
      .eq('id', client_id)
      .maybeSingle()
    if (cliErr || !cli) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    const { data: assignment } = await admin
      .from('client_coaches')
      .select('id')
      .eq('client_id', cli.id)
      .eq('coach_id', coachId)
      .maybeSingle()
    if (!assignment) return NextResponse.json({ error: 'This client isn\u2019t assigned to you.' }, { status: 403 })
    // Grab the client's email/name/org for the payment + email.
    const { data: cliUser } = await admin
      .from('users')
      .select('email, name, organization_id')
      .eq('id', cli.user_id)
      .maybeSingle()
    existingClient = { id: cli.id, user_id: cli.user_id, organization_id: cliUser?.organization_id || null, email: cliUser?.email || null, name: cliUser?.name || null }
    if (!existingClient.email) {
      return NextResponse.json({ error: 'This client has no email on file.' }, { status: 400 })
    }
  }

  // Is this a RENEWAL (continuing training) vs. a FIRST package for a new client?
  // A client set up manually (no application) who has no prior plans is a new
  // onboarding → new-client wording. A client with any existing plan is renewing.
  let isRenewalCharge = false
  if (existingClient) {
    const { count: priorPlans } = await admin
      .from('plans')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', existingClient.id)
    isRenewalCharge = (priorPlans || 0) > 0
  }

  // Determine the amount: from a package, or a custom amount.
  let amountCents: number
  let currency = 'usd'
  let billingInterval: 'monthly' | 'one_time' = 'one_time'
  let packageName: string | null = null
  let resolvedPackageId: string | null = null
  // A monthly package carries its own recur_months (how many months to bill,
  // auto-derived from the program length). This is the default unless the
  // request body explicitly overrides it below.
  let packageRecurMonths: number | null = null

  // A custom amount is used when `amount` is provided AND no explicit package_id
  // was chosen. (Don't fall back to the applicant's selected_package_id in that
  // case — the coach deliberately chose a custom charge.)
  const useCustomAmount = amount != null && String(amount).trim() !== '' && !package_id
  const pkgId = useCustomAmount ? null : (package_id || application?.selected_package_id || null)
  if (pkgId) {
    // Try selecting recur_months (newer column); fall back if it doesn't exist.
    let pkg: any = null
    const withRecur = await admin
      .from('coach_packages')
      .select('id, name, price_cents, currency, billing_interval, coach_id, recur_months')
      .eq('id', pkgId)
      .maybeSingle()
    if (!withRecur.error) {
      pkg = withRecur.data
    } else {
      const base = await admin
        .from('coach_packages')
        .select('id, name, price_cents, currency, billing_interval, coach_id')
        .eq('id', pkgId)
        .maybeSingle()
      pkg = base.data
    }
    if (!pkg || pkg.coach_id !== coachId) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }
    amountCents = pkg.price_cents
    currency = pkg.currency || 'usd'
    billingInterval = pkg.billing_interval === 'monthly' ? 'monthly' : 'one_time'
    packageName = pkg.name
    resolvedPackageId = pkg.id
    packageRecurMonths = pkg.recur_months != null && Number(pkg.recur_months) > 0 ? Number(pkg.recur_months) : null
  } else if (useCustomAmount) {
    const cents = Math.round(Number(String(amount).replace(/[^0-9.]/g, '')) * 100)
    if (!Number.isFinite(cents) || cents <= 0) {
      return NextResponse.json({ error: 'A valid amount is required' }, { status: 400 })
    }
    amountCents = cents
    billingInterval = 'one_time' // custom charges are always one-time for now
    packageName = (custom_name && String(custom_name).trim()) || 'Custom coaching'
  } else {
    return NextResponse.json({ error: 'Provide a package or an amount' }, { status: 400 })
  }

  // --- MANUAL (offline) collection: create the plan NOW, no Stripe request. ---
  // The coach collects payment themselves and logs it via "Log Payment" after.
  if (manual) {
    if (!existingClient?.id) {
      return NextResponse.json({ error: 'Manual plans are created from a client\u2019s account.' }, { status: 400 })
    }
    const startDate = start_date && /^\d{4}-\d{2}-\d{2}$/.test(start_date) ? start_date : new Date().toISOString().split('T')[0]
    // Mark any existing active plan complete (one active plan at a time).
    try {
      await admin.from('plans').update({ status: 'completed', completion_reason: 'Replaced by a new plan' }).eq('client_id', existingClient.id).eq('status', 'active')
    } catch {
      await admin.from('plans').update({ status: 'completed' }).eq('client_id', existingClient.id).eq('status', 'active')
    }

    let planId: string | undefined
    if (resolvedPackageId) {
      const pkg = await loadPackage(admin, resolvedPackageId)
      if (pkg) {
        const created = await createPlanFromPackage(admin, {
          clientId: existingClient.id,
          coachId,
          organizationId: organizationId || existingClient.organization_id || null,
          pkg,
          startDate,
        })
        if (!created.ok) return NextResponse.json({ error: created.error || 'Could not create the plan.' }, { status: 500 })
        planId = created.planId
      }
    } else {
      // Custom manual plan: minimal programming-only plan spanning the given weeks.
      const wk = custom_duration_weeks != null && String(custom_duration_weeks).trim() !== ''
        ? parseInt(String(custom_duration_weeks).replace(/[^0-9]/g, ''), 10)
        : 0
      const weeks = wk > 0 ? wk : 1
      const endObj = new Date(startDate + 'T00:00:00')
      endObj.setDate(endObj.getDate() + weeks * 7)
      const end = endObj.toISOString().split('T')[0]
      const owed = amountCents / 100
      const minimal: Record<string, any> = {
        client_id: existingClient.id,
        start_date: startDate,
        end_date: end,
        goal: packageName,
        owed,
        paid: 0,
        status: 'active',
        billing_mode: 'programming_only',
        program_loaded: true,
      }
      let created = await admin.from('plans').insert(minimal).select('id').single()
      if (created.error) {
        const base = { client_id: existingClient.id, start_date: startDate, end_date: end, goal: packageName, owed, paid: 0, status: 'active' }
        created = await admin.from('plans').insert(base).select('id').single()
      }
      if (created.error) return NextResponse.json({ error: created.error.message }, { status: 500 })
      planId = created.data.id
    }

    // Apply assessment / cycle-tracking requests (same as provisioning).
    if (request_assessment) {
      try { await admin.from('client_assessments').upsert({ client_id: existingClient.id, status: 'review_requested', review_requested_at: new Date().toISOString() }, { onConflict: 'client_id' }) } catch {}
    }
    if (request_cycle_tracking) {
      try { await admin.from('clients').update({ cycle_tracking_requested: true }).eq('id', existingClient.id) } catch {}
    }

    return NextResponse.json({ success: true, manual: true, planId })
  }

  // Monthly packages create a recurring subscription at checkout (mode
  // 'subscription' in /api/pay). recur_months (optional) caps how many months
  // it bills before auto-cancelling; blank = until the coach cancels.
  // Months to bill a monthly subscription: an explicit request-body override
  // wins; otherwise use the package's own recur_months (derived from the
  // program length). null = bill until cancelled.
  const recurMonthsOverride = recur_months != null && String(recur_months).trim() !== ''
    ? parseInt(String(recur_months).replace(/[^0-9]/g, ''), 10)
    : null
  const recurMonthsInt = billingInterval === 'monthly'
    ? (recurMonthsOverride && recurMonthsOverride > 0 ? recurMonthsOverride : packageRecurMonths)
    : null
  const token = randomToken()

  const baseRow: Record<string, any> = {
    coach_id: coachId,
    organization_id: organizationId || application?.organization_id || existingClient?.organization_id || null,
    application_id: application_id || null,
    package_id: resolvedPackageId,
    amount_cents: amountCents,
    currency,
    billing_interval: billingInterval,
    package_name: packageName,
    client_email: String(application?.email || existingClient?.email).trim().toLowerCase(),
    client_name: String(application?.full_name || existingClient?.name || '').trim(),
    token,
    status: 'pending',
  }
  // start_date + setup flags are newer columns — try with them, fall back without.
  const customWeeksInt = custom_duration_weeks != null && String(custom_duration_weeks).trim() !== ''
    ? parseInt(String(custom_duration_weeks).replace(/[^0-9]/g, ''), 10)
    : null
  // client_id is CRITICAL for a renewal (fulfillment + the pending banner key
  // off it), so it goes in baseRow — never dropped by a fallback.
  if (existingClient?.id) baseRow.client_id = existingClient.id

  // Newer, individually-optional columns. Any of these may be absent on a DB
  // that hasn't run every migration yet — so we insert with all of them, then
  // peel off ONE missing column at a time (keeping client_id + everything else).
  const optionalCols: Record<string, any> = {
    start_date: start_date && /^\d{4}-\d{2}-\d{2}$/.test(start_date) ? start_date : null,
    request_assessment: !!request_assessment,
    request_cycle_tracking: !!request_cycle_tracking,
    custom_duration_weeks: useCustomAmount && customWeeksInt && customWeeksInt > 0 ? customWeeksInt : null,
    is_renewal: isRenewalCharge,
    recur_months: recurMonthsInt && recurMonthsInt > 0 ? recurMonthsInt : null,
  }

  // Attempt insert; on an "unknown column" error, drop the named column and retry.
  async function insertWithFallback(): Promise<{ data: any; error: any }> {
    const cols = { ...optionalCols }
    for (let i = 0; i <= Object.keys(optionalCols).length; i++) {
      const res = await admin.from('payment_requests').insert({ ...baseRow, ...cols }).select('*').single()
      if (!res.error) return res
      // Find which optional column the error names and drop it, then retry.
      const msg = String(res.error.message || '').toLowerCase()
      const bad = Object.keys(cols).find((k) => msg.includes(k))
      if (bad) { delete cols[bad]; continue }
      // Error isn't about a known optional column — last resort: base row only.
      return await admin.from('payment_requests').insert(baseRow).select('*').single()
    }
    return await admin.from('payment_requests').insert(baseRow).select('*').single()
  }

  const { data: created, error: insertErr } = await insertWithFallback()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Email the client a link to pay.
  const base = await siteUrl(request)
  const payUrl = `${base}/pay/${token}`
  try {
    await sendPaymentRequestEmail({
      to: created.client_email,
      clientName: created.client_name || 'there',
      coachName: coach.name || 'Your coach',
      amountCents,
      currency,
      packageName,
      payUrl,
      isRenewal: isRenewalCharge, // only "continuing" wording when they have prior plans
      billingInterval,
      recurMonths: recurMonthsInt && recurMonthsInt > 0 ? recurMonthsInt : null,
    })
  } catch (err) {
    console.error('Payment request email failed:', err)
    // Non-fatal: the coach can copy the link from the UI.
  }

  return NextResponse.json({ paymentRequest: created, payUrl })
}

// --- PATCH: cancel a pending payment request ---
//   body: { id, action: 'cancel', org?, coach? }
// Marks a still-pending request 'cancelled' so the coach can stop chasing a
// client who decided not to proceed. The pay link stops working (the /pay
// checkout refuses non-pending requests). Only the owning coach can cancel.
export async function PATCH(request: Request) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { id, action, org: orgOverride, coach: coachOverride } = body || {}
  if (!id || action !== 'cancel') {
    return NextResponse.json({ error: 'id and action="cancel" are required' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const scopeResult = await resolveCoachRequestScope(admin, user.id, orgOverride, coachOverride)
  if (!scopeResult.scope) {
    return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  }
  const { coachId } = scopeResult.scope

  // Load + verify ownership and that it's still cancellable.
  const { data: pr } = await admin
    .from('payment_requests')
    .select('id, coach_id, status')
    .eq('id', id)
    .maybeSingle()
  if (!pr) return NextResponse.json({ error: 'Payment request not found' }, { status: 404 })
  if (pr.coach_id !== coachId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (pr.status === 'paid') return NextResponse.json({ error: 'This payment was already completed.' }, { status: 409 })
  if (pr.status !== 'pending') return NextResponse.json({ error: `This request is already ${pr.status}.` }, { status: 409 })

  const { error } = await admin
    .from('payment_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, status: 'cancelled' })
}

// Simple branded email with a "Pay now" button (raw Resend, mirrors notifyCoach).
// `isRenewal` switches the copy between "new client, create your account" and
// "existing client, continue coaching" wording.
async function sendPaymentRequestEmail(params: {
  to: string
  clientName: string
  coachName: string
  amountCents: number
  currency: string
  packageName: string | null
  payUrl: string
  isRenewal?: boolean
  billingInterval?: 'monthly' | 'one_time'
  recurMonths?: number | null
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const senderEmail = process.env.FIRSTMILE_SENDER_EMAIL || process.env.SENDER_EMAIL || 'noreply@firstmilecoach.com'
  const amount = (params.amountCents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: (params.currency || 'usd').toUpperCase(),
    minimumFractionDigits: params.amountCents % 100 === 0 ? 0 : 2,
  })
  const first = (params.clientName || '').split(' ')[0] || 'there'
  const what = params.packageName ? ` for <strong>${params.packageName}</strong>` : ''
  const whatText = params.packageName ? ` for ${params.packageName}` : ''
  const renewal = !!params.isRenewal
  const isSubscription = params.billingInterval === 'monthly'
  const months = params.recurMonths && params.recurMonths > 0 ? params.recurMonths : null

  // Human terms line for a subscription (reused in HTML + text + button area).
  const subTerms = isSubscription
    ? (months
        ? `${amount}/month for ${months} month${months === 1 ? '' : 's'}`
        : `${amount}/month, ongoing until cancelled`)
    : amount

  // Copy differs for a subscription vs. a one-time payment, and (for one-time)
  // for a brand-new client vs. an existing client renewing.
  const subject = isSubscription
    ? `Set up your monthly coaching subscription with ${params.coachName}`
    : renewal
      ? `Complete your payment to continue coaching with ${params.coachName}`
      : `Complete your payment to start coaching with ${params.coachName}`
  const heading = isSubscription
    ? (renewal ? `Ready for what's next, ${first}?` : `You're almost in, ${first}!`)
    : (renewal ? `Ready for what's next, ${first}?` : `You're almost in, ${first}!`)
  const bodyLine = isSubscription
    ? `${params.coachName} has set up a <strong>monthly coaching subscription</strong>${what}. You'll be billed <strong style="color:#2d3436;">${subTerms}</strong>. Set it up below to get started${renewal ? '' : ' and activate your account'}.`
    : renewal
      ? `${params.coachName} has set up your next block${what}. Complete your payment of <strong style="color:#2d3436;">${amount}</strong> to continue your coaching.`
      : `${params.coachName} has set up your coaching${what}. Complete your payment of <strong style="color:#2d3436;">${amount}</strong> to activate your account and get started.`
  const footerNote = isSubscription
    ? `Payment is handled securely by Stripe. You can cancel your subscription anytime by contacting ${params.coachName}.`
    : renewal
      ? `Payment is handled securely by Stripe. Your coaching continues once your payment is complete.`
      : `Payment is handled securely by Stripe. Your First Mile account is created once your payment is complete.`
  const bodyLineText = isSubscription
    ? `${params.coachName} has set up a monthly coaching subscription${whatText}. You'll be billed ${subTerms}. Set it up here${renewal ? '' : ' to activate your account'}:`
    : renewal
      ? `${params.coachName} has set up your next block${whatText}. Complete your payment of ${amount} to continue your coaching:`
      : `${params.coachName} has set up your coaching${whatText}. Complete your payment of ${amount} to activate your account:`
  // CTA button label.
  const buttonLabel = isSubscription ? `SUBSCRIBE · ${amount}/MO` : `PAY ${amount}`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: `First Mile Coach <${senderEmail}>`,
      to: [params.to],
      reply_to: 'hello@firstmilecoach.com',
      subject,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fafbfc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafbfc;padding:40px 20px;"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,0.08);overflow:hidden;">
      <tr><td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(145deg,#2d3436,#3d4447);">
        <img src="https://www.firstmilecoach.com/firstmile/logo.png" alt="First Mile Coach" width="160" style="display:block;margin:0 auto;border-radius:8px;" />
      </td></tr>
      <tr><td style="padding:40px 32px;">
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#2d3436;">${heading}</h1>
        <p style="margin:0 0 20px;font-size:16px;color:#555b5e;line-height:1.7;">
          ${bodyLine}
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 8px;"><tr>
          <td align="center" style="border-radius:50px;background:#f26522;">
            <a href="${params.payUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:16px;font-weight:700;color:#fff;text-decoration:none;border-radius:50px;">${buttonLabel}</a>
          </td>
        </tr></table>
        <p style="margin:16px 0 0;font-size:13px;color:#9aa0a4;line-height:1.6;text-align:center;">
          ${footerNote}
        </p>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid rgba(0,0,0,0.06);text-align:center;background:#fafbfc;">
        <p style="margin:0;font-size:12px;color:#9e9e9e;">First Mile Coach</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
      text: `${heading}\n\n${bodyLineText}\n\n${params.payUrl}\n\n${footerNote}`,
    }),
  })
}
