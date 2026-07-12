import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOrgIdForUser } from '@/lib/org'
import { sendClientInviteEmail, getBrandFromDomain } from '@/lib/invite-emails'

// Helper: create admin client with service role key
async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/clients - List all clients
export async function GET() {
  const supabase = await createClient()

  // Verify the requesting user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, access_level, coach_level')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // If coach_level is 'coach', always restrict to own clients regardless of access_level
  const accessLevel = profile?.coach_level === 'coach' ? 'own_clients' : (profile?.access_level || 'all_clients')

  const adminClient = await createAdminClient()

  // Get org scope for this user
  const orgId = await getOrgIdForUser(adminClient, user.id)

  // Query users and clients separately to avoid join issues
  let clientQuery = adminClient
    .from('users')
    .select('id, email, name, gender, status, avatar_url, created_at')
    .eq('role', 'client')
    .order('name')

  // Scope to organization if the user belongs to one
  if (orgId) {
    clientQuery = clientQuery.eq('organization_id', orgId)
  }

  const { data: clientUsers, error: usersError } = await clientQuery

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 })
  }

  // Fetch auth user data to determine invite status
  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const authUserMap = new Map<string, any>()
  for (const au of authUsers || []) {
    authUserMap.set(au.id, au)
  }

  const { data: clientRecords } = await adminClient
    .from('clients')
    .select('id, user_id, goal, start_date, plan_end, owed, paid')

  // Try to fetch training profile fields (columns may not exist yet)
  let trainingProfiles: any[] = []
  try {
    const { data } = await adminClient
      .from('clients')
      .select('id, birthday')
    trainingProfiles = data || []
  } catch {}

  const trainingProfileMap = new Map<string, any>()
  for (const tp of trainingProfiles) {
    trainingProfileMap.set(tp.id, tp)
  }

  // Build a lookup map: user_id -> client record
  const clientMap = new Map<string, any>()
  for (const cr of clientRecords || []) {
    clientMap.set(cr.user_id, cr)
  }

  // Fetch active plans to get goals and plan-level financials
  const { data: activePlans } = await adminClient
    .from('plans')
    .select('client_id, goal, owed, paid, start_date, end_date')
    .eq('status', 'active')

  const activePlanByClientId = new Map<string, any>()
  for (const plan of activePlans || []) {
    activePlanByClientId.set(plan.client_id, plan)
  }

  // Fetch Strava connections for profile pictures
  const { data: stravaConnections } = await adminClient
    .from('strava_connections')
    .select('user_id, athlete_profile')

  const stravaProfileByUserId = new Map<string, string>()
  const stravaConnectedUserIds = new Set<string>()
  for (const sc of stravaConnections || []) {
    stravaConnectedUserIds.add(sc.user_id)
    if (sc.athlete_profile) {
      // Ensure HTTPS — Strava sometimes returns HTTP URLs which get blocked as mixed content
      const profileUrl = sc.athlete_profile.replace(/^http:\/\//i, 'https://')
      stravaProfileByUserId.set(sc.user_id, profileUrl)
    }
  }

  // Fetch all coach assignments for all clients
  let coachAssignments: any[] = []
  try {
    const { data } = await adminClient
      .from('client_coaches')
      .select('client_id, coach_id, is_default')
    coachAssignments = data || []
  } catch {}

  // Build a lookup map: client_id -> coaches array
  const coachesByClientId = new Map<string, { coachId: string; isDefault: boolean }[]>()
  for (const ca of coachAssignments) {
    if (!coachesByClientId.has(ca.client_id)) {
      coachesByClientId.set(ca.client_id, [])
    }
    coachesByClientId.get(ca.client_id)!.push({ coachId: ca.coach_id, isDefault: ca.is_default })
  }

  // Get coach names for display
  const allCoachIds = [...new Set(coachAssignments.map(ca => ca.coach_id))]
  const coachNameMap = new Map<string, string>()
  if (allCoachIds.length > 0) {
    const { data: coachUsers } = await adminClient
      .from('users')
      .select('id, name, email')
      .in('id', allCoachIds)
    for (const cu of coachUsers || []) {
      coachNameMap.set(cu.id, cu.name || cu.email || 'Unknown')
    }
  }

  // If this coach has "own_clients" access, only show clients they are assigned to
  let allowedUserIds: Set<string> | null = null
  if (accessLevel === 'own_clients') {
    // Find all client_ids this coach is assigned to
    const myClientIds = new Set(
      coachAssignments
        .filter(ca => ca.coach_id === user.id)
        .map(ca => ca.client_id)
    )
    // Map client_ids back to user_ids
    allowedUserIds = new Set<string>()
    for (const cr of clientRecords || []) {
      if (myClientIds.has(cr.id)) {
        allowedUserIds.add(cr.user_id)
      }
    }
  }

  // Build response, auto-create missing client records
  const formatted = []
  for (const u of clientUsers || []) {
    // Skip clients this coach is not assigned to (if own_clients access)
    if (allowedUserIds && !allowedUserIds.has(u.id)) continue
    let clientRecord = clientMap.get(u.id) || null

    if (!clientRecord) {
      const { data: newClient } = await adminClient
        .from('clients')
        .insert({ user_id: u.id })
        .select('id, user_id, goal, start_date, plan_end, owed, paid')
        .single()
      if (newClient) clientRecord = newClient
    }

    const activePlan = clientRecord ? activePlanByClientId.get(clientRecord.id) : null

    // Use active plan financials if available, otherwise fall back to legacy clients table
    const owed = activePlan ? (parseFloat(activePlan.owed) || 0) : 0
    const paid = activePlan ? (parseFloat(activePlan.paid) || 0) : 0

    // Determine invite status from auth user data
    const authUser = authUserMap.get(u.id)
    let inviteStatus: 'accepted' | 'pending' | 'expired' = 'accepted'
    if (authUser) {
      // User has truly accepted if they have actually signed in (set their password and logged in)
      if (authUser.last_sign_in_at && authUser.last_sign_in_at !== authUser.created_at) {
        inviteStatus = 'accepted'
      } else {
        // Check if invite was sent more than 7 days ago (Supabase default expiry)
        const invitedAt = new Date(authUser.invited_at || authUser.created_at)
        const daysSinceInvite = (Date.now() - invitedAt.getTime()) / (1000 * 60 * 60 * 24)
        inviteStatus = daysSinceInvite > 7 ? 'expired' : 'pending'
      }
    }

    // Get coaches for this client
    const clientCoaches = clientRecord ? (coachesByClientId.get(clientRecord.id) || []) : []
    const coaches = clientCoaches.map(cc => ({
      coachId: cc.coachId,
      coachName: coachNameMap.get(cc.coachId) || 'Unknown',
      isDefault: cc.isDefault,
    }))

    formatted.push({
      userId: u.id,
      clientId: clientRecord?.id || null,
      name: u.name,
      email: u.email,
      gender: u.gender,
      status: u.status,
      avatarUrl: u.avatar_url,
      stravaProfileUrl: stravaProfileByUserId.get(u.id) || null,
      stravaConnected: stravaConnectedUserIds.has(u.id),
      goal: activePlan?.goal || clientRecord?.goal || '',
      startDate: activePlan?.start_date || clientRecord?.start_date || '',
      planEnd: activePlan?.end_date || clientRecord?.plan_end || '',
      owed,
      paid,
      inviteStatus,
      createdAt: u.created_at,
      birthday: trainingProfileMap.get(clientRecord?.id)?.birthday || null,
      coaches,
    })
  }

  return NextResponse.json(formatted, {
    headers: { 'X-Access-Level': accessLevel },
  })
}

