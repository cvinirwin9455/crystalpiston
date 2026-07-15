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

// POST /api/clients/[id] - Resend invite email
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

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

  const userId = params.id
  const adminClient = await getAdminClient()

  // Get the user's email
  const { data: clientUser } = await adminClient
    .from('users')
    .select('email, name')
    .eq('id', userId)
    .single()

  if (!clientUser || !clientUser.email) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Get the base URL from the request
  const url = new URL(request.url)
  const baseUrl = `${url.protocol}//${url.host}`

  // Generate a new invite link for the existing user
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email: clientUser.email,
    options: {
      data: {
        name: clientUser.name,
        role: 'client',
      },
      redirectTo: `${baseUrl}/auth/callback?next=/set-password`,
    },
  })

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 })
  }

  // Extract the hashed_token from the generated link
  const hashedToken = linkData?.properties?.hashed_token
  if (!hashedToken) {
    return NextResponse.json({ error: 'Failed to generate invite token' }, { status: 500 })
  }

  // Construct the invite URL using token_hash format
  const inviteUrl = `${baseUrl}/auth/callback?token_hash=${hashedToken}&type=invite&next=/set-password`

  // Determine brand from admin's organization
  const { getOrgIdForUser } = await import('@/lib/org')
  const { getEmailBrandFromOrgId } = await import('@/lib/email')
  const { sendClientInviteEmail } = await import('@/lib/invite-emails')

  const orgId = await getOrgIdForUser(adminClient, user.id)
  const brand = getEmailBrandFromOrgId(orgId)

  // Get the coach's name for the invite email
  const { data: coachProfile } = await adminClient
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single()
  const coachName = coachProfile?.name || 'Your coach'

  const sent = await sendClientInviteEmail({
    to: clientUser.email,
    clientName: clientUser.name || 'there',
    coachName,
    confirmationUrl: inviteUrl,
    brand,
  })

  if (!sent) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: `Invite resent to ${clientUser.email}` })
}

// PATCH /api/clients/[id] - Update a client's details
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

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

  const userId = params.id
  const body = await request.json()
  const { name, email, gender, status, goal, birthday } = body

  const adminClient = await getAdminClient()

  // Update users table (name, email, gender, status)
  const userUpdates: Record<string, any> = {}
  if (name !== undefined) userUpdates.name = name
  if (email !== undefined) userUpdates.email = email
  if (gender !== undefined) userUpdates.gender = gender
  if (status !== undefined) userUpdates.status = status

  if (Object.keys(userUpdates).length > 0) {
    const { error: userError } = await adminClient
      .from('users')
      .update(userUpdates)
      .eq('id', userId)

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }
  }

  // If email changed, also update the auth user email
  if (email !== undefined) {
    const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
      email: email,
    })
    if (authError) {
      console.error('Failed to update auth email:', authError)
      // Don't fail the whole request - the users table was already updated
    }
  }

  // Update clients table (goal + birthday)
  const clientUpdates: Record<string, any> = {}
  if (goal !== undefined) clientUpdates.goal = goal || null
  if (birthday !== undefined) clientUpdates.birthday = birthday || null

  if (Object.keys(clientUpdates).length > 0) {
    const { error: clientError } = await adminClient
      .from('clients')
      .update(clientUpdates)
      .eq('user_id', userId)

    if (clientError) {
      console.error('Failed to update client training profile:', clientError)
      // Don't fail - columns might not exist yet
    }
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/clients/[id] - Archive a client (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

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

  const adminClient = await getAdminClient()
  const userId = params.id

  const { error } = await adminClient
    .from('users')
    .update({ status: 'inactive' })
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
