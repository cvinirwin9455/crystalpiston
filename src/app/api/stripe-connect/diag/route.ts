import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// TEMP diagnostic endpoint to debug invite-email delivery for the payment flow.
//   GET /api/stripe-connect/diag?email=you+test@example.com
// Returns (to the authenticated coach only) the result of:
//   1. whether RESEND_API_KEY is present
//   2. a direct Resend test send
//   3. a Supabase generateLink(invite) attempt (reports rate-limit errors)
// Does NOT expose secrets. Safe to remove once the email issue is resolved.

async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request: Request) {
  // Must be logged in (any coach) to use this.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const email = (searchParams.get('email') || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'pass ?email=' }, { status: 400 })

  const out: Record<string, any> = {}

  // 1. Env presence (prefix only, never the full key).
  const key = process.env.RESEND_API_KEY
  out.resendKeyPresent = !!key
  out.resendKeyPrefix = key ? key.slice(0, 6) : null
  out.senderEmail = process.env.FIRSTMILE_SENDER_EMAIL || process.env.SENDER_EMAIL || 'noreply@firstmilecoach.com'

  // 2. Direct Resend test send — capture the real response.
  if (key) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          from: `First Mile Coach <${out.senderEmail}>`,
          to: [email],
          reply_to: 'hello@firstmilecoach.com',
          subject: 'First Mile — email delivery test',
          html: '<p>This is a test from the First Mile payment-flow diagnostic. If you received this, Resend delivery works.</p>',
          text: 'This is a test from the First Mile payment-flow diagnostic.',
        }),
      })
      out.resendStatus = res.status
      out.resendBody = await res.json().catch(() => ({}))
    } catch (err: any) {
      out.resendError = err?.message || String(err)
    }
  }

  // 3. Supabase generateLink(invite) — reports auth email rate-limit errors.
  try {
    const admin = await createAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'invite',
      email: `diag+${Date.now()}@firstmilecoach.com`, // throwaway, won't collide
      options: {
        data: { name: 'Diag Test', role: 'client' },
        redirectTo: 'https://www.firstmilecoach.com/auth/callback?next=/set-password',
      },
    })
    out.generateLinkOk = !error
    out.generateLinkError = error ? { message: error.message, status: (error as any).status } : null
    out.generateLinkHasToken = !!data?.properties?.hashed_token
  } catch (err: any) {
    out.generateLinkThrew = err?.message || String(err)
  }

  // 4. Dump recent payment_requests so we can see exactly what's stored
  //    (status, whether a checkout session id was saved, paid_at, provisioned).
  try {
    const admin = await createAdminClient()
    const { data: prs } = await admin
      .from('payment_requests')
      .select('id, client_email, status, amount_cents, stripe_checkout_session_id, stripe_payment_intent_id, paid_at, provisioned_user_id, application_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
    out.recentPaymentRequests = prs || []
  } catch (err: any) {
    out.paymentRequestsError = err?.message || String(err)
  }

  return NextResponse.json(out)
}
