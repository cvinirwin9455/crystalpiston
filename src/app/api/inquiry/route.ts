import { NextResponse } from 'next/server'

// POST /api/inquiry - Handle marketing page inquiry/contact form
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

  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  // Determine branding based on source
  const isFirstMile = source === 'faq_page' || source === 'firstmile'
  const senderEmail = isFirstMile
    ? (process.env.FIRSTMILE_SENDER_EMAIL || process.env.SENDER_EMAIL || 'noreply@firstmilecoach.com')
    : (process.env.SENDER_EMAIL || 'noreply@crystalpistolperformance.com')
  const recipientEmail = isFirstMile
    ? ['curtisirwin@me.com', 'cvin9455@gmail.com']
    : ['crystal@pistolpc.com']
  const brandName = isFirstMile ? 'First Mile Coach' : 'Pistol Performance Coaching'
  const fromName = isFirstMile ? 'First Mile Coach' : 'Pistol Performance Coaching'
  const accentColor = isFirstMile ? '#f26522' : '#d4a853'

  const firstName = name.split(' ')[0]

  try {
    // 1. Send inquiry to Crystal (reply-to set to the person who inquired)
    const crystalEmailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a2e; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #16213e; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;">
          <tr>
            <td style="padding: 24px 32px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; color: #ffffff; letter-spacing: 1px;">New Inquiry</h1>
              <p style="margin: 4px 0 0; font-size: 11px; color: ${accentColor}; text-transform: uppercase; letter-spacing: 2px;">${brandName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">New message from ${isFirstMile ? 'the FAQ page' : 'your website'}:</p>
              
              <div style="margin: 0 0 20px; padding: 16px; background-color: rgba(212,168,83,0.1); border-left: 3px solid ${accentColor}; border-radius: 4px;">
                <p style="margin: 0 0 4px; color: ${accentColor}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Name</p>
                <p style="margin: 0; color: #ffffff; font-size: 15px;">${name}</p>
              </div>
              
              <div style="margin: 0 0 20px; padding: 16px; background-color: rgba(212,168,83,0.1); border-left: 3px solid ${accentColor}; border-radius: 4px;">
                <p style="margin: 0 0 4px; color: ${accentColor}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Email</p>
                <p style="margin: 0; color: #ffffff; font-size: 15px;">${email}</p>
              </div>
              
              <div style="margin: 0 0 20px; padding: 16px; background-color: rgba(233,69,96,0.1); border-left: 3px solid #f26522; border-radius: 4px;">
                <p style="margin: 0 0 4px; color: #f26522; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Their Message</p>
                <p style="margin: 0; color: #e0e0e0; font-size: 15px; line-height: 1.6;">${message.replace(/\n/g, '<br/>')}</p>
              </div>
              
              <p style="margin: 20px 0 0; font-size: 14px; color: #b0b0b0; line-height: 1.6;">Just hit <strong style="color: #ffffff;">Reply</strong> to respond directly to ${firstName}.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    const crystalRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${senderEmail}>`,
        to: recipientEmail,
        reply_to: email,
        subject: `New inquiry from ${name}${isFirstMile ? ' (FAQ page)' : ''}`,
        html: crystalEmailHtml,
      }),
    })

    if (!crystalRes.ok) {
      const err = await crystalRes.json().catch(() => ({}))
      console.error('Failed to send inquiry to Crystal:', JSON.stringify(err))
      return NextResponse.json({ error: 'Failed to send message. Please try again.' }, { status: 500 })
    }

    // 2. Send confirmation to the person who inquired
    const confirmationHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a2e; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #16213e; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;">
          <tr>
            <td style="padding: 24px 32px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; color: #ffffff; letter-spacing: 1px;">${brandName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px; font-size: 22px; color: #ffffff; font-weight: 700;">Hey ${firstName}!</h2>
              <p style="margin: 0 0 16px; font-size: 16px; color: #e0e0e0; line-height: 1.7;">Your message landed safe and sound. We got it and will be in touch with you soon.</p>
              <p style="margin: 0 0 24px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">Thanks for reaching out — we respond to every message personally.</p>
              <p style="margin: 0; font-size: 15px; color: ${accentColor}; font-weight: 600;">Talk soon!</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: #b0b0b0;">The ${brandName} Team</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    // Fire and forget — don't fail the request if confirmation email fails
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${senderEmail}>`,
        to: [email],
        reply_to: recipientEmail[0],
        subject: `Got your message, ${firstName}!`,
        html: confirmationHtml,
      }),
    }).catch(err => console.error('Failed to send confirmation email:', err))

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('Inquiry error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
