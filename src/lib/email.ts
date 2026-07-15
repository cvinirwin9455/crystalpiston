// Email utility for sending notifications via Resend

export type EmailBrand = 'first-mile' | 'crystal-pistol'

interface EmailBrandAssets {
  name: string
  senderName: string
  senderEmail: string
  logoUrl: string
  logoAlt: string
  footerText: string
  bgColor: string
  cardBgColor: string
  borderColor: string
}

function getEmailBrandAssets(brand: EmailBrand): EmailBrandAssets {
  if (brand === 'crystal-pistol') {
    return {
      name: 'Pistol Performance Coaching',
      senderName: 'Pistol Performance Coaching',
      senderEmail: process.env.SENDER_EMAIL || 'noreply@crystalpistolperformance.com',
      logoUrl: 'https://www.crystalpistolperformance.com/IMG_5861.PNG',
      logoAlt: 'Pistol Performance Coaching',
      footerText: 'Pistol Performance Coaching &bull; crystalpistolperformance.com',
      bgColor: '#1a1a2e',
      cardBgColor: '#16213e',
      borderColor: 'rgba(255,255,255,0.1)',
    }
  }

  return {
    name: 'First Mile Coach',
    senderName: 'First Mile Coach',
    senderEmail: process.env.FIRSTMILE_SENDER_EMAIL || process.env.SENDER_EMAIL || 'noreply@firstmilecoach.com',
    logoUrl: 'https://www.firstmilecoach.com/firstmile/logo.png',
    logoAlt: 'First Mile Coach',
    footerText: 'First Mile Coach &bull; firstmilecoach.com',
    bgColor: '#1a1a2e',
    cardBgColor: '#16213e',
    borderColor: 'rgba(255,255,255,0.1)',
  }
}

/**
 * Determine email brand from an organization ID.
 * Crystal Pistol org → crystal-pistol, everything else → first-mile.
 */
const CRYSTAL_PISTOL_ORG_ID = 'fffa6f6b-8226-40d9-9e49-ff17164334f4'

export function getEmailBrandFromOrgId(orgId: string | null | undefined): EmailBrand {
  if (orgId === CRYSTAL_PISTOL_ORG_ID) return 'crystal-pistol'
  return 'first-mile'
}

// Helper: get the production site URL (never use preview deployment URLs in emails)
export function getProductionUrl(requestUrl?: string): string {
  // Always prefer the configured production URL
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  // Hardcoded production URL as fallback (prevents preview deployment links in emails)
  return 'https://crystalpiston.vercel.app'
}

interface SendEmailParams {
  to: string
  subject: string
  html: string
  brand?: EmailBrand
}

export async function sendEmail({ to, subject, html, brand = 'crystal-pistol' }: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const assets = getEmailBrandAssets(brand)

  if (!apiKey) {
    console.error('RESEND_API_KEY not configured - check Vercel environment variables')
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: `${assets.senderName} <${assets.senderEmail}>`,
        to: [to],
        subject,
        html: wrapInBrandedTemplate(html, brand),
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Failed to send email:', JSON.stringify(err))
      return false
    }

    return true
  } catch (err) {
    console.error('Email send error:', err)
    return false
  }
}

