import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/feedback/inbound - Resend inbound email webhook
// Called when a user replies to a feedback update email
// Webhook payload contains metadata only — must call Resend API to get body/attachments
export async function POST(request: Request) {
  try {
    const payload = await request.json()

    // Resend email.received webhook payload:
    // { type: "email.received", data: { email_id, from, to, subject, created_at } }
    const eventType = payload.type
    const data = payload.data || payload

    // Handle both wrapper format and direct format
    const emailId = data.email_id || data.id
    const toField = data.to
    const fromField = data.from
    const subject = data.subject

    console.log('Inbound webhook received:', { eventType, emailId, to: toField, from: fromField, subject })

    if (!emailId) {
      console.error('Inbound email: no email_id in payload', JSON.stringify(payload).slice(0, 500))
      return NextResponse.json({ error: 'No email_id' }, { status: 400 })
    }

    // Extract feedback ID from the To address
    // Format: feedback+{uuid}@reply.crystalpistolperformance.com
    let feedbackId: string | null = null
    const toAddresses = Array.isArray(toField) ? toField : [toField]
    for (const addr of toAddresses) {
      const addrStr = typeof addr === 'string' ? addr : addr?.address || ''
      const match = addrStr.match(/feedback\+([a-f0-9-]+)@/i)
      if (match) {
        feedbackId = match[1]
        break
      }
    }

    if (!feedbackId) {
      console.error('Inbound email: could not extract feedback ID from To:', JSON.stringify(toField))
      return NextResponse.json({ error: 'Invalid recipient' }, { status: 400 })
    }

    // Fetch the full email content from Resend API
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured')
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    let emailText = ''
    let emailHtml = ''
    let attachmentData: any[] = []

    // Retrieve the received email body via Resend's Receiving API
    try {
      const emailRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
        headers: { 'Authorization': `Bearer ${resendApiKey}` },
      })
      if (emailRes.ok) {
        const emailContent = await emailRes.json()
        emailText = emailContent.text || ''
        emailHtml = emailContent.html || ''
        console.log('Retrieved email content, text length:', emailText.length, 'html length:', emailHtml.length)
      } else {
        const errText = await emailRes.text().catch(() => '')
        console.error('Failed to retrieve email content:', emailRes.status, errText)
        // Fallback: try the regular emails endpoint
        const fallbackRes = await fetch(`https://api.resend.com/emails/${emailId}`, {
          headers: { 'Authorization': `Bearer ${resendApiKey}` },
        })
        if (fallbackRes.ok) {
          const fallbackContent = await fallbackRes.json()
          emailText = fallbackContent.text || ''
          emailHtml = fallbackContent.html || ''
          console.log('Fallback retrieved email content, text length:', emailText.length)
        }
      }
    } catch (err) {
      console.error('Error fetching email content:', err)
    }

    // Strip common email reply artifacts from text
    let replyText = emailText
    // If no plain text, try to extract from HTML
    if (!replyText && emailHtml) {
      replyText = emailHtml.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    }
    const replyMarkers = [
      /\n--\s*\n/,
      /\nOn .+ wrote:\n/i,
      /\n>{2,}/,
      /\n-{3,}\s*Original Message/i,
      /\nFrom: .+\nSent: /i,
      /\n_{3,}\n/,
    ]
    for (const marker of replyMarkers) {
      const idx = replyText.search(marker)
      if (idx > 0) {
        replyText = replyText.substring(0, idx)
      }
    }
    replyText = replyText.trim()

    // Try to get attachments
    // Resend may have attachments in the email response or via a separate API
    const adminClient = await getAdminClient()
    let attachmentUrls: string[] = []

    // If there are attachment references, try to download and store them
    try {
      // Check if the email response includes attachment info
      const attachRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}/attachments`, {
        headers: { 'Authorization': `Bearer ${resendApiKey}` },
      })
      if (attachRes.ok) {
        const attachments = await attachRes.json()
        if (Array.isArray(attachments) && attachments.length > 0) {
          for (const attachment of attachments) {
            // Download the attachment content
            if (attachment.content_type?.startsWith('image/') && attachment.url) {
              try {
                const imgRes = await fetch(attachment.url)
                if (imgRes.ok) {
                  const buffer = Buffer.from(await imgRes.arrayBuffer())
                  const fileExt = attachment.filename?.split('.').pop() || 'png'
                  const fileName = `reply-${feedbackId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`

                  const { data: uploadData, error: uploadError } = await adminClient.storage
                    .from('feedback-screenshots')
                    .upload(fileName, buffer, {
                      contentType: attachment.content_type,
                      cacheControl: '3600',
                    })

                  if (!uploadError && uploadData) {
                    const { data: { publicUrl } } = adminClient.storage
                      .from('feedback-screenshots')
                      .getPublicUrl(uploadData.path)
                    attachmentUrls.push(publicUrl)
                  }
                }
              } catch (err) {
                console.error('Failed to download/upload attachment:', err)
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching attachments:', err)
    }

    // Get the feedback record
    const { data: feedback } = await adminClient
      .from('feedback')
      .select('*')
      .eq('id', feedbackId)
      .single()

    if (!feedback) {
      console.error('Inbound email: feedback not found for ID:', feedbackId)
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    // Extract sender info
    const senderEmail = typeof fromField === 'string' ? fromField : fromField?.address || fromField?.[0] || 'unknown'

    if (!replyText && attachmentUrls.length === 0) {
      console.log('Empty reply (no text and no attachments), skipping')
      return NextResponse.json({ success: true, message: 'Empty reply ignored' })
    }

    // Build the log entry
    const logEntry: any = {
      type: 'user_reply',
      text: replyText || '(attached screenshot)',
      date: new Date().toISOString(),
      from: senderEmail,
    }
    if (attachmentUrls.length > 0) {
      logEntry.attachments = attachmentUrls
    }

    // Append to activity_log
    const existingLog = feedback.activity_log || []
    const updatedLog = [...existingLog, logEntry]

    await adminClient
      .from('feedback')
      .update({ activity_log: updatedLog })
      .eq('id', feedbackId)

    // Send notification email to super admin
    const userName = feedback.user_name || senderEmail
    const truncatedReply = replyText.length > 200 ? replyText.slice(0, 200) + '...' : replyText
    const platformLabel = feedback.platform === 'crystal-pistol' ? 'Crystal Pistol' : 'First Mile'

    const adminEmailHtml = `
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">Reply from ${userName}</h2>
      <p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">
        <strong style="color: #ffffff;">${userName}</strong> replied to their ${feedback.type === 'bug' ? 'bug report' : 'feedback'} on <strong style="color: #d4a853;">${platformLabel}</strong>.
      </p>
      
      <div style="margin: 0 0 16px; padding: 16px; background-color: rgba(168,85,247,0.1); border-left: 3px solid #a855f7; border-radius: 4px;">
        <p style="margin: 0 0 4px; color: #a855f7; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Their Reply</p>
        <p style="margin: 0; color: #e0e0e0; font-size: 14px; line-height: 1.5;">${truncatedReply || '(see attachments)'}</p>
      </div>

      ${attachmentUrls.length > 0 ? `
      <div style="margin: 0 0 16px; padding: 12px 16px; background-color: rgba(255,255,255,0.05); border-radius: 4px;">
        <p style="margin: 0 0 8px; color: #888; font-size: 12px;">Attachments: ${attachmentUrls.length} image(s)</p>
        ${attachmentUrls.map(url => `<a href="${url}" target="_blank" style="color: #a855f7; font-size: 12px; margin-right: 12px;">View Image</a>`).join('')}
      </div>
      ` : ''}

      <div style="margin: 0 0 16px; padding: 12px 16px; background-color: rgba(255,255,255,0.05); border-radius: 4px;">
        <p style="margin: 0; color: #888; font-size: 12px;">Original ${feedback.type}: "${feedback.description.length > 80 ? feedback.description.slice(0, 80) + '...' : feedback.description}"</p>
      </div>
    `

    await sendEmail({
      to: 'curtisirwin@me.com',
      subject: `Reply from ${userName} on their ${feedback.type === 'bug' ? 'bug report' : 'feedback'} (${platformLabel})`,
      html: adminEmailHtml,
      brand: feedback.platform === 'crystal-pistol' ? 'crystal-pistol' : 'first-mile',
    })

    console.log('Inbound reply processed successfully for feedback:', feedbackId)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Inbound email processing error:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
