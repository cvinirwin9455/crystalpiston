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

// POST /api/inbound-emails/reply - Send a reply from super-admin
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
  const { thread_id, to_email, subject, message } = body

  if (!to_email || !message) {
    return NextResponse.json({ error: 'to_email and message are required' }, { status: 400 })
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  const senderEmail = process.env.FIRSTMILE_SENDER_EMAIL || 'hello@firstmilecoach.com'
  const replySubject = subject?.startsWith('Re:') ? subject : `Re: ${subject || '(No subject)'}`

  // Send via Resend
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: `First Mile Coach <${senderEmail}>`,
      to: [to_email],
      reply_to: 'hello@reply.firstmilecoach.com',
      subject: replySubject,
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
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      text: message,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('Failed to send reply:', errText)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  const resendData = await res.json()

  // Store outbound message in database
  const { error: insertError } = await adminClient
    .from('inbound_emails')
    .insert({
      thread_id: thread_id || undefined,
      direction: 'outbound',
      from_email: 'hello@firstmilecoach.com',
      from_name: 'First Mile Coach',
      to_email: to_email,
      subject: replySubject,
      body_text: message,
      resend_email_id: resendData.id || null,
      read: true,
    })

  if (insertError) {
    console.error('Failed to store outbound email:', insertError)
    // Don't fail — email was sent successfully
  }

  return NextResponse.json({ success: true, emailId: resendData.id })
}
