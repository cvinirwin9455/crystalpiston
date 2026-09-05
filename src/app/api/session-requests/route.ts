import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/session-requests
//   ?client_id=xxx  -> requests for one client (coach view)
//   ?pending=true   -> all pending requests across the coach's org (dashboard)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const pendingOnly = searchParams.get('pending') === 'true'

  const adminClient = await getAdminClient()

  let query = adminClient
    .from('session_requests')
    .select('id, session_id, client_id, request_type, note, preferred_datetime, preferred_slots, status, created_at, resolved_at')
    .order('created_at', { ascending: false })

  if (clientId) {
    query = query.eq('client_id', clientId)
  }
  if (pendingOnly) {
    query = query.eq('status', 'pending')
  }

  const { data: requests, error } = await query
  if (error) {
    // Table may not exist yet
    return NextResponse.json([])
  }

  // For dashboard/pending view, enrich with client name + session date
  if (pendingOnly && requests && requests.length > 0) {
    const clientIds = [...new Set(requests.map((r: any) => r.client_id))]
    const sessionIds = [...new Set(requests.map((r: any) => r.session_id))]

    const { data: clientRows } = await adminClient
      .from('clients')
      .select('id, user_id')
      .in('id', clientIds)
    const userIds = (clientRows || []).map((c: any) => c.user_id)
    const { data: userRows } = await adminClient
      .from('users')
      .select('id, name')
      .in('id', userIds)
    const { data: sessionRows } = await adminClient
      .from('sessions')
      .select('id, scheduled_at, location')
      .in('id', sessionIds)

    const clientName: Record<string, string> = {}
    for (const c of clientRows || []) {
      const u = (userRows || []).find((x: any) => x.id === c.user_id)
      clientName[c.id] = u?.name || 'Client'
    }
    const sessionInfo: Record<string, any> = {}
    for (const s of sessionRows || []) sessionInfo[s.id] = s

    const enriched = requests.map((r: any) => ({
      ...r,
      clientName: clientName[r.client_id] || 'Client',
      sessionScheduledAt: sessionInfo[r.session_id]?.scheduled_at || null,
      sessionLocation: sessionInfo[r.session_id]?.location || null,
    }))
    return NextResponse.json(enriched)
  }

  return NextResponse.json(requests || [])
}

