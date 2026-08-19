import { NextResponse } from 'next/server'

// POST /api/inquiry - Handle marketing page inquiry/contact form
// Saves to feedback table (shows in super admin) + tries to send email notification
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
  const platform = isFirstMile ? 'first-mile' : 'crystal-pistol'

  try {
    // 1. SAVE TO DATABASE (feedback table) — this is the primary action
    // Uses service role to bypass RLS since user is unauthenticated
    // Note: feedback table requires user_id NOT NULL, so we use the First Mile org admin ID
    // and store the visitor's details in description for the super admin to see
    const { createClient } = await import('@supabase/supabase-js')
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Find the super admin user to attribute the inquiry to (so it shows in feedback tab)
    const { data: superAdmin } = await adminClient
      .from('users')
      .select('id')
      .eq('email', 'curtisirwin@me.com')
      .single()

    if (!superAdmin) {
      console.error('Could not find super admin user for inquiry attribution')
      return NextResponse.json({ error: 'Failed to send message. Please try again.' }, { status: 500 })
    }

    const fullDescription = `[INQUIRY from FAQ Contact Form]\n\nFrom: ${name} <${email}>\n\nMessage:\n${message.trim()}`

    const { error: dbError } = await adminClient
      .from('feedback')
      .insert({
        user_id: superAdmin.id,
        user_email: email,
        user_name: name,
        platform,
        user_role: 'client',
        type: 'feedback',
        description: fullDescription,
        page_url: isFirstMile ? 'https://firstmilecoach.com/faq#contact' : 'https://crystalpistolperformance.com/contact',
        screenshot_url: null,
        priority: 'medium',
        status: 'new',
      })

    if (dbError) {
      console.error('Failed to save inquiry to DB:', JSON.stringify(dbError))
      return NextResponse.json({ error: 'Failed to send message. Please try again.' }, { status: 500 })
    }

    // 2. TRY TO SEND EMAIL NOTIFICATION (fire and forget — don't block on this)
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
      const firstName = name.split(' ')[0]

      const adminEmailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#1a1a2e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" style="background:#1a1a2e;padding:40px 20px;"><tr><td align="center">
<table width="100%" style="max-width:520px;background:#16213e;border-radius:16px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;">
<tr><td style="padding:24px 32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1);">
<h1 style="margin:0;font-size:20px;font-weight:800;text-transform:uppercase;color:#fff;letter-spacing:1px;">New Inquiry</h1>
<p style="margin:4px 0 0;font-size:11px;color:${accentColor};text-transform:uppercase;letter-spacing:2px;">${brandName} — FAQ Contact Form</p>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;font-size:15px;color:#b0b0b0;">From: <strong style="color:#fff;">${name}</strong> &lt;${email}&gt;</p>
<div style="margin:0 0 20px;padding:16px;background:rgba(242,101,34,0.1);border-left:3px solid #f26522;border-radius:4px;">
<p style="margin:0 0 4px;color:#f26522;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Message</p>
<p style="margin:0;color:#e0e0e0;font-size:15px;line-height:1.6;">${message.replace(/\n/g, '<br/>')}</p>
</div>
<p style="margin:16px 0 0;font-size:13px;color:#888;">This is also saved in Super Admin → Feedback tab. Hit Reply to respond directly.</p>
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
          subject: `New inquiry from ${name} (${isFirstMile ? 'FAQ page' : 'website'})`,
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
