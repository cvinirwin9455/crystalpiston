import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendClientInviteEmail, getBrandFromDomain } from '@/lib/invite-emails'
import { hasCoachAccess } from '@/lib/roles'

// Authenticated COACH-facing endpoints for managing applications that came in
// through their public /join/<slug> link.
//   GET   /api/coach-applications          -> list the coach's applications
//   PATCH /api/coach-applications          -> accept or decline an application
//
// Accepting an application reuses the EXACT same invite machinery as
// POST /api/clients: generateLink (invite) + sendClientInviteEmail + create
// clients row + assign client_coaches. This keeps the two paths identical so
// an accepted applicant is indistinguishable from a manually-invited client.

async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET: list applications for the authenticated coach.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, has_coach_access, is_super_admin')
    .eq('id', user.id)
    .single()

  if (!hasCoachAccess(profile) && !profile?.is_super_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = await createAdminClient()
  const { data: applications, error } = await admin
    .from('coach_applications')
    .select('*')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ applications: applications || [] })
}

// PATCH: accept or decline an application.
//   body: { id: string, action: 'accept' | 'decline' }
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('name, role, has_coach_access, is_super_admin, organization_id')
    .eq('id', user.id)
    .single()

  if (!hasCoachAccess(profile) && !profile?.is_super_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { id, action } = body || {}
  if (!id || (action !== 'accept' && action !== 'decline')) {
    return NextResponse.json({ error: 'id and a valid action are required' }, { status: 400 })
  }

  const admin = await createAdminClient()

  // Load the application and verify it belongs to this coach.
  const { data: application, error: loadErr } = await admin
    .from('coach_applications')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (loadErr || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }
  if (application.coach_id !== user.id) {
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
  const email = String(application.email).trim().toLowerCase()
  const name = String(application.full_name).trim()
  const coachId = user.id
  const orgId = profile?.organization_id || application.organization_id || null

  // Dual-role: if the email already has an account, don't re-invite — add a
  // client record (if missing) and assign this coach. (Mirrors /api/clients.)
  const { data: existingUser } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingUser) {
    const { data: existingClient } = await admin
      .from('clients')
      .select('id')
      .eq('user_id', existingUser.id)
      .maybeSingle()

    let clientId = existingClient?.id
    if (!clientId) {
      const { data: created, error: createErr } = await admin
        .from('clients')
        .insert({
          user_id: existingUser.id,
          goal: application.primary_goal || null,
          owed: 0,
          paid: 0,
        })
        .select('id')
        .single()
      if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
      clientId = created.id
    }

    try {
      const { data: existingAssignments } = await admin
        .from('client_coaches')
        .select('id')
        .eq('client_id', clientId)
      await admin
        .from('client_coaches')
        .upsert(
          { client_id: clientId, coach_id: coachId, is_default: !existingAssignments || existingAssignments.length === 0 },
          { onConflict: 'client_id,coach_id' }
        )
    } catch (err) {
      console.error('Failed to assign coach to existing user:', err)
    }

    await admin
      .from('coach_applications')
      .update({ status: 'accepted', reviewed_at: new Date().toISOString(), accepted_user_id: existingUser.id })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      status: 'accepted',
      dualRole: true,
      message: `${name} already had an account and has been added as your client.`,
    })
  }

  // New user: generate invite link (no built-in email) + send branded email.
  const redirectDomain = 'www.firstmilecoach.com'
  const orgDomain = 'firstmilecoach.com'
  const coachName = profile?.name || 'Your coach'

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: { name, role: 'client' },
      redirectTo: `https://${redirectDomain}/auth/callback?next=/set-password`,
    },
  })

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 })
  }

  const newUserId = linkData.user.id
  const hashedToken = linkData.properties.hashed_token
  const confirmationUrl = `https://${redirectDomain}/auth/callback?token_hash=${hashedToken}&type=invite&next=/set-password`

  const emailSent = await sendClientInviteEmail({
    to: email,
    clientName: name,
    coachName,
    confirmationUrl,
    brand: getBrandFromDomain(orgDomain),
  })
  if (!emailSent) {
    console.error(`Failed to send invite email to ${email}, but user was created`)
  }

  // Set gender/org on the auto-created users row.
  const userUpdates: Record<string, any> = {}
  if (application.sex) userUpdates.gender = application.sex
  if (orgId) userUpdates.organization_id = orgId
  if (Object.keys(userUpdates).length > 0) {
    await admin.from('users').update(userUpdates).eq('id', newUserId)
  }

  // Create the clients row.
  const { data: newClientRecord, error: clientError } = await admin
    .from('clients')
    .insert({
      user_id: newUserId,
      goal: application.primary_goal || null,
      owed: 0,
      paid: 0,
    })
    .select('id')
    .single()

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 })
  }

  // Assign this coach as default coach.
  if (newClientRecord) {
    try {
      await admin
        .from('client_coaches')
        .insert({ client_id: newClientRecord.id, coach_id: coachId, is_default: true })
    } catch (err) {
      console.error('Failed to assign coach to new client:', err)
    }
  }

  await admin
    .from('coach_applications')
    .update({ status: 'accepted', reviewed_at: new Date().toISOString(), accepted_user_id: newUserId })
    .eq('id', id)

  return NextResponse.json({
    success: true,
    status: 'accepted',
    message: `Invite email sent to ${email}. ${name} is now your client.`,
  })
}
