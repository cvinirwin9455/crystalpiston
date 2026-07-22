import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/weeks/draft-count - Get total draft week count across all clients
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service role to bypass RLS
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get user's org to scope the query
  const { data: userProfile } = await adminClient
    .from('users')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (userProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get all client IDs in this org
  const orgId = userProfile?.organization_id
  let clientIds: string[] = []

  if (orgId) {
    // Get users in this org, then get their client records
    const { data: orgUsers } = await adminClient
      .from('users')
      .select('id')
      .eq('organization_id', orgId)
      .eq('role', 'client')

    if (orgUsers && orgUsers.length > 0) {
      const userIds = orgUsers.map((u: any) => u.id)
      const { data: clientRecords } = await adminClient
        .from('clients')
        .select('id')
        .in('user_id', userIds)

      clientIds = (clientRecords || []).map((c: any) => c.id)
    }
  }

  // Count draft weeks for these clients
  let draftCount = 0
  if (clientIds.length > 0) {
    const { count, error } = await adminClient
      .from('weeks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft')
      .in('client_id', clientIds)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    draftCount = count || 0
  } else {
    // Fallback: no org scoping, count all drafts
    const { count, error } = await adminClient
      .from('weeks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    draftCount = count || 0
  }

  return NextResponse.json({ draftCount })
}
