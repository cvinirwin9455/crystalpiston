import { NextResponse } from 'next/server'

// POST /api/inquiry - Handle marketing page inquiry/contact form
// Saves to inbound_emails table (shows in super admin Inbox tab) + sends email notification
export async function POST(request: Request) {
  const body = await request.json()
  const { name, email, message, source } = body

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Name, email, and message are required' }, { status: 400 })
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
  }

  // Determine branding based on source
  const isFirstMile = source === 'faq_page' || source === 'firstmile'

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Insert into inbound_emails table so it shows in the Super Admin Inbox
    const subject = isFirstMile
      ? `Website inquiry from ${name}`
      : `Website inquiry from ${name} (Crystal Pistol)`

    const { error: dbError } = await adminClient
      .from('inbound_emails')
      .insert({
        direction: 'inbound',
        from_email: email,
        from_name: name,
        to_email: 'hello@firstmilecoach.com',
        subject,
        body_text: message.trim(),
        body_html: null,
        read: false,
      })

    if (dbError) {
      console.error('Failed to save inquiry to inbound_emails:', JSON.stringify(dbError))
      return NextResponse.json({ error: 'Failed to send message. Please try again.' }, { status: 500 })
    }

    // Send email notification (fire and forget — don't block on this)
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      const senderEmail = isFirstMile
        ? (process.env.FIRSTMILE_SENDER_EMAIL || process.env.SENDER_EMAIL || 'noreply@firstmilecoach.com')
        : (process.env.SENDER_EMAIL || 'noreply@crystalpistolperformance.com')
      const recipientEmail = isFirstMile
        ? ['curtisirwin@me.com', 'cvin9455@gmail.com']
        : ['crystal@pistolpc.com']
      const brandName = isFirstMile ? 'First Mile Coach' : 'Pistol Performance Coaching'
      const accentColor = isFirstMile ? '#f26522' : '#d4a853'

      const adminEmailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#1a1a2e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" style="background:#1a1a2e;padding:40px 20px;"><tr><td align="center">
<table width="100%" style="max-width:520px;background:#16213e;border-radius:16px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;">
<tr><td style="padding:24px 32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1);">
<h1 style="margin:0;font-size:20px;font-weight:800;text-transform:uppercase;color:#fff;letter-spacing:1px;">New Inquiry</h1>
<p style="margin:4px 0 0;font-size:11px;color:${accentColor};text-transform:uppercase;letter-spacing:2px;">${brandName} — Contact Form</p>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;font-size:15px;color:#b0b0b0;">From: <strong style="color:#fff;">${name}</strong> &lt;${email}&gt;</p>
<div style="margin:0 0 20px;padding:16px;background:rgba(242,101,34,0.1);border-left:3px solid #f26522;border-radius:4px;">
<p style="margin:0 0 4px;color:#f26522;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Message</p>
<p style="margin:0;color:#e0e0e0;font-size:15px;line-height:1.6;">${message.replace(/\n/g, '<br/>')}</p>
</div>
<p style="margin:16px 0 0;font-size:13px;color:#888;">View and reply in Super Admin → Inbox tab.</p>
</td></tr></table>
</td></tr></table></body></html>`

      // Fire and forget — don't await, don't block
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          from: `${brandName} <${senderEmail}>`,
          to: recipientEmail,
          reply_to: email,
          subject: `New inquiry from ${name} (${isFirstMile ? 'contact form' : 'website'})`,
          html: adminEmailHtml,
        }),
      }).catch(err => console.error('Inquiry email notification failed (saved to DB):', err))
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('Inquiry error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
