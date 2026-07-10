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

  // Get user counts per org
  const { data: users } = await adminClient
    .from('users')
    .select('id, organization_id, role, status')

  const orgStats = (orgs || []).map(org => {
    const orgUsers = (users || []).filter(u => u.organization_id === org.id)
    return {
      ...org,
      totalUsers: orgUsers.length,
      admins: orgUsers.filter(u => u.role === 'admin').length,
      clients: orgUsers.filter(u => u.role === 'client').length,
      activeClients: orgUsers.filter(u => u.role === 'client' && u.status !== 'inactive').length,
    }
  })

  // Get beta signups
  const { data: betaSignups } = await adminClient
    .from('beta_signups')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json({
    organizations: orgStats,
    betaSignups: betaSignups || [],
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
    if (!signupId || !organizationId || !password) {
      return NextResponse.json({ error: 'signupId, organizationId, and password are required' }, { status: 400 })
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

    // Create the auth user with a password
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: signup.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: signup.full_name,
        role: 'admin',
      },
    })

    if (createError) {
      return NextResponse.json({ error: `Failed to create user: ${createError.message}` }, { status: 500 })
    }

    const newUserId = newUser.user.id

    // Update the users row
    await adminClient
      .from('users')
      .update({
        role: 'admin',
        name: signup.full_name,
        organization_id: organizationId,
        coach_level: 'account_coach',
        access_level: 'all_clients',
      })
      .eq('id', newUserId)

    return NextResponse.json({
      success: true,
      userId: newUserId,
      message: `Coach account created for ${signup.full_name} (${signup.email})`,
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
