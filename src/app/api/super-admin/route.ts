import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendCoachInviteEmail, getBrandFromDomain } from '@/lib/invite-emails'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/super-admin - Get overview data for super admin
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await getAdminClient()

  // Verify super admin
  const { data: profile } = await adminClient
    .from('users')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
  }

  // Get organizations
  const { data: orgs } = await adminClient
    .from('organizations')
    .select('id, name, slug, domain')
    .order('created_at', { ascending: true })

  // Get user counts per org
  const { data: users } = await adminClient
    .from('users')
    .select('id, organization_id, role, status, coach_level')

  const orgStats = (orgs || []).map(org => {
    const orgUsers = (users || []).filter(u => u.organization_id === org.id)
    const accountCoach = orgUsers.find(u => u.role === 'admin' && u.coach_level === 'account_coach')
    return {
      ...org,
      totalUsers: orgUsers.length,
      admins: orgUsers.filter(u => u.role === 'admin').length,
      clients: orgUsers.filter(u => u.role === 'client').length,
      activeClients: orgUsers.filter(u => u.role === 'client' && u.status !== 'inactive').length,
      accountCoachId: accountCoach?.id || null,
    }
  })

  // Get beta signups
  const { data: betaSignups } = await adminClient
    .from('beta_signups')
    .select('*')
    .order('created_at', { ascending: false })

  // Check activation status for each beta signup (does a user with that email exist?)
  const betaEmails = (betaSignups || []).map(s => s.email)
  const { data: activatedUsers } = await adminClient
    .from('users')
    .select('id, email, role, created_at')
    .in('email', betaEmails.length > 0 ? betaEmails : ['__none__'])

  // Also check Supabase auth for last_sign_in_at (indicates password has been set)
  const activatedUserIds = (activatedUsers || []).map(u => u.id)
  const authUserMap = new Map<string, { lastSignIn: string | null }>()
  for (const userId of activatedUserIds) {
    try {
      const { data: authUser } = await adminClient.auth.admin.getUserById(userId)
      if (authUser?.user) {
        authUserMap.set(userId, { lastSignIn: authUser.user.last_sign_in_at || null })
      }
    } catch {}
  }

  const activatedEmailMap = new Map(
    (activatedUsers || []).map(u => [u.email, {
      userId: u.id,
      role: u.role,
      activatedAt: u.created_at,
      hasSetPassword: !!authUserMap.get(u.id)?.lastSignIn,
    }])
  )

  const betaSignupsWithStatus = (betaSignups || []).map(signup => ({
    ...signup,
    activated: activatedEmailMap.has(signup.email),
    activatedUserId: activatedEmailMap.get(signup.email)?.userId || null,
    activatedAt: activatedEmailMap.get(signup.email)?.activatedAt || null,
    hasSetPassword: activatedEmailMap.get(signup.email)?.hasSetPassword || false,
  }))

  return NextResponse.json({
    organizations: orgStats,
    betaSignups: betaSignupsWithStatus,
  })
}

