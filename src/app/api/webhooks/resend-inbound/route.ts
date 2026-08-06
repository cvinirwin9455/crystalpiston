import { NextResponse } from 'next/server'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const ADMIN_EMAIL = 'curtisirwin@me.com'

// POST /api/webhooks/resend-inbound
// Resend fires this webhook when an email is received at hello@firstmilecoach.com
export async function POST(request: Request) {
  try {
    const payload = await request.json()

    // Resend webhook format: { type: "email.received", data: { email_id, from, to, subject, created_at } }
    const data = payload.data || payload
    const emailId = data.email_id || data.id

    if (!emailId) {
      console.error('Inbound email webhook: no email_id', JSON.stringify(payload).slice(0, 500))
      return NextResponse.json({ error: 'No email_id' }, { status: 400 })
    }

    const fromField = data.from
    const toField = data.to
    const subject = data.subject || '(No subject)'

    // Extract sender info
    let fromEmail = ''
    let fromName = ''
    if (typeof fromField === 'string') {
      fromEmail = fromField
    } else if (Array.isArray(fromField) && fromField.length > 0) {
      const first = fromField[0]
      fromEmail = typeof first === 'string' ? first : first?.address || first?.email || ''
      fromName = typeof first === 'object' ? first?.name || '' : ''
    } else if (typeof fromField === 'object') {
      fromEmail = fromField?.address || fromField?.email || ''
      fromName = fromField?.name || ''
    }

    // Extract to address
    let toEmail = 'hello@firstmilecoach.com'
    if (Array.isArray(toField) && toField.length > 0) {
      const first = toField[0]
      toEmail = typeof first === 'string' ? first : first?.address || first?.email || toEmail
    } else if (typeof toField === 'string') {
      toEmail = toField
    }

    // Fetch full email content from Resend API
    const resendApiKey = process.env.RESEND_API_KEY
    let bodyText = ''
    let bodyHtml = ''

    if (resendApiKey) {
      try {
        const emailRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
          headers: { 'Authorization': `Bearer ${resendApiKey}` },
        })
        if (emailRes.ok) {
          const emailContent = await emailRes.json()
          bodyText = emailContent.text || ''
          bodyHtml = emailContent.html || ''
        } else {
          // Fallback
          const fallbackRes = await fetch(`https://api.resend.com/emails/${emailId}`, {
            headers: { 'Authorization': `Bearer ${resendApiKey}` },
          })
          if (fallbackRes.ok) {
            const fallbackContent = await fallbackRes.json()
            bodyText = fallbackContent.text || ''
            bodyHtml = fallbackContent.html || ''
          }
        }
      } catch (err) {
        console.error('Failed to fetch email content from Resend:', err)
      }
    }

    // Strip quoted reply text (everything after "On ... wrote:" or "> " lines)
    let cleanText = bodyText
    const onWroteMatch = cleanText.match(/\nOn .+ wrote:\n/s)
    if (onWroteMatch && onWroteMatch.index) {
      cleanText = cleanText.slice(0, onWroteMatch.index).trim()
    }
    // Also strip lines starting with ">"
    cleanText = cleanText.split('\n').filter(line => !line.startsWith('>')).join('\n').trim()

    if (!cleanText && bodyHtml) {
      cleanText = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    }

    // Check if this is a reply to an existing thread
    const adminClient = await getAdminClient()

    // Try to find existing thread by sender email + subject
    let threadId: string | null = null
    const cleanSubject = subject.replace(/^(Re|Fwd|Fw):\s*/gi, '').trim()

    const { data: existingThread } = await adminClient
      .from('inbound_emails')
      .select('thread_id')
      .eq('from_email', fromEmail)
      .ilike('subject', `%${cleanSubject}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingThread) {
      threadId = existingThread.thread_id
    }

    // Also check if we sent an outbound to this person with matching subject
    if (!threadId) {
      const { data: outboundThread } = await adminClient
        .from('inbound_emails')
        .select('thread_id')
        .eq('direction', 'outbound')
        .ilike('subject', `%${cleanSubject}%`)
        .or(`to_email.eq.${fromEmail},from_email.eq.${fromEmail}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (outboundThread) {
        threadId = outboundThread.thread_id
      }
    }

    // Insert into database
    const { error: insertError } = await adminClient
      .from('inbound_emails')
      .insert({
        thread_id: threadId || undefined, // will auto-generate if null
        direction: 'inbound',
        from_email: fromEmail,
        from_name: fromName || null,
        to_email: toEmail,
        subject,
        body_text: cleanText || bodyText,
        body_html: bodyHtml || null,
        resend_email_id: emailId,
        read: false,
      })

    if (insertError) {
      console.error('Failed to insert inbound email:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Send notification to admin
    if (resendApiKey) {
      const senderEmail = process.env.FIRSTMILE_SENDER_EMAIL || 'hello@firstmilecoach.com'
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: `First Mile Coach <${senderEmail}>`,
          to: [ADMIN_EMAIL],
          subject: `New email from ${fromName || fromEmail}: ${subject}`,
          html: `<div style="font-family: sans-serif; max-width: 500px; padding: 20px;">
            <p style="color: #888; font-size: 12px; margin: 0 0 8px;">New inbound email to hello@firstmilecoach.com</p>
            <h2 style="margin: 0 0 12px; color: #2d3436;">${subject}</h2>
            <p style="margin: 0 0 4px;"><strong>From:</strong> ${fromName ? `${fromName} (${fromEmail})` : fromEmail}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
            <div style="white-space: pre-wrap; color: #444; line-height: 1.6;">${cleanText || '(No text content)'}</div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
            <p style="margin: 0;"><a href="https://firstmilecoach.com/super-admin" style="color: #f26522; font-weight: 600;">Reply in Super Admin →</a></p>
          </div>`,
        }),
      }).catch(err => console.error('Admin notification failed:', err))
    }

    console.log('Inbound email stored:', { emailId, from: fromEmail, subject })
    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('Inbound webhook error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
