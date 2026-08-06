import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'curtisirwin@me.com'

export async function POST(request: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Missing RESEND_API_KEY' }, { status: 500 })
    }

    const body = await request.json()
    const { emails, admin_key } = body

    // Simple auth check — require a secret key to prevent unauthorized sends
    if (admin_key !== process.env.MARKETING_ADMIN_KEY) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ success: false, error: 'emails must be a non-empty array' }, { status: 400 })
    }

    const senderEmail = process.env.FIRSTMILE_SENDER_EMAIL || 'hello@firstmilecoach.com'
    const results: { email: string; success: boolean; error?: string }[] = []

    for (const email of emails) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from: `First Mile Coach <${senderEmail}>`,
            to: [email],
            reply_to: 'hello@firstmilecoach.com',
            subject: "Your first clients shouldn't cost a fortune to manage",
            html: getMarketingEmailHtml(email),
          }),
        })

        if (res.ok) {
          results.push({ email, success: true })
        } else {
          const err = await res.text()
          results.push({ email, success: false, error: err })
        }
      } catch (err: any) {
        results.push({ email, success: false, error: err?.message || 'Unknown error' })
      }
    }

    // Notify admin of the send
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: `First Mile Coach <${senderEmail}>`,
        to: [ADMIN_EMAIL],
        subject: `Marketing email sent to ${results.filter(r => r.success).length}/${emails.length} recipients`,
        html: `<pre>${JSON.stringify(results, null, 2)}</pre>`,
      }),
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    })

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}

