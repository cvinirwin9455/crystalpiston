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
export async function POST(request: Request) {
  try {
    const payload = await request.json()

    // Resend inbound webhook payload contains:
    // - from: sender email
    // - to: recipient (our inbound address like feedback+{id}@reply.crystalpistolperformance.com)
    // - subject: email subject
    // - text: plain text body
    // - html: html body
    // - attachments: array of attachments with filename, content (base64), content_type

    const { from, to, subject, text, html, attachments } = payload

    // Extract feedback ID from the To address
    // Format: feedback+{uuid}@reply.crystalpistolperformance.com
    let feedbackId: string | null = null
    const toAddress = Array.isArray(to) ? to[0] : to
    const match = toAddress?.match(/feedback\+([a-f0-9-]+)@/i)
    if (match) {
      feedbackId = match[1]
    }

    if (!feedbackId) {
      console.error('Inbound email: could not extract feedback ID from To:', toAddress)
      return NextResponse.json({ error: 'Invalid recipient' }, { status: 400 })
    }

    const adminClient = await getAdminClient()

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

    // Extract the sender email
    const senderEmail = typeof from === 'string' ? from : from?.address || from?.[0] || 'unknown'

    // Get the reply text (prefer plain text, strip common email reply artifacts)
    let replyText = text || ''
    // Strip everything after common reply markers
    const replyMarkers = [
      /\n--\s*\n/,  // -- signature marker
      /\nOn .+ wrote:\n/i,  // "On ... wrote:" quote header
      /\n>{2,}/,  // multiple > quote markers
      /\n-{3,}\s*Original Message/i,  // --- Original Message
    ]
    for (const marker of replyMarkers) {
      const idx = replyText.search(marker)
      if (idx > 0) {
        replyText = replyText.substring(0, idx)
      }
    }
    replyText = replyText.trim()

    if (!replyText && !attachments?.length) {
      // Nothing useful in the reply
      return NextResponse.json({ success: true, message: 'Empty reply ignored' })
    }

    // Handle attachments — upload to storage if present
    let attachmentUrls: string[] = []
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        try {
          // Only handle images
          if (!attachment.content_type?.startsWith('image/')) continue

          const fileExt = attachment.filename?.split('.').pop() || 'png'
          const fileName = `reply-${feedbackId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`

          // Decode base64 content
          const buffer = Buffer.from(attachment.content, 'base64')

          const { data, error } = await adminClient.storage
            .from('feedback-screenshots')
            .upload(fileName, buffer, {
              contentType: attachment.content_type,
              cacheControl: '3600',
            })

          if (!error && data) {
            const { data: { publicUrl } } = adminClient.storage
              .from('feedback-screenshots')
              .getPublicUrl(data.path)
            attachmentUrls.push(publicUrl)
          }
        } catch (err) {
          console.error('Failed to upload inbound attachment:', err)
        }
      }
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

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Inbound email processing error:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