// POST /api/super-admin - Activate a beta signup as a coach
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await getAdminClient()

  // Verify super admin
  const { data: profile } = await adminClient
    .from('users')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
  }

  const body = await request.json()
  const { action, signupId, organizationId, password } = body

  if (action === 'activate_coach') {
    if (!signupId) {
      return NextResponse.json({ error: 'signupId is required' }, { status: 400 })
    }

    // Get the signup record
    const { data: signup } = await adminClient
      .from('beta_signups')
      .select('*')
      .eq('id', signupId)
      .single()

    if (!signup) {
      return NextResponse.json({ error: 'Signup not found' }, { status: 404 })
    }

    // Check if user already exists
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id')
      .eq('email', signup.email)
      .single()

    if (existingUser) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
    }

    // Create a NEW organization for this coach (each beta coach is their own isolated account)
    const coachSlug = signup.full_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const { data: newOrg, error: orgError } = await adminClient
      .from('organizations')
      .insert({
        name: `${signup.full_name}`,
        slug: `fmc-${coachSlug}-${Date.now().toString(36)}`,
        domain: 'firstmilecoach.com',
      })
      .select()
      .single()

    if (orgError) {
      return NextResponse.json({ error: `Failed to create organization: ${orgError.message}` }, { status: 500 })
    }

    const newOrgId = newOrg.id

    // Update the beta_signups record with the new org ID
    await adminClient
      .from('beta_signups')
      .update({ organization_id: newOrgId })
      .eq('id', signupId)

    // Use firstmilecoach.com for the redirect
    const domain = 'www.firstmilecoach.com'
    const redirectUrl = `https://${domain}/auth/callback?next=/set-password`

    // Generate the invite link without sending Supabase's built-in email
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: signup.email,
      options: {
        data: {
          name: signup.full_name,
          role: 'admin',
        },
        redirectTo: redirectUrl,
      },
    })

    if (linkError) {
      return NextResponse.json({ error: `Failed to generate invite link: ${linkError.message}` }, { status: 500 })
    }

    const newUserId = linkData.user.id

    // Build the confirmation URL using hashed_token pointing to our app's auth callback
    const hashedToken = linkData.properties.hashed_token
    const confirmationUrl = `https://${domain}/auth/callback?token_hash=${hashedToken}&type=invite&next=/set-password`

    // Send our custom coach invite email via Resend
    const emailSent = await sendCoachInviteEmail({
      to: signup.email,
      coachName: signup.full_name,
      confirmationUrl,
      brand: 'first-mile',
    })

    if (!emailSent) {
      console.error(`Failed to send custom invite email to ${signup.email}, but user was created`)
    }

    // Update the users row with the NEW org, role, and coach settings
    await adminClient
      .from('users')
      .update({
        role: 'admin',
        name: signup.full_name,
        organization_id: newOrgId,
        coach_level: 'account_coach',
        access_level: 'all_clients',
      })
      .eq('id', newUserId)

    return NextResponse.json({
      success: true,
      userId: newUserId,
      message: `Organization "${signup.full_name}" created. Invite email sent to ${signup.email}.`,
    })
  }

  if (action === 'resend_invite') {
    const { signupId: resendSignupId } = body
    if (!resendSignupId) {
      return NextResponse.json({ error: 'signupId is required' }, { status: 400 })
    }

    // Get the signup record
    const { data: signup } = await adminClient
      .from('beta_signups')
      .select('*')
      .eq('id', resendSignupId)
      .single()

    if (!signup) {
      return NextResponse.json({ error: 'Signup not found' }, { status: 404 })
    }

    // Check if user exists (must have been activated already)
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id')
      .eq('email', signup.email)
      .single()

    if (!existingUser) {
      return NextResponse.json({ error: 'This user has not been activated yet. Use Activate Coach instead.' }, { status: 400 })
    }

    // Delete the existing user and re-create to generate a fresh invite token
    await adminClient.auth.admin.deleteUser(existingUser.id)

    // Get the org for domain
    const { data: org } = await adminClient
      .from('organizations')
      .select('domain')
      .eq('id', signup.organization_id)
      .single()

    let domain = org?.domain || 'www.firstmilecoach.com'
    if (domain === 'firstmilecoach.com') domain = 'www.firstmilecoach.com'
    if (domain === 'crystalpistolperformance.com') domain = 'www.crystalpistolperformance.com'
    const redirectUrl = `https://${domain}/auth/callback?next=/set-password`

    // Generate a fresh invite link
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: signup.email,
      options: {
        data: {
          name: signup.full_name,
          role: 'admin',
        },
        redirectTo: redirectUrl,
      },
    })

    if (linkError) {
      return NextResponse.json({ error: `Failed to generate invite link: ${linkError.message}` }, { status: 500 })
    }

    const newUserId = linkData.user.id
    const hashedToken = linkData.properties.hashed_token
    const confirmationUrl = `https://${domain}/auth/callback?token_hash=${hashedToken}&type=invite&next=/set-password`

    // Send the invite email
    await sendCoachInviteEmail({
      to: signup.email,
      coachName: signup.full_name,
      confirmationUrl,
      brand: getBrandFromDomain(org?.domain),
    })

    // Update the new users row with org, role, and coach settings
    await adminClient
      .from('users')
      .update({
        role: 'admin',
        name: signup.full_name,
        organization_id: signup.organization_id,
        coach_level: 'account_coach',
        access_level: 'all_clients',
      })
      .eq('id', newUserId)

    return NextResponse.json({
      success: true,
      message: `Invite resent to ${signup.full_name} (${signup.email}).`,
    })
  }

  if (action === 'delete_account') {
    const { signupId: deleteSignupId, deleteUserToo } = body
    if (!deleteSignupId) {
      return NextResponse.json({ error: 'signupId is required' }, { status: 400 })
    }

    // Get the signup record
    const { data: signup } = await adminClient
      .from('beta_signups')
      .select('*')
      .eq('id', deleteSignupId)
      .single()

    if (!signup) {
      return NextResponse.json({ error: 'Signup not found' }, { status: 404 })
    }

    // If the user was activated, delete their auth account and users row
    if (deleteUserToo !== false) {
      const { data: existingUser } = await adminClient
        .from('users')
        .select('id')
        .eq('email', signup.email)
        .single()

      if (existingUser) {
        // Delete from clients table if they have any client records
        await adminClient.from('clients').delete().eq('user_id', existingUser.id)
        // Delete from client_coaches
        await adminClient.from('client_coaches').delete().eq('coach_id', existingUser.id)
        // Delete templates belonging to this coach's org
        if (signup.organization_id) {
          await adminClient.from('templates').delete().eq('organization_id', signup.organization_id)
        }
        // Delete from users table
        await adminClient.from('users').delete().eq('id', existingUser.id)
        // Delete from Supabase Auth
        await adminClient.auth.admin.deleteUser(existingUser.id)
        // Delete the coach's organization
        if (signup.organization_id) {
          await adminClient.from('organizations').delete().eq('id', signup.organization_id)
        }
      }
    }

    // Delete the beta signup record
    await adminClient
      .from('beta_signups')
      .delete()
      .eq('id', deleteSignupId)

    return NextResponse.json({
      success: true,
      message: `${signup.full_name} (${signup.email}) has been completely deleted.`,
    })
  }

  if (action === 'impersonate') {
    const { userId: targetUserId } = body
    if (!targetUserId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Generate a magic link for the target user (allows super admin to sign in as them)
    const { data: targetUser } = await adminClient
      .from('users')
      .select('email')
      .eq('id', targetUserId)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Generate a magic link that signs in as the target user
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email,
      options: {
        redirectTo: 'https://www.firstmilecoach.com/admin',
      },
    })

    if (linkError) {
      return NextResponse.json({ error: `Failed to generate link: ${linkError.message}` }, { status: 500 })
    }

    // Build the URL pointing to our auth callback
    const hashedToken = linkData.properties.hashed_token
    const impersonateUrl = `https://www.firstmilecoach.com/auth/callback?token_hash=${hashedToken}&type=magiclink&next=/admin`

    return NextResponse.json({
      success: true,
      url: impersonateUrl,
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
