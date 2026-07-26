import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail, getEmailBrandFromOrgId, getProductionUrl } from '@/lib/email'
import { getOrgIdForUser } from '@/lib/org'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Verify the requesting user is an account_coach (super admin) or is_super_admin
async function verifyAdmin(supabase: any, adminClient: any): Promise<{ userId: string } | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await adminClient
    .from('users')
    .select('role, coach_level, is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile) return null
  // Allow if super admin OR if account_coach
  if (profile.is_super_admin) return { userId: user.id }
  if (profile.role === 'admin' && profile.coach_level === 'account_coach') return { userId: user.id }
  return null
}

// GET /api/feedback/admin - Get all feedback with optional filters
export async function GET(request: Request) {
  const supabase = await createClient()
  const adminClient = await getAdminClient()

  const admin = await verifyAdmin(supabase, adminClient)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const platform = searchParams.get('platform')
  const userRole = searchParams.get('user_role')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  let query = adminClient
    .from('feedback')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (type) query = query.eq('type', type)
  if (platform) query = query.eq('platform', platform)
  if (userRole) query = query.eq('user_role', userRole)

  const { data: feedback, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ feedback: feedback || [], total: count || 0 })
}

// PATCH /api/feedback/admin - Update a feedback item (status, notes, resolution)
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const adminClient = await getAdminClient()

  const admin = await verifyAdmin(supabase, adminClient)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { feedbackId, status, adminNotes, resolutionMessage, newLogEntries } = body

  if (!feedbackId) {
    return NextResponse.json({ error: 'feedbackId is required' }, { status: 400 })
  }

  // Validate status if provided
  if (status && !['new', 'in_progress', 'implemented', 'wont_fix'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Get current feedback record before updating
  const { data: existingFeedback } = await adminClient
    .from('feedback')
    .select('*')
    .eq('id', feedbackId)
    .single()

  if (!existingFeedback) {
    return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
  }

  // Build update object — only include fields that were provided
  const updateObj: Record<string, any> = {}
  if (status !== undefined) updateObj.status = status
  if (adminNotes !== undefined) updateObj.admin_notes = adminNotes

  // Append new log entries to existing activity_log
  if (newLogEntries && Array.isArray(newLogEntries) && newLogEntries.length > 0) {
    const existingLog = existingFeedback.activity_log || []
    // If there's an old resolution_message that isn't in the log yet, migrate it first
    if (existingFeedback.resolution_message) {
      const alreadyInLog = existingLog.some((e: any) => e.type === 'message' && e.text === existingFeedback.resolution_message)
      if (!alreadyInLog) {
        existingLog.push({ type: 'message', text: existingFeedback.resolution_message, date: existingFeedback.updated_at })
      }
    }
    updateObj.activity_log = [...existingLog, ...newLogEntries]
  }

  // Update resolution_message to latest message (used for email trigger logic)
  if (resolutionMessage !== undefined) updateObj.resolution_message = resolutionMessage

  if (Object.keys(updateObj).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data: updated, error } = await adminClient
    .from('feedback')
    .update(updateObj)
    .eq('id', feedbackId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If a resolution message was provided, send an update email to the user
  if (resolutionMessage) {
    try {
      const orgId = await getOrgIdForUser(adminClient, existingFeedback.user_id)
      const brand = getEmailBrandFromOrgId(orgId)
      const siteUrl = getProductionUrl(request.url)
      const platformLabel = existingFeedback.platform === 'crystal-pistol' ? 'Pistol Performance' : 'First Mile Coach'
      const typeLabel = existingFeedback.type === 'bug' ? 'bug report' : 'feedback'
      const firstName = existingFeedback.user_name?.split(' ')[0] || 'there'

      // Map status to friendly text
      const statusLabels: Record<string, string> = {
        new: 'Under Review',
        in_progress: 'In Progress',
        implemented: 'Implemented',
        wont_fix: 'Reviewed',
      }
      const currentStatus = status || existingFeedback.status
      const statusLabel = statusLabels[currentStatus] || 'Updated'

      const originalDesc = existingFeedback.description.length > 100
        ? existingFeedback.description.slice(0, 100) + '...'
        : existingFeedback.description

      const userEmailHtml = `
        <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">Hey ${firstName}! Update on your ${typeLabel}</h2>
        
        <div style="margin: 0 0 16px; padding: 12px 16px; background-color: rgba(255,255,255,0.05); border-radius: 8px;">
          <p style="margin: 0 0 4px; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your original ${typeLabel}:</p>
          <p style="margin: 0; color: #b0b0b0; font-size: 14px; font-style: italic;">"${originalDesc}"</p>
        </div>

        <div style="margin: 0 0 16px; display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: ${currentStatus === 'implemented' ? '#22c55e22' : '#3b82f622'}; color: ${currentStatus === 'implemented' ? '#22c55e' : '#3b82f6'}; border: 1px solid ${currentStatus === 'implemented' ? '#22c55e44' : '#3b82f644'};">
          Status: ${statusLabel}
        </div>

        <div style="margin: 0 0 24px; padding: 16px; background-color: rgba(212,168,83,0.1); border-left: 3px solid #d4a853; border-radius: 4px;">
          <p style="margin: 0 0 4px; color: #d4a853; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Message from the team</p>
          <p style="margin: 0; color: #e0e0e0; font-size: 15px; line-height: 1.6;">${resolutionMessage}</p>
        </div>

        <p style="margin: 0 0 8px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">
          Thanks for helping make ${platformLabel} better!
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
          <tr>
            <td align="center">
              <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">Open Dashboard</a>
            </td>
          </tr>
        </table>
      `

      if (existingFeedback.user_email) {
        await sendEmail({
          to: existingFeedback.user_email,
          subject: `Update on your ${typeLabel} — ${statusLabel}`,
          html: userEmailHtml,
          brand,
        })
      }
    } catch (err) {
      console.error('Feedback update email error:', err)
    }
  }

  return NextResponse.json({ success: true, feedback: updated })
}
