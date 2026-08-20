import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOrgIdForUser } from '@/lib/org'
import { sendEmail, getEmailBrandFromOrgId, getProductionUrl } from '@/lib/email'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/feedback - Submit a bug report or feedback
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type, description, priority, pageUrl, platform, userRole, screenshotUrl } = body

  // Validate required fields
  if (!type || !['bug', 'feedback', 'question'].includes(type)) {
    return NextResponse.json({ error: 'Type must be "bug", "feedback", or "question"' }, { status: 400 })
  }
  if (!description || !description.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 })
  }
  if (!platform || !['crystal-pistol', 'first-mile'].includes(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  }
  if (!userRole || !['coach', 'client'].includes(userRole)) {
    return NextResponse.json({ error: 'Invalid user role' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Get user details
  const { data: userProfile } = await adminClient
    .from('users')
    .select('name, email')
    .eq('id', user.id)
    .single()

  const userName = userProfile?.name || ''
  const userEmail = userProfile?.email || user.email || ''

  // If type is "question", route to inbound_emails (Super Admin Inbox) instead of feedback table
  if (type === 'question') {
    const subject = `Question from ${userName || userEmail} (${userRole})`

    const { error: inboxError } = await adminClient
      .from('inbound_emails')
      .insert({
        direction: 'inbound',
        from_email: userEmail,
        from_name: userName || null,
        to_email: 'hello@firstmilecoach.com',
        subject,
        body_text: description.trim(),
        body_html: null,
        read: false,
      })

    if (inboxError) {
      console.error('Failed to save question to inbound_emails:', JSON.stringify(inboxError))
      return NextResponse.json({ error: 'Failed to submit question' }, { status: 500 })
    }

    // Send notification email to super admin
    try {
      const platformLabel = platform === 'crystal-pistol' ? 'Crystal Pistol' : 'First Mile'
      const roleLabel = userRole === 'coach' ? 'Coach' : 'Client'

      const adminEmailHtml = `
        <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">New Question</h2>
        <p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">
          <strong style="color: #ffffff;">${userName || 'A user'}</strong> (${roleLabel}) asked a question on <strong style="color: #d4a853;">${platformLabel}</strong>.
        </p>
        <div style="margin: 0 0 16px; padding: 16px; background-color: rgba(59,130,246,0.1); border-left: 3px solid #3b82f6; border-radius: 4px;">
          <p style="margin: 0 0 4px; color: #3b82f6; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Question</p>
          <p style="margin: 0; color: #e0e0e0; font-size: 14px; line-height: 1.5;">${description.trim()}</p>
        </div>
        <p style="margin: 16px 0 0; font-size: 13px; color: #888;">View and reply in Super Admin → Inbox tab.</p>
      `

      await sendEmail({
        to: 'curtisirwin@me.com',
        subject: `New question from ${userName || 'a user'} (${platformLabel})`,
        html: adminEmailHtml,
        brand: 'first-mile',
      })
    } catch (err) {
      console.error('Admin notification error (question still saved):', err)
    }

    return NextResponse.json({
      success: true,
      feedbackId: null,
      createdAt: new Date().toISOString(),
    })
  }

  // Insert feedback/bug into feedback database table
  const { data: feedback, error } = await adminClient
    .from('feedback')
    .insert({
      user_id: user.id,
      user_email: userEmail,
      user_name: userName,
      platform,
      user_role: userRole,
      type,
      description: description.trim(),
      page_url: pageUrl || null,
      screenshot_url: screenshotUrl || null,
      priority: priority || 'medium',
      status: 'new',
    })
    .select('id, created_at')
    .single()

  if (error) {
    console.error('Failed to insert feedback:', error)
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }

  // Determine brand for emails
  const orgId = await getOrgIdForUser(adminClient, user.id)
  const brand = getEmailBrandFromOrgId(orgId)
  const siteUrl = getProductionUrl(request.url)

  // 1. Send notification email to super admin (curtisirwin@me.com)
  try {
    const typeLabel = type === 'bug' ? 'Bug Report' : type === 'question' ? 'Question' : 'Feature Feedback'
    const priorityLabel = priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Medium'
    const platformLabel = platform === 'crystal-pistol' ? 'Crystal Pistol' : 'First Mile'
    const roleLabel = userRole === 'coach' ? 'Coach' : 'Client'
    const truncatedDesc = description.trim().length > 200 ? description.trim().slice(0, 200) + '...' : description.trim()

    const adminEmailHtml = `
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">New ${typeLabel}</h2>
      <p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">
        <strong style="color: #ffffff;">${userName || 'A user'}</strong> (${roleLabel}) submitted a ${type === 'bug' ? 'bug report' : 'feature suggestion'} on <strong style="color: #d4a853;">${platformLabel}</strong>.
      </p>
      
      <div style="margin: 0 0 16px; padding: 16px; background-color: rgba(${type === 'bug' ? '239,68,68' : '34,197,94'},0.1); border-left: 3px solid ${type === 'bug' ? '#ef4444' : '#22c55e'}; border-radius: 4px;">
        <p style="margin: 0 0 4px; color: ${type === 'bug' ? '#ef4444' : '#22c55e'}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">${typeLabel} &bull; ${priorityLabel} Priority</p>
        <p style="margin: 0; color: #e0e0e0; font-size: 14px; line-height: 1.5;">${truncatedDesc}</p>
      </div>

      <div style="margin: 0 0 16px; padding: 12px 16px; background-color: rgba(255,255,255,0.05); border-radius: 4px;">
        <p style="margin: 0 0 4px; color: #888; font-size: 12px;">From: ${userName} &lt;${userEmail}&gt;</p>
        <p style="margin: 0 0 4px; color: #888; font-size: 12px;">Platform: ${platformLabel} &bull; Role: ${roleLabel}</p>
        ${pageUrl ? `<p style="margin: 0; color: #888; font-size: 12px;">Page: ${pageUrl}</p>` : ''}
      </div>
    `

    sendEmail({
      to: 'curtisirwin@me.com',
      subject: `New ${typeLabel} from ${userName || 'a user'} (${platformLabel})`,
      html: adminEmailHtml,
      brand,
    }).catch(err => console.error('Failed to send admin notification:', err))
  } catch (err) {
    console.error('Admin notification error (feedback still saved):', err)
  }

  // 2. Send thank-you email to the user
  try {
    const firstName = userName.split(' ')[0] || 'there'
    const typeLabel = type === 'bug' ? 'bug report' : 'feedback'
    const platformLabel = platform === 'crystal-pistol' ? 'Pistol Performance' : 'First Mile Coach'

    const userEmailHtml = `
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">Thanks, ${firstName}!</h2>
      <p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">
        We received your ${typeLabel} and really appreciate you taking the time to let us know. Your input helps make ${platformLabel} better for everyone.
      </p>
      <p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">
        We'll review it soon and you'll get an email update when there's progress to share.
      </p>
      <p style="margin: 0; font-size: 14px; color: #d4a853; font-weight: 600;">— The ${platformLabel} Team</p>
    `

    if (userEmail) {
      sendEmail({
        to: userEmail,
        subject: `We got your ${typeLabel} — thanks!`,
        html: userEmailHtml,
        brand,
      }).catch(err => console.error('Failed to send user thank-you email:', err))
    }
  } catch (err) {
    console.error('User thank-you email error:', err)
  }

  return NextResponse.json({
    success: true,
    feedbackId: feedback.id,
    createdAt: feedback.created_at,
  })
}

// GET /api/feedback - Get current user's own feedback submissions
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await getAdminClient()

  const { data: feedback, error } = await adminClient
    .from('feedback')
    .select('id, type, description, status, priority, created_at, updated_at, resolution_message')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(feedback || [])
}