function getMarketingEmailHtml(recipientEmail: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>First Mile Coach</title>
</head>
<body style="margin: 0; padding: 0; background-color: #fafbfc; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafbfc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid rgba(0,0,0,0.08); overflow: hidden; box-shadow: 0 4px 30px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(145deg, #2d3436, #3d4447);">
              <img src="https://firstmilecoach.com/firstmile/logo.png" alt="First Mile Coach" width="180" style="display: block; margin: 0 auto; border-radius: 8px;" />
              <p style="margin: 16px 0 0; font-size: 14px; color: rgba(255,255,255,0.7); letter-spacing: 0.5px;">The $1/month platform for new coaches</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 32px 32px;">
              <h1 style="margin: 0 0 16px; font-size: 26px; font-weight: 800; color: #2d3436; line-height: 1.3;">
                Your first clients shouldn&rsquo;t cost a fortune to manage.
              </h1>

              <p style="margin: 0 0 20px; font-size: 16px; color: #555b5e; line-height: 1.7;">
                Hey there &mdash; we&rsquo;re Curtis and Crystal, and we built <strong style="color: #f26522;">First Mile Coach</strong> because every new coach hits the same wall.
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; color: #555b5e; line-height: 1.7;">
                The &ldquo;professional&rdquo; platforms charge $50&ndash;$200/month before you&rsquo;ve even landed your first paying client. You end up managing clients with notebooks, spreadsheets, and scattered WhatsApp messages.
              </p>

              <p style="margin: 0 0 28px; font-size: 16px; color: #555b5e; line-height: 1.7;">
                We fixed that. <strong>$1/month per 10 active clients.</strong> All features included. No lock-in.
              </p>

              <!-- What's Included -->
              <div style="margin: 0 0 28px; padding: 20px 24px; background: #fff8f4; border-radius: 12px; border: 1px solid rgba(242,101,34,0.15);">
                <p style="margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #2d3436;">What you get:</p>
                <table cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #555b5e;">&check; Training plan builder</td></tr>
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #555b5e;">&check; Client dashboard &amp; progress tracking</td></tr>
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #555b5e;">&check; In-app messaging</td></tr>
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #555b5e;">&check; Email notifications (both directions)</td></tr>
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #555b5e;">&check; Session notes</td></tr>
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #555b5e;">&check; Works on any device &mdash; no app download</td></tr>
                </table>
              </div>

              <!-- Beta CTA -->
              <div style="margin: 0 0 32px; text-align: center; padding: 28px 24px; background: linear-gradient(135deg, #2d3436 0%, #3d4447 100%); border-radius: 12px;">
                <p style="margin: 0 0 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #f26522;">Beta Program</p>
                <p style="margin: 0 0 16px; font-size: 20px; font-weight: 800; color: #ffffff;">Free until June 30, 2027</p>
                <p style="margin: 0 0 20px; font-size: 14px; color: rgba(255,255,255,0.75); line-height: 1.6;">
                  We&rsquo;re accepting the first <strong style="color: #fff;">50 coaches</strong>. Unlimited clients, completely free during the beta.
                </p>
                <a href="https://firstmilecoach.com#beta" style="display: inline-block; padding: 14px 36px; background: #f26522; color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 50px;">
                  Apply for Beta Access &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Who We Are -->
          <tr>
            <td style="padding: 0 32px 40px;">
              <table cellpadding="0" cellspacing="0" style="width: 100%; border-top: 1px solid rgba(0,0,0,0.06); padding-top: 32px;">
                <tr>
                  <td colspan="2" style="padding-bottom: 20px;">
                    <p style="margin: 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #9e9e9e;">Who&rsquo;s behind this</p>
                    <h2 style="margin: 8px 0 12px; font-size: 20px; font-weight: 800; color: #2d3436;">Built by a brother for his sister. Now built for you.</h2>
                    <p style="margin: 0; font-size: 14px; color: #555b5e; line-height: 1.7;">
                      This isn&rsquo;t a faceless startup. It&rsquo;s a family project &mdash; built by two people who saw a real problem and fixed it.
                    </p>
                  </td>
                </tr>
                <tr>
                  <!-- Crystal -->
                  <td style="width: 50%; vertical-align: top; padding-right: 12px;">
                    <div style="text-align: center; padding: 20px 12px; background: #fafbfc; border-radius: 12px; border: 1px solid rgba(0,0,0,0.06);">
                      <img src="https://firstmilecoach.com/IMG_0995.JPG" alt="Crystal Irwin" width="80" height="80" style="border-radius: 50%; object-fit: cover; border: 3px solid #f26522; display: block; margin: 0 auto 12px;" />
                      <p style="margin: 0 0 2px; font-size: 14px; font-weight: 700; color: #2d3436;">Crystal Irwin</p>
                      <p style="margin: 0 0 6px; font-size: 11px; font-weight: 600; color: #f26522; text-transform: uppercase; letter-spacing: 0.5px;">Running Coach &amp; Co-Founder</p>
                      <p style="margin: 0 0 8px; font-size: 11px; color: #9e9e9e;">Springfield, Missouri, USA</p>
                      <p style="margin: 0; font-size: 12px; color: #555b5e; line-height: 1.6; text-align: left;">
                        Running coach (5K to ultramarathons), CrossFit L1 certified. Coaches runners of all levels on top of her full-time job. The reason First Mile Coach exists.
                      </p>
                      <a href="https://www.crystalpistolperformance.com" style="display: inline-block; margin-top: 10px; font-size: 11px; font-weight: 600; color: #f26522; text-decoration: none;">Crystal&rsquo;s coaching site &rarr;</a>
                    </div>
                  </td>
                  <!-- Curtis -->
                  <td style="width: 50%; vertical-align: top; padding-left: 12px;">
                    <div style="text-align: center; padding: 20px 12px; background: #fafbfc; border-radius: 12px; border: 1px solid rgba(0,0,0,0.06);">
                      <img src="https://firstmilecoach.com/IMG_8868.jpeg" alt="Curtis Irwin" width="80" height="80" style="border-radius: 50%; object-fit: cover; border: 3px solid #f26522; display: block; margin: 0 auto 12px;" />
                      <p style="margin: 0 0 2px; font-size: 14px; font-weight: 700; color: #2d3436;">Curtis Irwin</p>
                      <p style="margin: 0 0 6px; font-size: 11px; font-weight: 600; color: #f26522; text-transform: uppercase; letter-spacing: 0.5px;">Builder &amp; Co-Founder</p>
                      <p style="margin: 0 0 8px; font-size: 11px; color: #9e9e9e;">London, England, UK</p>
                      <p style="margin: 0; font-size: 12px; color: #555b5e; line-height: 1.6; text-align: left;">
                        L&amp;D leader at Amazon. Built this platform for his sister Crystal, then realised every new coach has the same problem. Now building it for all of you.
                      </p>
                      <a href="https://curtisirwin.com" style="display: inline-block; margin-top: 10px; font-size: 11px; font-weight: 600; color: #f26522; text-decoration: none;">About Curtis &rarr;</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Story -->
          <tr>
            <td style="padding: 0 32px 32px;">
              <div style="padding: 20px 24px; background: #fff8f4; border-radius: 12px; border: 1px solid rgba(242,101,34,0.1);">
                <p style="margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #2d3436;">The short version:</p>
                <p style="margin: 0; font-size: 14px; color: #555b5e; line-height: 1.7;">
                  Crystal was coaching runners but managing everything with notebooks and WhatsApp. The &ldquo;real&rdquo; tools cost $50&ndash;$200/month &mdash; way too much for someone coaching on top of a day job. Curtis built something better. They realised it could help every new coach. First Mile Coach was born.
                </p>
              </div>
            </td>
          </tr>

          <!-- Forward -->
          <tr>
            <td style="padding: 0 32px 32px; text-align: center;">
              <div style="padding: 20px; border: 1px dashed rgba(0,0,0,0.15); border-radius: 12px;">
                <p style="margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #2d3436;">Know a coach who&rsquo;d benefit?</p>
                <p style="margin: 0; font-size: 13px; color: #555b5e; line-height: 1.6;">
                  Forward this email to any coach, trainer, or friend who&rsquo;s just getting started. The first 50 spots won&rsquo;t last long.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid rgba(0,0,0,0.06); text-align: center; background: #fafbfc;">
              <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #2d3436;">First Mile Coach</p>
              <p style="margin: 0 0 4px; font-size: 12px; color: #9e9e9e;">The cheapest, simplest way to start coaching.</p>
              <p style="margin: 0 0 12px; font-size: 12px; color: #9e9e9e;">
                <a href="https://firstmilecoach.com" style="color: #f26522; text-decoration: none;">firstmilecoach.com</a> &nbsp;|&nbsp;
                <a href="https://firstmilecoach.com#about" style="color: #f26522; text-decoration: none;">About Us</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #bbb; line-height: 1.5;">
                You&rsquo;re receiving this because someone thought you&rsquo;d find First Mile Coach useful.<br />
                If this isn&rsquo;t for you, no worries &mdash; no further emails will be sent unless you sign up.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
