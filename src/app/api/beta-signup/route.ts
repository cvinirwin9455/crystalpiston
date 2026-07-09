import { NextResponse } from 'next/server'

const FIRST_MILE_ORG_ID = '1eb9b481-b6b6-455c-b733-fee789803a17'
const ADMIN_EMAIL = 'curtisirwin@me.com'

export async function POST(request: Request) {
  try {
    // Verify required env vars
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ success: false, error: 'Server misconfigured: missing Supabase credentials', message: null }, { status: 500 })
    }

    const body = await request.json()
    const { full_name, email, coaching_type, expected_clients, agreed_to_terms, consent_ip, consent_user_agent, consent_terms_version } = body

    if (!full_name || !email || !coaching_type || !expected_clients) {
      return NextResponse.json({ success: false, error: 'All fields are required', message: null }, { status: 400 })
    }

    // Create admin client inline to avoid any import issues
    const { createClient } = await import('@supabase/supabase-js')
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Insert into beta_signups
    const { data: inserted, error } = await adminClient
      .from('beta_signups')
      .insert({
        organization_id: FIRST_MILE_ORG_ID,
        full_name,
        email,
        coaching_type,
        expected_clients: parseInt(expected_clients),
        agreed_to_terms: agreed_to_terms || false,
        signed_up_at: new Date().toISOString(),
        consent_ip: consent_ip || 'unknown',
        consent_user_agent: consent_user_agent || 'unknown',
        consent_terms_version: consent_terms_version || 'v1-july-2026',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: true, duplicate: true, message: "You've already signed up! We'll be in touch soon." })
      }
      return NextResponse.json({ success: false, error: `DB error: ${error.code} - ${error.message}`, message: `DB error: ${error.code} - ${error.message}` }, { status: 500 })
    }

    if (!inserted) {
      return NextResponse.json({ success: false, error: 'Insert returned no data', message: 'Insert returned no data' }, { status: 500 })
    }

    // Send emails (fire and forget — don't fail the signup if email fails)
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      sendAdminNotification(apiKey, { full_name, email, coaching_type, expected_clients: String(expected_clients) }).catch(() => {})
      sendCoachConfirmation(apiKey, { full_name, email }).catch(() => {})
    }

    return NextResponse.json({ success: true, message: "You're in! We'll be in touch with next steps soon." })

  } catch (err: any) {
    console.error('Beta signup route crash:', err)
    return NextResponse.json({ success: false, error: `Server crash: ${err?.message || 'unknown'}`, message: `Server crash: ${err?.message || 'unknown'}` }, { status: 500 })
  }
}

async function sendAdminNotification(
  apiKey: string,
  data: { full_name: string; email: string; coaching_type: string; expected_clients: string }
) {
  const senderEmail = process.env.FIRSTMILE_SENDER_EMAIL || process.env.SENDER_EMAIL || 'noreply@firstmilecoach.com'

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: `First Mile Coach <${senderEmail}>`,
      to: [ADMIN_EMAIL],
      subject: `New Beta Signup: ${data.full_name}`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f4f4f4;">
  <div style="max-width: 500px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border: 1px solid #e0e0e0;">
    <h2 style="margin: 0 0 20px; color: #2d3436;">New Beta Signup</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #888; font-size: 14px;">Name</td>
        <td style="padding: 8px 0; font-weight: 600; color: #2d3436;">${data.full_name}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #888; font-size: 14px;">Email</td>
        <td style="padding: 8px 0; font-weight: 600; color: #2d3436;"><a href="mailto:${data.email}" style="color: #f26522;">${data.email}</a></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #888; font-size: 14px;">Coaching Type</td>
        <td style="padding: 8px 0; font-weight: 600; color: #2d3436;">${data.coaching_type.replace(/_/g, ' ')}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #888; font-size: 14px;">Expected Clients</td>
        <td style="padding: 8px 0; font-weight: 600; color: #2d3436;">${data.expected_clients}</td>
      </tr>
    </table>
  </div>
</body>
</html>`,
    }),
  })
}

async function sendCoachConfirmation(
  apiKey: string,
  data: { full_name: string; email: string }
) {
  const senderEmail = process.env.FIRSTMILE_SENDER_EMAIL || process.env.SENDER_EMAIL || 'noreply@firstmilecoach.com'
  const firstName = data.full_name.split(' ')[0]

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: `First Mile Coach <${senderEmail}>`,
      to: [data.email],
      reply_to: 'curtisirwin@me.com',
      subject: `You're in, ${firstName}! Welcome to the First Mile Coach beta`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #fafbfc; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafbfc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid rgba(0,0,0,0.08); overflow: hidden; box-shadow: 0 4px 30px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(145deg, #2d3436, #3d4447);">
              <img src="https://firstmilecoach.com/firstmile/logo.png" alt="First Mile Coach" width="160" style="display: block; margin: 0 auto; border-radius: 8px;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 32px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 800; color: #2d3436;">Welcome, ${firstName}!</h1>
              <p style="margin: 0 0 20px; font-size: 16px; color: #555b5e; line-height: 1.7;">
                You've been accepted into the <strong style="color: #f26522;">First Mile Coach</strong> beta program. We're thrilled to have you.
              </p>
              <div style="margin: 24px 0; padding: 20px; background: #fff8f4; border-radius: 12px; border: 1px solid rgba(242,101,34,0.15);">
                <p style="margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #2d3436;">What happens next:</p>
                <p style="margin: 0; font-size: 14px; color: #555b5e; line-height: 1.7;">
                  We'll be in touch shortly with your login details and everything you need to get started. The beta is limited to 50 coaches, so you've secured your spot.
                </p>
              </div>
              <p style="margin: 24px 0 0; font-size: 14px; color: #555b5e; line-height: 1.7;">
                In the meantime, if you have any questions, just reply to this email.
              </p>
              <p style="margin: 24px 0 0; font-size: 14px; color: #2d3436; font-weight: 600;">
                — The First Mile Coach Team
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid rgba(0,0,0,0.06); text-align: center; background: #fafbfc;">
              <p style="margin: 0; font-size: 12px; color: #9e9e9e;">First Mile Coach</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    }),
  })
}
