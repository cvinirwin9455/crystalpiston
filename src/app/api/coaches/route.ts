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

// GET /api/coaches - List all coaches in the system
// GET /api/coaches?client_id=xxx - List coaches assigned to a specific client
export async function GET(request: Request) {
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

  const adminClient = await getAdminClient()
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  if (clientId) {
    // Get coaches assigned to this client
    const { data: assignments, error } = await adminClient
      .from('client_coaches')
      .select('id, coach_id, is_default, created_at')
      .eq('client_id', clientId)
      .order('is_default', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Get coach names
    const coachIds = (assignments || []).map(a => a.coach_id)
    let coachNames: Record<string, string> = {}
    if (coachIds.length > 0) {
      const { data: coaches } = await adminClient
        .from('users')
        .select('id, name, email')
        .in('id', coachIds)

      for (const c of coaches || []) {
        coachNames[c.id] = c.name || c.email || 'Unknown Coach'
      }
    }

    return NextResponse.json((assignments || []).map(a => ({
      id: a.id,
      coachId: a.coach_id,
      coachName: coachNames[a.coach_id] || 'Unknown Coach',
      isDefault: a.is_default,
      createdAt: a.created_at,
    })))
  }

  // List all coaches (admin users)
  const { data: coaches, error } = await adminClient
    .from('users')
    .select('id, name, email, access_level, created_at')
    .eq('role', 'admin')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((coaches || []).map(c => ({
    id: c.id,
    name: c.name || c.email || 'Unknown',
    email: c.email,
    accessLevel: c.access_level || 'all_clients',
    createdAt: c.created_at,
  })))
}

// POST /api/coaches - Assign a coach to a client
// Body: { clientId, coachId, isDefault? }
export async function POST(request: Request) {
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
  const { clientId, coachId, isDefault } = body

  if (!clientId || !coachId) {
    return NextResponse.json({ error: 'clientId and coachId are required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // If this coach is being set as default, unset all other defaults for this client
  if (isDefault) {
    await adminClient
      .from('client_coaches')
      .update({ is_default: false })
      .eq('client_id', clientId)
  }

  // Insert or update the coach assignment
  const { data, error } = await adminClient
    .from('client_coaches')
    .upsert({
      client_id: clientId,
      coach_id: coachId,
      is_default: isDefault || false,
    }, { onConflict: 'client_id,coach_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, assignment: data })
}

// PATCH /api/coaches - Set a coach as default for a client
// Body: { clientId, coachId }
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
  const { clientId, coachId } = body

  if (!clientId || !coachId) {
    return NextResponse.json({ error: 'clientId and coachId are required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Unset all defaults for this client
  await adminClient
    .from('client_coaches')
    .update({ is_default: false })
    .eq('client_id', clientId)

  // Set the new default
  const { error } = await adminClient
    .from('client_coaches')
    .update({ is_default: true })
    .eq('client_id', clientId)
    .eq('coach_id', coachId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// DELETE /api/coaches - Remove a coach assignment from a client
// Body: { clientId, coachId }
export async function DELETE(request: Request) {
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
  const { clientId, coachId } = body

  if (!clientId || !coachId) {
    return NextResponse.json({ error: 'clientId and coachId are required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Check: cannot remove the last coach or the default coach if they're the only one
  const { data: remaining } = await adminClient
    .from('client_coaches')
    .select('id, coach_id, is_default')
    .eq('client_id', clientId)

  if (!remaining || remaining.length <= 1) {
    return NextResponse.json({ error: 'Cannot remove the last coach. Every client must have at least one coach.' }, { status: 400 })
  }

  const isRemovingDefault = remaining.find(r => r.coach_id === coachId)?.is_default

  // Delete the assignment
  const { error } = await adminClient
    .from('client_coaches')
    .delete()
    .eq('client_id', clientId)
    .eq('coach_id', coachId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If we removed the default coach, make the first remaining coach the default
  if (isRemovingDefault) {
    const firstRemaining = remaining.find(r => r.coach_id !== coachId)
    if (firstRemaining) {
      await adminClient
        .from('client_coaches')
        .update({ is_default: true })
        .eq('id', firstRemaining.id)
    }
  }

  return NextResponse.json({ success: true })
}
