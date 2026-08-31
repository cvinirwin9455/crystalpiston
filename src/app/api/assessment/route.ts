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

// GET /api/assessment
//   (client, no params)  -> the logged-in client's own assessment
//   ?client_id=xxx       -> a coach viewing a client's assessment
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientIdParam = searchParams.get('client_id')

  const adminClient = await getAdminClient()

  let clientId = clientIdParam

  // If no client_id param, resolve the logged-in client's own record
  if (!clientId) {
    const { data: clientRow } = await adminClient
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!clientRow) return NextResponse.json({ assessment: null })
    clientId = clientRow.id
  }

  const { data: assessment, error } = await adminClient
    .from('client_assessments')
    .select('id, client_id, answers, consent_given, consent_at, status, completed_at, review_requested_at, updated_at')
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) {
    // Table may not exist yet
    return NextResponse.json({ assessment: null })
  }

  return NextResponse.json({ assessment: assessment || null })
}

// POST /api/assessment - Client saves/updates their own assessment
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { answers, consentGiven } = body

  const adminClient = await getAdminClient()

  // Resolve the logged-in client's record + org
  const { data: clientRow } = await adminClient
    .from('clients')
    .select('id, organization_id')
    .eq('user_id', user.id)
    .single()

  if (!clientRow) {
    return NextResponse.json({ error: 'Client record not found' }, { status: 404 })
  }

  const now = new Date().toISOString()

  // Check if an assessment already exists
  const { data: existing } = await adminClient
    .from('client_assessments')
    .select('id, consent_at')
    .eq('client_id', clientRow.id)
    .maybeSingle()

  const payload: any = {
    client_id: clientRow.id,
    organization_id: clientRow.organization_id || null,
    answers: answers || {},
    consent_given: !!consentGiven,
    status: 'completed',
    completed_at: now,
    // Completing/updating clears any pending review request
    review_requested_at: null,
  }
  // Set consent_at on first consent
  if (consentGiven && !existing?.consent_at) {
    payload.consent_at = now
  }

  if (existing) {
    const { error } = await adminClient
      .from('client_assessments')
      .update(payload)
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await adminClient
      .from('client_assessments')
      .insert(payload)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// PATCH /api/assessment - Coach requests the client review/update their assessment
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
  const { clientId, action } = body

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()
  const now = new Date().toISOString()

  if (action === 'request_review') {
    // Get client org for the row (in case we need to create it)
    const { data: clientRow } = await adminClient
      .from('clients')
      .select('id, organization_id, user_id')
      .eq('id', clientId)
      .single()
    if (!clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    // Upsert: mark review_requested (create a not_started row if none exists)
    const { data: existing } = await adminClient
      .from('client_assessments')
      .select('id, status')
      .eq('client_id', clientId)
      .maybeSingle()

    if (existing) {
      await adminClient
        .from('client_assessments')
        .update({ status: 'review_requested', review_requested_at: now })
        .eq('id', existing.id)
    } else {
      await adminClient
        .from('client_assessments')
        .insert({
          client_id: clientId,
          organization_id: clientRow.organization_id || null,
          status: 'review_requested',
          review_requested_at: now,
        })
    }

    // Notify the client (email + push) — fire and forget
    try {
      await notifyClientReviewRequest(adminClient, clientRow, request.url, user.id)
    } catch (err) {
      console.error('Failed to notify client of assessment review request:', err)
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// Helper: notify client that their coach requested an assessment review
async function notifyClientReviewRequest(adminClient: any, clientRow: any, requestUrl: string, coachUserId: string) {
  const { data: clientUser } = await adminClient
    .from('users')
    .select('email, name')
    .eq('id', clientRow.user_id)
    .single()

  const { data: coach } = await adminClient
    .from('users')
    .select('name, organization_id')
    .eq('id', coachUserId)
    .single()
  const coachName = coach?.name?.split(' ')[0] || 'Your coach'

  const { sendEmail, getProductionUrl, getEmailBrandFromOrgId } = await import('@/lib/email')
  const brand = getEmailBrandFromOrgId(clientRow.organization_id || coach?.organization_id)
  const siteUrl = getProductionUrl(requestUrl)

  if (clientUser?.email) {
    const emailHtml = `
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">Please review your assessment</h2>
      <p style="margin: 0 0 16px; font-size: 14px; color: #e0e0e0; line-height: 1.5;">${coachName} has asked you to review and update your health assessment before your new plan. It only takes a couple of minutes — you can confirm it's still accurate or update anything that's changed.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr><td align="center">
          <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">Review Assessment</a>
        </td></tr>
      </table>
    `
    sendEmail({ to: clientUser.email, subject: 'Please review your health assessment', html: emailHtml, brand }).catch(console.error)
  }

  try {
    const { sendPushToUser, getPushBrandFromOrgId } = await import('@/lib/push')
    const pushBrand = getPushBrandFromOrgId(clientRow.organization_id || coach?.organization_id)
    sendPushToUser(adminClient, clientRow.user_id, {
      title: 'Please review your assessment',
      body: `${coachName} asked you to review your health assessment.`,
      icon: pushBrand.icon,
      url: '/dashboard',
      tag: `assessment-review-${clientRow.id}`,
    }).catch(console.error)
  } catch (err) {
    console.error('Push failed for assessment review:', err)
  }
}
