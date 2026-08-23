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

// GET /api/session-packages?client_id=xxx - Get packages and balance for a client
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  if (!clientId) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Fetch all packages for the client
  const { data: packages, error: pkgError } = await adminClient
    .from('session_packages')
    .select('id, sessions_purchased, amount_paid, notes, purchased_at')
    .eq('client_id', clientId)
    .order('purchased_at', { ascending: false })

  if (pkgError) {
    // Table may not exist yet
    return NextResponse.json({ packages: [], sessionsRemaining: 0 })
  }

  // Calculate sessions remaining from the view, or manually
  let sessionsRemaining = 0
  try {
    const { data: balance } = await adminClient
      .from('client_session_balances')
      .select('sessions_remaining')
      .eq('client_id', clientId)
      .single()
    sessionsRemaining = balance?.sessions_remaining ?? 0
  } catch {
    // View may not exist — calculate manually
    const totalPurchased = (packages || []).reduce((sum: number, p: any) => sum + (p.sessions_purchased || 0), 0)
    const { count: usedCount } = await adminClient
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .in('status', ['completed', 'cancelled_charged', 'no_show'])
    sessionsRemaining = totalPurchased - (usedCount || 0)
  }

  return NextResponse.json({
    packages: packages || [],
    sessionsRemaining,
  })
}

// POST /api/session-packages - Add a new session package
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
  const { clientId, sessionsPurchased, amountPaid, notes } = body

  if (!clientId || !sessionsPurchased || sessionsPurchased <= 0) {
    return NextResponse.json({ error: 'clientId and sessionsPurchased (>0) are required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Get client's organization_id
  const { data: client } = await adminClient
    .from('clients')
    .select('organization_id')
    .eq('id', clientId)
    .single()

  const orgId = client?.organization_id || user.id

  const { data: pkg, error } = await adminClient
    .from('session_packages')
    .insert({
      client_id: clientId,
      organization_id: orgId,
      coach_id: user.id,
      sessions_purchased: parseInt(sessionsPurchased),
      amount_paid: amountPaid ? parseFloat(amountPaid) : 0,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, package: pkg })
}