// POST /api/session-requests - Client creates a cancel/reschedule request
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { sessionId, requestType, note, preferredDatetime, preferredSlots } = body

  if (!sessionId || !requestType || !['cancel', 'reschedule'].includes(requestType)) {
    return NextResponse.json({ error: 'sessionId and valid requestType are required' }, { status: 400 })
  }

  // Normalize the offered availability slots (reschedule only). Accept an array of
  // timezone-naive datetime strings, cap at 3, and drop blanks. Fall back to the
  // legacy single preferredDatetime if no slots array was sent.
  let slots: string[] = []
  if (Array.isArray(preferredSlots)) {
    slots = preferredSlots.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 3)
  } else if (preferredDatetime) {
    slots = [preferredDatetime]
  }
  // Keep preferred_datetime in sync with the first slot for backward compatibility.
  const firstSlot = slots.length > 0 ? slots[0] : (preferredDatetime || null)

  const adminClient = await getAdminClient()

  // Look up the session to get client_id + organization_id, and verify it belongs to this user
  const { data: session } = await adminClient
    .from('sessions')
    .select('id, client_id, organization_id, coach_id, scheduled_at')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Verify the requesting user owns this client record
  const { data: clientRow } = await adminClient
    .from('clients')
    .select('id, user_id')
    .eq('id', session.client_id)
    .single()

  if (!clientRow || clientRow.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Create the request
  const { data: reqRow, error } = await adminClient
    .from('session_requests')
    .insert({
      session_id: sessionId,
      client_id: session.client_id,
      organization_id: session.organization_id,
      request_type: requestType,
      note: note || null,
      preferred_datetime: firstSlot,
      preferred_slots: requestType === 'reschedule' && slots.length > 0 ? slots : null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Notify the coach(es) — fire and forget
  try {
    await notifyCoachesOfRequest(adminClient, session, requestType, note, requestType === 'reschedule' && slots.length > 0 ? slots : (firstSlot ? [firstSlot] : []), request.url, user.id)
  } catch (notifErr) {
    console.error('Failed to notify coaches of session request:', notifErr)
  }

  return NextResponse.json({ success: true, request: reqRow })
}

// PATCH /api/session-requests - Coach resolves a request
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { requestId, action, acceptedSlot } = body
  if (!requestId) {
    return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Load the request + its session so we can act on it and notify the client.
  const { data: reqRow } = await adminClient
    .from('session_requests')
    .select('id, session_id, client_id, organization_id, request_type')
    .eq('id', requestId)
    .single()

  if (!reqRow) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  // action: 'accept_slot' -> move the session to acceptedSlot, then resolve + notify client
  //         'reject'       -> cancel the session (no charge), resolve + notify client to contact coach
  //         (none)         -> legacy: just resolve/dismiss the request (no session change, no email)
  if (action === 'accept_slot') {
    if (!acceptedSlot || typeof acceptedSlot !== 'string') {
      return NextResponse.json({ error: 'acceptedSlot is required for accept_slot' }, { status: 400 })
    }
    const { error: sessErr } = await adminClient
      .from('sessions')
      .update({ scheduled_at: acceptedSlot, status: 'scheduled' })
      .eq('id', reqRow.session_id)
    if (sessErr) {
      return NextResponse.json({ error: sessErr.message }, { status: 500 })
    }
  } else if (action === 'reject') {
    const { error: sessErr } = await adminClient
      .from('sessions')
      .update({ status: 'cancelled_no_charge', marked_at: new Date().toISOString() })
      .eq('id', reqRow.session_id)
    if (sessErr) {
      return NextResponse.json({ error: sessErr.message }, { status: 500 })
    }
  }

  const { error } = await adminClient
    .from('session_requests')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', requestId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Notify the client of the coach's decision (accept/reject only) — fire and forget.
  if (action === 'accept_slot' || action === 'reject') {
    try {
      await notifyClientOfDecision(adminClient, reqRow, action, acceptedSlot || null, request.url)
    } catch (notifErr) {
      console.error('Failed to notify client of session decision:', notifErr)
    }
  }

  return NextResponse.json({ success: true })
}

// Helper: notify the client after the coach accepts a new time or cancels the session.
async function notifyClientOfDecision(
  adminClient: any,
  reqRow: any,
  action: 'accept_slot' | 'reject',
  acceptedSlot: string | null,
  requestUrl: string
) {
  // Resolve the client's user + email + coach name.
  const { data: clientRow } = await adminClient
    .from('clients')
    .select('id, user_id')
    .eq('id', reqRow.client_id)
    .single()
  if (!clientRow?.user_id) return

  const { data: clientUser } = await adminClient
    .from('users')
    .select('email, name')
    .eq('id', clientRow.user_id)
    .single()
  if (!clientUser?.email) return

  const firstName = clientUser.name?.split(' ')[0] || 'there'

  // Coach name (first assigned coach or session coach) for a friendly signature.
  const { data: session } = await adminClient
    .from('sessions')
    .select('coach_id, location')
    .eq('id', reqRow.session_id)
    .single()
  let coachName = 'your coach'
  if (session?.coach_id) {
    const { data: coach } = await adminClient
      .from('users')
      .select('name')
      .eq('id', session.coach_id)
      .single()
    if (coach?.name) coachName = coach.name
  }

  const fmtSlot = (slot: string): string => {
    const m = slot.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
    if (!m) return slot
    const [, y, mo, d, hh, mm] = m
    const disp = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d))
    const weekday = disp.toLocaleDateString('en-US', { weekday: 'long' })
    const monthName = disp.toLocaleDateString('en-US', { month: 'long' })
    const hour = parseInt(hh)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 || 12
    return `${weekday}, ${monthName} ${parseInt(d)} at ${hour12}:${mm} ${ampm}`
  }

  const { sendEmail, getProductionUrl, getEmailBrandFromOrgId } = await import('@/lib/email')
  const brand = getEmailBrandFromOrgId(reqRow.organization_id)
  const siteUrl = getProductionUrl(requestUrl)

  let subject: string
  let emailHtml: string

  if (action === 'accept_slot' && acceptedSlot) {
    const when = fmtSlot(acceptedSlot)
    subject = 'Your session has been rescheduled'
    emailHtml = `
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">Your session is confirmed for a new time</h2>
      <p style="margin: 0 0 16px; font-size: 14px; color: #e0e0e0;">Hi ${firstName}, ${coachName} has rescheduled your session to a time you said works:</p>
      <div style="margin: 0 0 24px; padding: 16px; background-color: rgba(59,130,246,0.12); border-left: 3px solid #3b82f6; border-radius: 4px;">
        <p style="margin: 0; font-size: 16px; color: #ffffff; font-weight: 700;">${when}</p>
        ${session?.location ? `<p style="margin: 8px 0 0; font-size: 14px; color: #e0e0e0;">📍 ${session.location}</p>` : ''}
      </div>
      <p style="margin: 0 0 16px; font-size: 13px; color: #9e9e9e;">See it anytime on your Training tab.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
        <tr><td align="center">
          <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">View My Training</a>
        </td></tr>
      </table>
    `
  } else {
    subject = 'About your session request'
    emailHtml = `
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">Let's find a time that works</h2>
      <p style="margin: 0 0 16px; font-size: 14px; color: #e0e0e0;">Hi ${firstName}, unfortunately none of the times you offered worked for ${coachName}, so that session has been cancelled for now.</p>
      <p style="margin: 0 0 24px; font-size: 14px; color: #e0e0e0;">Please reach out to ${coachName} directly so you can sort out a new time together.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
        <tr><td align="center">
          <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">Message My Coach</a>
        </td></tr>
      </table>
    `
  }

  sendEmail({ to: clientUser.email, subject, html: emailHtml, brand }).catch(console.error)
}

