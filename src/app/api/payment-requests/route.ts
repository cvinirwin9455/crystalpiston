import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveCoachRequestScope } from '@/lib/coach-scope'

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

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
    application_id, package_id, amount, custom_name,
    start_date, request_assessment, request_cycle_tracking,
    org: orgOverride, coach: coachOverride,
  } = body || {}

  if (!application_id) {
    return NextResponse.json({ error: 'application_id is required' }, { status: 400 })
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

  // Load + verify the application belongs to this coach.
  const { data: application } = await admin
    .from('coach_applications')
    .select('*')
    .eq('id', application_id)
    .maybeSingle()
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  if (application.coach_id !== coachId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Determine the amount: from a package, or a custom amount.
  let amountCents: number
  let currency = 'usd'
  let billingInterval: 'monthly' | 'one_time' = 'one_time'
  let packageName: string | null = null
  let resolvedPackageId: string | null = null

  // A custom amount is used when `amount` is provided AND no explicit package_id
  // was chosen. (Don't fall back to the applicant's selected_package_id in that
  // case — the coach deliberately chose a custom charge.)
  const useCustomAmount = amount != null && String(amount).trim() !== '' && !package_id
  const pkgId = useCustomAmount ? null : (package_id || application.selected_package_id || null)
  if (pkgId) {
    const { data: pkg } = await admin
      .from('coach_packages')
      .select('id, name, price_cents, currency, billing_interval, coach_id')
      .eq('id', pkgId)
      .maybeSingle()
    if (!pkg || pkg.coach_id !== coachId) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }
    amountCents = pkg.price_cents
    currency = pkg.currency || 'usd'
    billingInterval = pkg.billing_interval === 'monthly' ? 'monthly' : 'one_time'
    packageName = pkg.name
    resolvedPackageId = pkg.id
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

  // NOTE: Step C handles ONE-TIME payments. Monthly packages are charged as a
  // single payment for now; recurring subscriptions come in a later step.
  const token = randomToken()

  const baseRow: Record<string, any> = {
    coach_id: coachId,
    organization_id: organizationId || application.organization_id || null,
    application_id,
    package_id: resolvedPackageId,
    amount_cents: amountCents,
    currency,
    billing_interval: billingInterval,
    package_name: packageName,
    client_email: String(application.email).trim().toLowerCase(),
    client_name: String(application.full_name).trim(),
    token,
    status: 'pending',
  }
  // start_date + setup flags are newer columns — try with them, fall back without.
  const setupCols = {
    start_date: start_date && /^\d{4}-\d{2}-\d{2}$/.test(start_date) ? start_date : null,
    request_assessment: !!request_assessment,
    request_cycle_tracking: !!request_cycle_tracking,
  }
  let { data: created, error: insertErr } = await admin
    .from('payment_requests')
    .insert({ ...baseRow, ...setupCols })
    .select('*')
    .single()

  if (insertErr) {
    const retry = await admin.from('payment_requests').insert(baseRow).select('*').single()
    created = retry.data
    insertErr = retry.error
  }

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
async function sendPaymentRequestEmail(params: {
  to: string
  clientName: string
  coachName: string
  amountCents: number
  currency: string
  packageName: string | null
  payUrl: string
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

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: `First Mile Coach <${senderEmail}>`,
      to: [params.to],
      reply_to: 'hello@firstmilecoach.com',
      subject: `Complete your payment to start coaching with ${params.coachName}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fafbfc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafbfc;padding:40px 20px;"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,0.08);overflow:hidden;">
      <tr><td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(145deg,#2d3436,#3d4447);">
        <img src="https://www.firstmilecoach.com/firstmile/logo.png" alt="First Mile Coach" width="160" style="display:block;margin:0 auto;border-radius:8px;" />
      </td></tr>
      <tr><td style="padding:40px 32px;">
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#2d3436;">You're almost in, ${first}!</h1>
        <p style="margin:0 0 20px;font-size:16px;color:#555b5e;line-height:1.7;">
          ${params.coachName} has set up your coaching${what}. Complete your payment of
          <strong style="color:#2d3436;">${amount}</strong> to activate your account and get started.
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 8px;"><tr>
          <td align="center" style="border-radius:50px;background:#f26522;">
            <a href="${params.payUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:16px;font-weight:700;color:#fff;text-decoration:none;border-radius:50px;">PAY ${amount}</a>
          </td>
        </tr></table>
        <p style="margin:16px 0 0;font-size:13px;color:#9aa0a4;line-height:1.6;text-align:center;">
          Payment is handled securely by Stripe. Your First Mile account is created once your payment is complete.
        </p>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid rgba(0,0,0,0.06);text-align:center;background:#fafbfc;">
        <p style="margin:0;font-size:12px;color:#9e9e9e;">First Mile Coach</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
      text: `You're almost in, ${first}!\n\n${params.coachName} has set up your coaching${params.packageName ? ` for ${params.packageName}` : ''}. Complete your payment of ${amount} to activate your account:\n\n${params.payUrl}\n\nPayment is handled securely by Stripe. Your First Mile account is created once your payment is complete.`,
    }),
  })
}
