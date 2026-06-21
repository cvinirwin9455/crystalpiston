// Email utility for sending notifications via Resend

interface SendEmailParams {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const senderEmail = process.env.SENDER_EMAIL || 'noreply@crystalpistolperformance.com'
  const senderName = 'Pistol Performance Coaching'

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
        from: `${senderName} <${senderEmail}>`,
        to: [to],
        subject,
        html: wrapInBrandedTemplate(html),
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
function wrapInBrandedTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a2e; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #16213e; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;">
          <tr>
            <td style="padding: 24px 32px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; color: #ffffff; letter-spacing: 1px;">Pistol Performance</h1>
              <p style="margin: 4px 0 0; font-size: 11px; color: #d4a853; text-transform: uppercase; letter-spacing: 2px;">Coaching</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px; border-top: 1px solid rgba(255,255,255,0.05); text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #555555;">Pistol Performance Coaching &bull; Southwest Missouri</p>
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

export function buildPlanPublishedEmail(clientName: string, weekDateRange: string, focus: string, siteUrl: string): { subject: string; html: string } {
  const firstName = clientName.split(' ')[0]
  return {
    subject: `Your training plan for ${weekDateRange} is ready!`,
    html: `
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">Hey ${firstName}! Your plan is ready</h2>
      <p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">Crystal has published your training plan for <strong style="color: #ffffff;">${weekDateRange}</strong>.</p>
      ${focus ? `<p style="margin: 0 0 16px; font-size: 14px; color: #d4a853;">Focus: ${focus}</p>` : ''}
      <p style="margin: 0 0 24px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">Log in to view your workouts for the week and start crushing it!</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td align="center">
            <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: #e94560; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">View My Plan</a>
          </td>
        </tr>
      </table>
    `,
  }
}

export function buildNewMessageEmail(clientName: string, messagePreview: string, siteUrl: string): { subject: string; html: string } {
  const firstName = clientName.split(' ')[0]
  const truncated = messagePreview.length > 150 ? messagePreview.slice(0, 150) + '...' : messagePreview
  return {
    subject: 'New message from Crystal',
    html: `
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">Hey ${firstName}! Crystal sent you a message</h2>
      <div style="margin: 0 0 24px; padding: 16px; background-color: rgba(233,69,96,0.1); border-left: 3px solid #e94560; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; color: #e0e0e0; line-height: 1.5;">${truncated}</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td align="center">
            <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: #e94560; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">View Message</a>
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
  isFromCoach: boolean
): { subject: string; html: string } {
  const subject = isFromCoach
    ? `Crystal commented on your ${workoutDay} workout`
    : `${senderName} replied on their ${workoutDay} workout`

  const workoutDetails = [
    workoutType,
    workoutTitle,
    workoutMiles ? `${workoutMiles} miles` : null,
  ].filter(Boolean).join(' — ')

  const html = `
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">Hi ${recipientName},</h2>
      <p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">
        ${isFromCoach ? 'Crystal left a comment on your workout:' : `${senderName} replied on their workout:`}
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
            <a href="${siteUrl}/${isFromCoach ? 'dashboard' : 'admin'}" style="display: inline-block; background-color: #e94560; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">View & Reply</a>
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
  siteUrl: string
): { subject: string; html: string } {
  const firstName = clientName.split(' ')[0]

  let statusBadge = ''
  let statusMessage = ''

  if (matchStatus === 'programmed') {
    statusBadge = `<div style="margin: 0 0 16px; display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: #f9731622; color: #f97316; border: 1px solid #f9731644;">Possible Match Found</div>`
    statusMessage = `<p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">We think this matches your <strong style="color: #ffffff;">programmed workout</strong> from Crystal${matchedWorkoutTitle ? `: <strong style="color: #d4a853;">${matchedWorkoutTitle}</strong>` : ''}.</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">Log in to confirm the match so your training log stays accurate.</p>`
  } else if (matchStatus === 'client') {
    statusBadge = `<div style="margin: 0 0 16px; display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: #06b6d422; color: #06b6d4; border: 1px solid #06b6d444;">Possible Match Found</div>`
    statusMessage = `<p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">We think this matches a <strong style="color: #ffffff;">workout you created</strong>${matchedWorkoutTitle ? `: <strong style="color: #06b6d4;">${matchedWorkoutTitle}</strong>` : ''}.</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">Log in to confirm the match so your training log stays accurate.</p>`
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
          <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: #e94560; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">Review in Dashboard</a>
        </td>
      </tr>
    </table>
  `

  return { subject, html }
}