// POST /api/clients - Create a new client (invite via email)
export async function POST(request: Request) {
  const supabase = await createClient()

  // Verify the requesting user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { name, email, gender, goal, startDate, planEnd, owed, birthday } = body

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  const adminClient = await createAdminClient()

  // Get org scope for this coach
  const orgId = await getOrgIdForUser(adminClient, user.id)

  // Get the coach's name for the email
  const { data: coachProfile } = await adminClient
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single()
  const coachName = coachProfile?.name || 'Your coach'

  // Determine the correct redirect URL based on the coach's organization
  let redirectDomain = 'www.firstmilecoach.com'
  let orgDomain: string | null = null
  if (orgId) {
    const { data: orgData } = await adminClient
      .from('organizations')
      .select('domain')
      .eq('id', orgId)
      .single()
    if (orgData?.domain) {
      orgDomain = orgData.domain
      let domain = orgData.domain
      if (domain === 'firstmilecoach.com') domain = 'www.firstmilecoach.com'
      if (domain === 'crystalpistolperformance.com') domain = 'www.crystalpistolperformance.com'
      redirectDomain = domain
    }
  }

  // Generate the invite link without sending Supabase's built-in email
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: {
        name,
        role: 'client',
      },
      redirectTo: `https://${redirectDomain}/auth/callback?next=/set-password`,
    },
  })

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 })
  }

  const newUserId = linkData.user.id
  const confirmationUrl = linkData.properties.action_link

  // Send our custom client invite email via Resend
  const emailSent = await sendClientInviteEmail({
    to: email,
    clientName: name,
    coachName,
    confirmationUrl,
    brand: getBrandFromDomain(orgDomain),
  })

  if (!emailSent) {
    console.error(`Failed to send custom invite email to ${email}, but user was created`)
  }

  // Update gender on the auto-created users row and set organization_id
  const userUpdates: Record<string, any> = {}
  if (gender) userUpdates.gender = gender
  if (orgId) userUpdates.organization_id = orgId
  if (Object.keys(userUpdates).length > 0) {
    await adminClient
      .from('users')
      .update(userUpdates)
      .eq('id', newUserId)
  }

  // Create the clients record (no owed/paid - those live on plans now)
  const { data: newClientRecord, error: clientError } = await adminClient
    .from('clients')
    .insert({
      user_id: newUserId,
      goal: goal || null,
      start_date: startDate || null,
      plan_end: planEnd || null,
      owed: 0,
      paid: 0,
    })
    .select('id')
    .single()

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 })
  }

  // Try to update training profile fields (columns may not exist yet)
  if (newClientRecord) {
    try {
      const profileUpdates: Record<string, any> = {}
      if (birthday) profileUpdates.birthday = birthday
      if (Object.keys(profileUpdates).length > 0) {
        await adminClient.from('clients').update(profileUpdates).eq('id', newClientRecord.id)
      }
    } catch {}
  }

  // Create an initial plan if owed amount was provided
  if (owed && parseFloat(owed) > 0 && newClientRecord) {
    await adminClient
      .from('plans')
      .insert({
        client_id: newClientRecord.id,
        start_date: startDate || new Date().toISOString().split('T')[0],
        end_date: planEnd || null,
        goal: goal || null,
        owed: parseFloat(owed),
        paid: 0,
        status: 'active',
      })
  }

  // Auto-assign the creating coach (logged-in admin) as the default coach for this client
  if (newClientRecord) {
    try {
      await adminClient
        .from('client_coaches')
        .insert({
          client_id: newClientRecord.id,
          coach_id: user.id,
          is_default: true,
        })
    } catch (err) {
      console.error('Failed to assign coach to new client:', err)
    }
  }

  return NextResponse.json({ 
    success: true, 
    userId: newUserId,
    message: `Invite email sent to ${email}` 
  })
}