// Wrap content in branded email template
function wrapInBrandedTemplate(content: string, brand: EmailBrand = 'crystal-pistol'): string {
  const assets = getEmailBrandAssets(brand)
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: ${assets.bgColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${assets.bgColor}; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: ${assets.cardBgColor}; border-radius: 16px; border: 1px solid ${assets.borderColor}; overflow: hidden;">
          <tr>
            <td style="padding: 24px 32px; text-align: center; border-bottom: 1px solid ${assets.borderColor};">
              <img src="${assets.logoUrl}" alt="${assets.logoAlt}" width="140" style="display: block; margin: 0 auto; border-radius: 6px;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px; border-top: 1px solid rgba(255,255,255,0.05); text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #555555;">${assets.footerText}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// Specific email templates

export function buildPlanPublishedEmail(clientName: string, weekDateRange: string, focus: string, siteUrl: string, coachName?: string): { subject: string; html: string } {
  const firstName = clientName.split(' ')[0]
  const coach = coachName || 'Your coach'
  return {
    subject: `Your training plan for ${weekDateRange} is ready!`,
    html: `
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">Hey ${firstName}! Your plan is ready</h2>
      <p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">${coach} has published your training plan for <strong style="color: #ffffff;">${weekDateRange}</strong>.</p>
      ${focus ? `<p style="margin: 0 0 16px; font-size: 14px; color: #d4a853;">Focus: ${focus}</p>` : ''}
      <p style="margin: 0 0 24px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">Log in to view your workouts for the week and start crushing it!</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td align="center">
            <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">View My Plan</a>
          </td>
        </tr>
      </table>
    `,
  }
}

export function buildNewMessageEmail(clientName: string, messagePreview: string, siteUrl: string, coachName?: string): { subject: string; html: string } {
  const firstName = clientName.split(' ')[0]
  const coach = coachName || 'Your coach'
  const truncated = messagePreview.length > 150 ? messagePreview.slice(0, 150) + '...' : messagePreview
  return {
    subject: `New message from ${coach}`,
    html: `
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">Hey ${firstName}! ${coach} sent you a message</h2>
      <div style="margin: 0 0 24px; padding: 16px; background-color: rgba(233,69,96,0.1); border-left: 3px solid #f26522; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; color: #e0e0e0; line-height: 1.5;">${truncated}</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td align="center">
            <a href="${siteUrl}/dashboard?tab=messages" style="display: inline-block; background-color: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">View Message</a>
          </td>
        </tr>
      </table>
    `,
  }
}


export function buildWorkoutCommentEmail(
  recipientName: string,
  senderName: string,
  workoutDay: string,
  workoutType: string,
  workoutTitle: string,
  workoutMiles: string | null,
  comment: string,
  siteUrl: string,
  isFromCoach: boolean,
  coachName?: string
): { subject: string; html: string } {
  const coach = coachName || senderName
  const subject = isFromCoach
    ? `${coach} commented on your ${workoutDay} workout`
    : `${senderName} replied on their ${workoutDay} workout`

  const workoutDetails = [
    workoutType,
    workoutTitle,
    workoutMiles ? `${workoutMiles} miles` : null,
  ].filter(Boolean).join(' — ')

  const html = `
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">Hi ${recipientName},</h2>
      <p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">
        ${isFromCoach ? `${coach} left a comment on your workout:` : `${senderName} replied on their workout:`}
      </p>
      <div style="margin: 0 0 16px; padding: 16px; background-color: rgba(212,168,83,0.1); border-left: 3px solid #d4a853; border-radius: 4px;">
        <p style="margin: 0 0 6px; color: #d4a853; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">${workoutDay} Workout</p>
        <p style="margin: 0; color: #ffffff; font-size: 14px;">${workoutDetails}</p>
      </div>
      <div style="margin: 0 0 24px; padding: 16px; background-color: rgba(${isFromCoach ? '168,85,247' : '239,68,68'},0.1); border-left: 3px solid ${isFromCoach ? '#a855f7' : '#ef4444'}; border-radius: 4px;">
        <p style="margin: 0 0 4px; color: ${isFromCoach ? '#a855f7' : '#ef4444'}; font-size: 12px; font-weight: bold;">${senderName}</p>
        <p style="margin: 0; color: #e0e0e0; font-size: 14px; line-height: 1.5;">${comment}</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td align="center">
            <a href="${siteUrl}/${isFromCoach ? 'dashboard' : 'admin'}" style="display: inline-block; background-color: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">View & Reply</a>
          </td>
        </tr>
      </table>`

  return { subject, html }
}



export function buildStravaImportEmail(
  clientName: string,
  activityName: string,
  activityType: string,
  miles: number | null,
  duration: string | null,
  pace: string | null,
  matchStatus: 'programmed' | 'client' | 'none',
  matchedWorkoutTitle: string | null,
  day: string,
  siteUrl: string,
  coachName?: string
): { subject: string; html: string } {
  const firstName = clientName.split(' ')[0]
  const coach = coachName || 'your coach'

  let statusBadge = ''
  let statusMessage = ''

  if (matchStatus === 'programmed') {
    statusBadge = `<div style="margin: 0 0 16px; display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: #22c55e22; color: #22c55e; border: 1px solid #22c55e44;">Auto-Matched to Your Plan</div>`
    statusMessage = `<p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">Great work! This activity was automatically matched to your <strong style="color: #ffffff;">programmed workout</strong> from ${coach}${matchedWorkoutTitle ? `: <strong style="color: #d4a853;">${matchedWorkoutTitle}</strong>` : ''}.</p>
    <div style="margin: 0 0 20px; padding: 14px 16px; background-color: rgba(234,69,96,0.08); border: 1px solid rgba(234,69,96,0.2); border-radius: 8px;">
      <p style="margin: 0 0 4px; color: #f26522; font-size: 13px; font-weight: 700;">ONE THING LEFT:</p>
      <p style="margin: 0; color: #ffffff; font-size: 14px; line-height: 1.5;">Log in and add your <strong>RPE (effort)</strong> and <strong>Sleep quality</strong> for this workout. This helps ${coach} understand how you&rsquo;re feeling and adjust your plan accordingly.</p>
    </div>`
  } else if (matchStatus === 'client') {
    statusBadge = `<div style="margin: 0 0 16px; display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: #22c55e22; color: #22c55e; border: 1px solid #22c55e44;">Auto-Matched to Your Workout</div>`
    statusMessage = `<p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">Great work! This activity was automatically matched to a <strong style="color: #ffffff;">workout you created</strong>${matchedWorkoutTitle ? `: <strong style="color: #06b6d4;">${matchedWorkoutTitle}</strong>` : ''}.</p>
    <div style="margin: 0 0 20px; padding: 14px 16px; background-color: rgba(234,69,96,0.08); border: 1px solid rgba(234,69,96,0.2); border-radius: 8px;">
      <p style="margin: 0 0 4px; color: #f26522; font-size: 13px; font-weight: 700;">ONE THING LEFT:</p>
      <p style="margin: 0; color: #ffffff; font-size: 14px; line-height: 1.5;">Log in and add your <strong>RPE (effort)</strong> and <strong>Sleep quality</strong> for this workout. This helps ${coach} understand how you&rsquo;re feeling and adjust your plan accordingly.</p>
    </div>`
  } else {
    statusBadge = `<div style="margin: 0 0 16px; display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: #6b728022; color: #9ca3af; border: 1px solid #6b728044;">No Match Found</div>`
    statusMessage = `<p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">This activity didn&rsquo;t match any of your programmed or your own workouts created. Log in to decide what to do with it &mdash; you can link it to a workout, keep it as an extra, or dismiss it.</p>`
  }

  const details = [
    miles ? `${miles} mi` : null,
    pace || null,
    duration || null,
  ].filter(Boolean).join(' &bull; ')

  const subject = matchStatus !== 'none'
    ? `Strava synced: ${activityName} — possible match found`
    : `Strava synced: ${activityName} — action needed`

  const html = `
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">Hey ${firstName}!</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">A new Strava activity was synced to your account:</p>
    
    <div style="margin: 0 0 20px; padding: 16px; background-color: rgba(249,115,22,0.08); border-left: 3px solid #f97316; border-radius: 4px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <span style="color: #f97316; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">${day} &bull; ${activityType}</span>
      </div>
      <p style="margin: 0 0 4px; color: #ffffff; font-size: 16px; font-weight: 600;">${activityName}</p>
      ${details ? `<p style="margin: 0; color: #b0b0b0; font-size: 13px;">${details}</p>` : ''}
    </div>

    ${statusBadge}
    ${statusMessage}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">Review in Dashboard</a>
        </td>
      </tr>
    </table>
  `

  return { subject, html }
}
