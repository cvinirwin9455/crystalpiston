// Custom invite email templates sent via Resend (bypasses Supabase's single template limitation)
// Branding is determined by the inviting user's organization

const RESEND_API_URL = 'https://api.resend.com/emails'

type Brand = 'first-mile' | 'crystal-pistol'

interface BrandAssets {
  name: string
  senderName: string
  senderEmail: string
  logoHtml: string
  buttonColor: string
  footerText: string
}

function getBrandAssets(brand: Brand): BrandAssets {
  if (brand === 'crystal-pistol') {
    return {
      name: 'Pistol Performance Coaching',
      senderName: 'Pistol Performance Coaching',
      senderEmail: process.env.SENDER_EMAIL || 'noreply@crystalpistolperformance.com',
      logoHtml: `<td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(145deg, #1a1a2e, #16213e);">
              <img src="https://www.crystalpistolperformance.com/IMG_5861.PNG" alt="Pistol Performance Coaching" width="160" style="display: block; margin: 0 auto;" />
            </td>`,
      buttonColor: '#f26522',
      footerText: 'Pistol Performance Coaching &mdash; From 5K to 100 miles',
    }
  }

  return {
    name: 'First Mile Coach',
    senderName: 'First Mile Coach',
    senderEmail: process.env.FIRSTMILE_SENDER_EMAIL || process.env.SENDER_EMAIL || 'noreply@firstmilecoach.com',
    logoHtml: `<td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(145deg, #2d3436, #3d4447);">
              <img src="https://www.firstmilecoach.com/firstmile/logo.png" alt="First Mile Coach" width="160" style="display: block; margin: 0 auto; border-radius: 8px;" />
            </td>`,
    buttonColor: '#f26522',
    footerText: 'First Mile Coach &mdash; The simplest way to manage your coaching clients',
  }
}

/**
 * Determine brand based on org domain
 */
export function getBrandFromDomain(domain: string | null | undefined): Brand {
  if (!domain) return 'first-mile'
  if (domain.includes('crystalpistol')) return 'crystal-pistol'
  return 'first-mile'
}

interface SendInviteEmailParams {
  to: string
  subject: string
  html: string
  senderName: string
  senderEmail: string
}

async function sendInviteEmail({ to, subject, html, senderName, senderEmail }: SendInviteEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('RESEND_API_KEY not configured')
    return false
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [to],
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Failed to send invite email:', JSON.stringify(err))
      return false
    }

    return true
  } catch (err) {
    console.error('Invite email send error:', err)
    return false
  }
}

/**
 * Send invite email to a new COACH
 */
export async function sendCoachInviteEmail(params: {
  to: string
  coachName: string
  confirmationUrl: string
  brand?: Brand
}): Promise<boolean> {
  const { to, coachName, confirmationUrl, brand = 'first-mile' } = params
  const firstName = coachName.split(' ')[0]
  const assets = getBrandAssets(brand)

  const subject = `Welcome to ${assets.name}, ${firstName}!`
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #fafbfc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafbfc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid rgba(0,0,0,0.08); overflow: hidden; box-shadow: 0 4px 30px rgba(0,0,0,0.06);">
          <tr>
            ${assets.logoHtml}
          </tr>
          <tr>
            <td style="padding: 40px 32px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 800; color: #2d3436;">Welcome, ${firstName}!</h1>
              <p style="margin: 0 0 20px; font-size: 16px; color: #555b5e; line-height: 1.7;">
                Your coach account on <strong style="color: ${assets.buttonColor};">${assets.name}</strong> is ready. Click the button below to set your password and start managing your clients.
              </p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px auto;">
                <tr>
                  <td align="center" style="border-radius: 50px; background: ${assets.buttonColor};">
                    <a href="${confirmationUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 50px;">SET UP YOUR ACCOUNT</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 8px; font-size: 14px; color: #555b5e; line-height: 1.6; font-weight: 600;">Once you're in, you'll be able to:</p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px;">
                <tr><td style="padding: 6px 0; font-size: 14px; color: #555b5e;">&#10003; &nbsp;Invite and manage your clients</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #555b5e;">&#10003; &nbsp;Build and assign training plans</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #555b5e;">&#10003; &nbsp;Track progress and communicate in one place</td></tr>
              </table>
              <p style="margin: 0; font-size: 13px; color: #9e9e9e; line-height: 1.6;">
                If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid rgba(0,0,0,0.06); text-align: center; background: #fafbfc;">
              <p style="margin: 0; font-size: 12px; color: #9e9e9e;">${assets.footerText}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return sendInviteEmail({
    to,
    subject,
    html,
    senderName: assets.senderName,
    senderEmail: assets.senderEmail,
  })
}

/**
 * Send invite email to a new CLIENT
 */
export async function sendClientInviteEmail(params: {
  to: string
  clientName: string
  coachName: string
  confirmationUrl: string
  brand?: Brand
}): Promise<boolean> {
  const { to, clientName, coachName, confirmationUrl, brand = 'first-mile' } = params
  const firstName = clientName.split(' ')[0]
  const assets = getBrandAssets(brand)

  const subject = `${coachName} has set up your training account!`
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #fafbfc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafbfc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid rgba(0,0,0,0.08); overflow: hidden; box-shadow: 0 4px 30px rgba(0,0,0,0.06);">
          <tr>
            ${assets.logoHtml}
          </tr>
          <tr>
            <td style="padding: 40px 32px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 800; color: #2d3436;">Welcome to the team, ${firstName}!</h1>
              <p style="margin: 0 0 20px; font-size: 16px; color: #555b5e; line-height: 1.7;">
                <strong style="color: #2d3436;">${coachName}</strong> has set up your training account. Click the button below to set your password and access your personalised training dashboard.
              </p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px auto;">
                <tr>
                  <td align="center" style="border-radius: 50px; background: ${assets.buttonColor};">
                    <a href="${confirmationUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 50px;">SET UP YOUR ACCOUNT</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 8px; font-size: 14px; color: #555b5e; line-height: 1.6; font-weight: 600;">Once you've set your password, you'll be able to:</p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px;">
                <tr><td style="padding: 6px 0; font-size: 14px; color: #555b5e;">&#10003; &nbsp;View your weekly training plan</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #555b5e;">&#10003; &nbsp;Log your workouts and track progress</td></tr>
                <tr><td style="padding: 6px 0; font-size: 14px; color: #555b5e;">&#10003; &nbsp;Message ${coachName} directly</td></tr>
              </table>
              <p style="margin: 0; font-size: 13px; color: #9e9e9e; line-height: 1.6;">
                If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid rgba(0,0,0,0.06); text-align: center; background: #fafbfc;">
              <p style="margin: 0; font-size: 12px; color: #9e9e9e;">${assets.footerText}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return sendInviteEmail({
    to,
    subject,
    html,
    senderName: coachName,
    senderEmail: assets.senderEmail,
  })
}
