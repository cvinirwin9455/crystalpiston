import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveCoachRequestScope } from '@/lib/coach-scope'
import { provisionClientFromApplication } from '@/lib/provision-client'

// Authenticated COACH-facing endpoints for managing applications that came in
// through their public /join/<slug> link.
//   GET   /api/coach-applications          -> list the coach's applications
//   PATCH /api/coach-applications          -> accept or decline an application
//
// Super-admin "view as coach" is honored: ?org=<id>&coach=<id> query params are
// resolved via resolveCoachRequestScope (which only allows overrides for super
// admins), so a super admin viewing a coach sees THAT coach's applications and
// link — not their own. All scoping uses the resolved coachId, never the raw
// logged-in user id.
//
// Accepting an application reuses the EXACT same invite machinery as
// POST /api/clients: generateLink (invite) + sendClientInviteEmail + create
// clients row + assign client_coaches.

async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET: list applications for the effective coach (self, or impersonated coach).
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const orgOverride = searchParams.get('org')
  const coachOverride = searchParams.get('coach')

  const admin = await createAdminClient()
  const scopeResult = await resolveCoachRequestScope(admin, user.id, orgOverride, coachOverride)
  if (!scopeResult.scope) {
    return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  }
  const { coachId } = scopeResult.scope

  // Fetch applications with their selected package info (if any)
  const { data: applications, error } = await admin
    .from('coach_applications')
    .select(`
      *,
      selected_package:coach_packages!selected_package_id (
        id,
        name,
        price_cents,
        billing_interval
      )
    `)
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Flatten the package info for easier frontend consumption
  const flatApplications = (applications || []).map((app: any) => ({
    ...app,
    selected_package_name: app.selected_package?.name || null,
    selected_package_price_cents: app.selected_package?.price_cents || null,
    selected_package_billing_interval: app.selected_package?.billing_interval || null,
  }))

  return NextResponse.json({ applications: flatApplications })
}

// PATCH: accept or decline an application.
//   body: { id, action: 'accept' | 'decline', org?, coach? }
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, action, org: orgOverride, coach: coachOverride } = body || {}
  if (!id || (action !== 'accept' && action !== 'decline')) {
    return NextResponse.json({ error: 'id and a valid action are required' }, { status: 400 })
  }

  const admin = await createAdminClient()

  // Resolve the effective coach (honors super-admin "view as coach").
  const scopeResult = await resolveCoachRequestScope(admin, user.id, orgOverride, coachOverride)
  if (!scopeResult.scope) {
    return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  }
  const { coachId, organizationId } = scopeResult.scope

  // The effective coach's display name (for the invite email branding).
  const { data: coachProfile } = await admin
    .from('users')
    .select('name')
    .eq('id', coachId)
    .single()
  const coachName = coachProfile?.name || 'Your coach'

  // Load the application and verify it belongs to the effective coach.
  const { data: application, error: loadErr } = await admin
    .from('coach_applications')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (loadErr || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }
  if (application.coach_id !== coachId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (application.status !== 'pending') {
    return NextResponse.json({ error: `This application was already ${application.status}.` }, { status: 409 })
  }

  // --- DECLINE: just archive, nothing sent to the applicant. ---
  if (action === 'decline') {
    await admin
      .from('coach_applications')
      .update({ status: 'declined', reviewed_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json({ success: true, status: 'declined' })
  }

  // --- ACCEPT: create (or link) the client account + assign this coach. ---
  // Uses the shared provisioning helper (same logic reused by payment-success).
  const result = await provisionClientFromApplication(admin, {
    application,
    coachId,
    organizationId,
    coachName,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Could not create the client account.' }, { status: 500 })
  }

  const name = String(application.full_name).trim()
  return NextResponse.json({
    success: true,
    status: 'accepted',
    dualRole: result.dualRole || false,
    message: result.dualRole
      ? `${name} already had an account and has been added as your client.`
      : `Invite email sent to ${application.email}. ${name} is now your client.`,
  })
}