// Helper: notify assigned coaches of a new session request (email + push)
async function notifyCoachesOfRequest(
  adminClient: any,
  session: any,
  requestType: string,
  note: string | null,
  preferredSlots: string[],
  requestUrl: string,
  clientUserId: string
) {
  // Get the client's name
  const { data: clientUser } = await adminClient
    .from('users')
    .select('name')
    .eq('id', clientUserId)
    .single()
  const clientName = clientUser?.name?.split(' ')[0] || 'A client'

  // Find assigned coaches (fall back to session.coach_id)
  let coachIds: string[] = []
  const { data: assignments } = await adminClient
    .from('client_coaches')
    .select('coach_id')
    .eq('client_id', session.client_id)
  if (assignments && assignments.length > 0) {
    coachIds = assignments.map((a: any) => a.coach_id)
  } else if (session.coach_id) {
    coachIds = [session.coach_id]
  }

  if (coachIds.length === 0) return

  const { data: coachProfiles } = await adminClient
    .from('users')
    .select('id, email, name')
    .in('id', coachIds)

  // Format the session date/time
  const sessDate = session.scheduled_at
    ? new Date(session.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
      ' at ' + new Date(session.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'their session'

  const actionLabel = requestType === 'cancel' ? 'cancel' : 'reschedule'
  const subject = `${clientName} wants to ${actionLabel} a session`

  // Render a timezone-naive slot string ("YYYY-MM-DDTHH:mm:00") without TZ conversion.
  const fmtSlot = (slot: string): string => {
    const m = slot.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
    if (!m) return slot
    const [, y, mo, d, hh, mm] = m
    const disp = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d))
    const weekday = disp.toLocaleDateString('en-US', { weekday: 'short' })
    const monthName = disp.toLocaleDateString('en-US', { month: 'short' })
    const hour = parseInt(hh)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 || 12
    return `${weekday}, ${monthName} ${parseInt(d)} at ${hour12}:${mm} ${ampm}`
  }

  let preferredText = ''
  if (requestType === 'reschedule' && preferredSlots.length > 0) {
    if (preferredSlots.length === 1) {
      preferredText = `<p style="margin: 0 0 8px; font-size: 14px; color: #e0e0e0;">They're available: <strong>${fmtSlot(preferredSlots[0])}</strong></p>`
    } else {
      const items = preferredSlots.map(s => `<li style="margin: 0 0 4px;"><strong>${fmtSlot(s)}</strong></li>`).join('')
      preferredText = `<p style="margin: 0 0 4px; font-size: 14px; color: #e0e0e0;">Times they're available:</p><ul style="margin: 0 0 8px; padding-left: 20px; font-size: 14px; color: #e0e0e0;">${items}</ul>`
    }
  }

  const { sendEmail, getProductionUrl, getEmailBrandFromOrgId } = await import('@/lib/email')
  const brand = getEmailBrandFromOrgId(session.organization_id)
  const siteUrl = getProductionUrl(requestUrl)

  const emailHtml = `
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">${clientName} wants to ${actionLabel} a session</h2>
    <div style="margin: 0 0 24px; padding: 16px; background-color: rgba(242,101,34,0.1); border-left: 3px solid #f26522; border-radius: 4px;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #e0e0e0;">Session: <strong>${sessDate}</strong></p>
      ${preferredText}
      ${note ? `<p style="margin: 0; font-size: 14px; color: #e0e0e0;">Note: &ldquo;${note}&rdquo;</p>` : ''}
    </div>
    <p style="margin: 0 0 16px; font-size: 13px; color: #9e9e9e;">This is a request — the session hasn't changed. Review it and confirm on the client's Sessions tab.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
      <tr><td align="center">
        <a href="${siteUrl}/admin" style="display: inline-block; background-color: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">Review Request</a>
      </td></tr>
    </table>
  `

  for (const coach of coachProfiles || []) {
    // Coach notification email(s)
    const { data: prefs } = await adminClient
      .from('notification_preferences')
      .select('notification_emails')
      .eq('user_id', coach.id)
      .maybeSingle()
    let emails: string[] = []
    if (prefs?.notification_emails) {
      emails = prefs.notification_emails.split(',').map((e: string) => e.trim()).filter(Boolean)
    }
    if (emails.length === 0 && coach.email) emails = [coach.email]
    for (const email of emails) {
      sendEmail({ to: email, subject, html: emailHtml, brand }).catch(console.error)
    }
  }

  // Push notifications
  try {
    const { sendPushToUsers, getPushBrandFromOrgId } = await import('@/lib/push')
    const pushBrand = getPushBrandFromOrgId(session.organization_id)
    sendPushToUsers(adminClient, coachIds, {
      title: `${clientName} wants to ${actionLabel} a session`,
      body: `${sessDate}${note ? ' — ' + note : ''}`,
      icon: pushBrand.icon,
      url: '/admin',
      tag: `session-request-${session.id}`,
    }).catch(console.error)
  } catch (pushErr) {
    console.error('Push notification failed for session request:', pushErr)
  }
}
