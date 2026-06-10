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
  const { name, email, gender, status, goal } = body

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

  // Update clients table (goal)
  if (goal !== undefined) {
    const { error: clientError } = await adminClient
      .from('clients')
      .update({ goal })
      .eq('user_id', userId)

    if (clientError) {
      return NextResponse.json({ error: clientError.message }, { status: 500 })
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
