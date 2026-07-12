import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOrgIdForUser } from '@/lib/org'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/coaches/invite - Invite a new coach (creates admin user)
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, coach_level')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only account coaches can invite new coaches
  if (profile?.coach_level === 'coach') {
    return NextResponse.json({ error: 'Only Account Coaches can invite new coaches.' }, { status: 403 })
  }

  const body = await request.json()
  const { name, email, accessLevel, coachLevel } = body

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Check if this email already exists
  const { data: existingUser } = await adminClient
    .from('users')
    .select('id, role')
    .eq('email', email)
    .single()

  if (existingUser) {
    if (existingUser.role === 'admin') {
      return NextResponse.json({ error: 'This email is already a coach/admin in the system.' }, { status: 400 })
    } else {
      return NextResponse.json({ error: 'This email belongs to an existing client. A user cannot be both a client and a coach.' }, { status: 400 })
    }
  }

  // Determine the correct redirect URL based on the inviting coach's organization
  const orgId = await getOrgIdForUser(adminClient, user.id)
  let redirectDomain = 'www.crystalpistolperformance.com'
  if (orgId) {
    const { data: orgData } = await adminClient
      .from('organizations')
      .select('domain')
      .eq('id', orgId)
      .single()
    if (orgData?.domain) {
      let domain = orgData.domain
      if (domain === 'firstmilecoach.com') domain = 'www.firstmilecoach.com'
      if (domain === 'crystalpistolperformance.com') domain = 'www.crystalpistolperformance.com'
      redirectDomain = domain
    }
  }

  // Invite the user via Supabase Auth
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      name,
      role: 'admin',
    },
    redirectTo: `https://${redirectDomain}/auth/callback?next=/set-password`,
  })

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  const newUserId = inviteData.user.id

  // Update the auto-created users row to set role to admin, name, and org
  const userUpdate: Record<string, any> = { role: 'admin', name }
  if (orgId) userUpdate.organization_id = orgId
  await adminClient
    .from('users')
    .update(userUpdate)
    .eq('id', newUserId)

  // Try to set access_level (column may not exist yet)
  if (accessLevel && accessLevel !== 'all_clients') {
    try {
      await adminClient
        .from('users')
        .update({ access_level: accessLevel })
        .eq('id', newUserId)
    } catch {}
  }

  // Try to set coach_level (column may not exist yet)
  if (coachLevel) {
    try {
      await adminClient
        .from('users')
        .update({ coach_level: coachLevel })
        .eq('id', newUserId)
    } catch {}
  }

  return NextResponse.json({
    success: true,
    userId: newUserId,
    message: `Coach invite sent to ${email}`,
  })
}

// PATCH /api/coaches/invite - Edit an existing coach's details
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, coach_level')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only account coaches can edit other coaches
  if (profile?.coach_level === 'coach') {
    return NextResponse.json({ error: 'Only Account Coaches can manage coaches.' }, { status: 403 })
  }

  const body = await request.json()
  const { coachId, name, email, accessLevel, coachLevel } = body

  if (!coachId) {
    return NextResponse.json({ error: 'coachId is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  const updates: Record<string, any> = {}
  if (name) updates.name = name
  if (email) updates.email = email

  if (Object.keys(updates).length === 0 && !accessLevel && !coachLevel) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await adminClient
      .from('users')
      .update(updates)
      .eq('id', coachId)
      .eq('role', 'admin')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Try to update access_level separately (column may not exist yet)
  if (accessLevel) {
    try {
      await adminClient
        .from('users')
        .update({ access_level: accessLevel })
        .eq('id', coachId)
    } catch {}
  }

  // Try to update coach_level separately (column may not exist yet)
  if (coachLevel) {
    try {
      await adminClient
        .from('users')
        .update({ coach_level: coachLevel })
        .eq('id', coachId)
    } catch {}
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/coaches/invite - Remove a coach (downgrade to inactive, remove from all client assignments)
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, coach_level')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only account coaches can remove other coaches
  if (profile?.coach_level === 'coach') {
    return NextResponse.json({ error: 'Only Account Coaches can remove coaches.' }, { status: 403 })
  }

  const body = await request.json()
  const { coachId } = body

  if (!coachId) {
    return NextResponse.json({ error: 'coachId is required' }, { status: 400 })
  }

  // Cannot remove yourself
  if (coachId === user.id) {
    return NextResponse.json({ error: 'You cannot remove yourself.' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Check this is actually an admin
  const { data: coachProfile } = await adminClient
    .from('users')
    .select('role, name')
    .eq('id', coachId)
    .single()

  if (!coachProfile || coachProfile.role !== 'admin') {
    return NextResponse.json({ error: 'User is not a coach/admin.' }, { status: 400 })
  }

  // Get all client_coaches assignments for this coach
  const { data: assignments } = await adminClient
    .from('client_coaches')
    .select('id, client_id, is_default')
    .eq('coach_id', coachId)

  // For each assignment where this coach was default, promote another coach
  for (const assignment of assignments || []) {
    if (assignment.is_default) {
      // Find another coach for this client
      const { data: otherCoaches } = await adminClient
        .from('client_coaches')
        .select('id, coach_id')
        .eq('client_id', assignment.client_id)
        .neq('coach_id', coachId)
        .limit(1)

      if (otherCoaches && otherCoaches.length > 0) {
        await adminClient
          .from('client_coaches')
          .update({ is_default: true })
          .eq('id', otherCoaches[0].id)
      }
    }
  }

  // Remove all coach assignments
  await adminClient
    .from('client_coaches')
    .delete()
    .eq('coach_id', coachId)

  // Downgrade the user role to 'inactive_coach' (keeps the data but removes admin access)
  await adminClient
    .from('users')
    .update({ role: 'inactive_coach' })
    .eq('id', coachId)

  return NextResponse.json({ success: true, message: `${coachProfile.name || 'Coach'} has been removed.` })
}
