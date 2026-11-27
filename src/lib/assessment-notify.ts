/**
 * Email the coaches when a client completes their health assessment.
 *
 * Recipients: the coaches assigned to the client (client_coaches). If the client has no
 * assigned coach, the account coaches of the client's organization. Each coach's
 * notification settings apply (same "completed workout" setting and custom notification
 * addresses as the workout emails). Duplicate addresses get a single email.
 */

type AdminClient = { from: (table: string) => any }

export type AssessmentNotifyResult = { sent: number; recipients: string[] }

// Should this save notify the coaches? Yes for a first completion and for a completion
// that follows a review request. No for a client re-saving an already-completed assessment.
export function shouldNotifyAssessmentCompleted(existing: { status?: string | null } | null | undefined): boolean {
  return !existing || existing.status !== 'completed'
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function notifyCoachesAssessmentCompleted(
  adminClient: AdminClient,
  params: { clientId: string; clientUserId: string; wasReviewRequest: boolean; requestUrl: string }
): Promise<AssessmentNotifyResult> {
  const { clientId, clientUserId, wasReviewRequest, requestUrl } = params

  const { data: clientUser } = await adminClient
    .from('users')
    .select('name, organization_id')
    .eq('id', clientUserId)
    .maybeSingle()
  const orgId: string | null = clientUser?.organization_id || null
  const clientName: string = (clientUser?.name || '').trim() || 'A client'

  // 1) Assigned coaches
  const { data: assignments } = await adminClient
    .from('client_coaches')
    .select('coach_id')
    .eq('client_id', clientId)
  let coachIds: string[] = (assignments || []).map((a: any) => a.coach_id).filter(Boolean)

  let coaches: { id: string; email: string | null }[] = []
  if (coachIds.length > 0) {
    const { data } = await adminClient.from('users').select('id, email').in('id', coachIds)
    coaches = data || []
  }

  // 2) No assigned coach: the organization's account coaches (never another organization's)
  if (coaches.length === 0 && orgId) {
    const { data } = await adminClient
      .from('users')
      .select('id, email')
      .eq('organization_id', orgId)
      .eq('role', 'admin')
      .eq('coach_level', 'account_coach')
    coaches = data || []
  }

  // Apply each coach's settings
  const addresses: string[] = []
  for (const coach of coaches) {
    const { data: prefs } = await adminClient
      .from('notification_preferences')
      .select('workout_completed, notification_emails')
      .eq('user_id', coach.id)
      .maybeSingle()
    if ((prefs?.workout_completed || 'immediate') !== 'immediate') continue
    if (prefs?.notification_emails) {
      for (const e of String(prefs.notification_emails).split(',').map((x) => x.trim()).filter(Boolean)) addresses.push(e)
    } else if (coach.email) {
      addresses.push(coach.email)
    }
  }
  const seen = new Set<string>()
  const recipients = addresses.filter((e) => {
    const key = e.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (recipients.length === 0) return { sent: 0, recipients: [] }

  const { sendEmail, getProductionUrl, getEmailBrandFromOrgId } = await import('@/lib/email')
  const brand = getEmailBrandFromOrgId(orgId)
  const siteUrl = getProductionUrl(requestUrl)
  const safeName = escapeHtml(clientName)
  const subject = wasReviewRequest
    ? `${clientName} updated their health assessment`
    : `${clientName} completed their health assessment`
  const lead = wasReviewRequest
    ? `${safeName} reviewed and updated their health assessment, as you asked.`
    : `${safeName} has completed their health assessment.`
  const html = `
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">${safeName}</h2>
    <div style="margin: 0 0 8px; display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: #22c55e22; color: #22c55e; border: 1px solid #22c55e44;">Assessment ${wasReviewRequest ? 'Updated' : 'Completed'}</div>
    <p style="margin: 12px 0 24px; font-size: 14px; color: #e0e0e0; line-height: 1.6;">${lead} You can read their answers in the client's Assessment tab.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${siteUrl}/admin" style="display: inline-block; background-color: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">View in Dashboard</a>
        </td>
      </tr>
    </table>
  `
  // Awaited, not fire-and-forget: a serverless function can be frozen once the response is
  // sent, which would silently drop un-awaited emails.
  const results = await Promise.allSettled(recipients.map((to) => sendEmail({ to, subject, html, brand })))
  const sent = results.filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<boolean>).value !== false).length
  results.forEach((r) => { if (r.status === 'rejected') console.error('Assessment notification email failed:', r.reason) })
  return { sent, recipients }
}
