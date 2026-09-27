import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/inbound-emails/new
// Super admin starts a NEW email conversation with a coach (even one who has
// never contacted us). Sends via Resend and records it as an outbound thread so
// the coach's email reply threads back into the super-admin Inbox.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await getAdminClient()

  // Verify super admin
  const { data: profile } = await adminClient
    .from('users')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
  }

  const body = await request.json()
  const { coachId, subject, message } = body
  let toEmail: string | undefined = body.toEmail

  if (!subject || !message) {
    return NextResponse.json({ error: 'subject and message are required' }, { status: 400 })
  }

  // Resolve the recipient. Prefer a coachId (looked up server-side so we never
  // trust a client-supplied address for a real user); fall back to an explicit
  // toEmail if provided.
  let toName: string | null = null
  if (coachId) {
    const { data: coach } = await adminClient
      .from('users')
      .select('email, name')
      .eq('id', coachId)
      .single()
    if (!coach?.email) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 })
    }
    toEmail = coach.email
    toName = coach.name || null
  }

  if (!toEmail) {
    return NextResponse.json({ error: 'coachId or toEmail is required' }, { status: 400 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  const senderEmail = process.env.FIRSTMILE_SENDER_EMAIL || process.env.SENDER_EMAIL || 'noreply@firstmilecoach.com'

  // Send via Resend. reply_to routes the coach's reply into our inbound webhook
  // so it threads back into the Inbox.
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: `First Mile Coach <${senderEmail}>`,
      to: [toEmail],
      reply_to: 'hello@reply.firstmilecoach.com',
      subject,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafbfc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 32px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: #fff; border-radius: 12px; border: 1px solid rgba(0,0,0,0.08); overflow: hidden;">
          <tr>
            <td style="padding: 24px 24px 20px; border-bottom: 1px solid rgba(0,0,0,0.06);">
              <img src="https://firstmilecoach.com/firstmile/logo.png" alt="First Mile Coach" width="120" style="display: block;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 24px;">
              <div style="font-size: 16px; color: #2d3436; line-height: 1.7; white-space: pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px 24px; border-top: 1px solid rgba(0,0,0,0.06);">
              <p style="margin: 0; font-size: 13px; color: #9e9e9e;">
                First Mile Coach &mdash; <a href="https://firstmilecoach.com" style="color: #f26522; text-decoration: none;">firstmilecoach.com</a>
              </p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #bbb;">Reply to this email to reach us directly.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      text: `${message}\n\n—\nFirst Mile Coach\nReply to this email to reach us directly.`,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('Failed to send new message via Resend:', errText, { from: senderEmail, to: toEmail, subject })
    return NextResponse.json({ error: `Failed to send email: ${errText}` }, { status: 500 })
  }

  const resendData = await res.json()

  // Store as a new outbound thread so the coach's reply threads correctly.
  const { error: insertError } = await adminClient
    .from('inbound_emails')
    .insert({
      // Omit thread_id so the column default (gen_random_uuid) starts a new thread.
      direction: 'outbound',
      from_email: 'hello@firstmilecoach.com',
      from_name: 'First Mile Coach',
      to_email: toEmail,
      subject,
      body_text: message,
      resend_email_id: resendData.id || null,
      read: true,
    })

  if (insertError) {
    console.error('Failed to store outbound email:', insertError)
    // Don't fail — the email was sent successfully.
  }

  return NextResponse.json({ success: true, emailId: resendData.id, to: toEmail, toName })
}
