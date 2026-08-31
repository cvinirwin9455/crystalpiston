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
  // Try with amount_owed column, fall back if it doesn't exist yet
  let packages: any[] | null = null
  let pkgError: any = null
  const fullPkg = await adminClient
    .from('session_packages')
    .select('id, sessions_purchased, amount_paid, amount_owed, notes, purchased_at')
    .eq('client_id', clientId)
    .order('purchased_at', { ascending: false })

  if (fullPkg.error) {
    const fallbackPkg = await adminClient
      .from('session_packages')
      .select('id, sessions_purchased, amount_paid, notes, purchased_at')
      .eq('client_id', clientId)
      .order('purchased_at', { ascending: false })
    packages = fallbackPkg.data
    pkgError = fallbackPkg.error
  } else {
    packages = fullPkg.data
    pkgError = fullPkg.error
  }

  if (pkgError) {
    // Table may not exist yet
    return NextResponse.json({ packages: [], sessionsRemaining: 0 })
  }

  // Calculate sessions remaining
  let sessionsRemaining = 0
  const totalPurchased = (packages || []).reduce((sum: number, p: any) => sum + (p.sessions_purchased || 0), 0)

  // Try the view first
  const { data: balance, error: balanceError } = await adminClient
    .from('client_session_balances')
    .select('sessions_remaining')
    .eq('client_id', clientId)
    .single()

  if (!balanceError && balance) {
    sessionsRemaining = balance.sessions_remaining ?? 0
  } else {
    // View doesn't exist or no row — calculate manually
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
  const { clientId, sessionsPurchased, amountPaid, amountOwed, notes } = body

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

  // Try inserting with amount_owed, fall back if column doesn't exist
  const insertData: any = {
    client_id: clientId,
    organization_id: orgId,
    coach_id: user.id,
    sessions_purchased: parseInt(sessionsPurchased),
    amount_paid: amountPaid ? parseFloat(amountPaid) : 0,
    notes: notes || null,
  }
  // amount_owed defaults to amountPaid if not provided (backwards compatible)
  const owedValue = amountOwed !== undefined && amountOwed !== null && amountOwed !== ''
    ? parseFloat(amountOwed)
    : (amountPaid ? parseFloat(amountPaid) : 0)

  let pkg: any = null
  let error: any = null
  const fullInsert = await adminClient
    .from('session_packages')
    .insert({ ...insertData, amount_owed: owedValue })
    .select()
    .single()

  if (fullInsert.error) {
    // amount_owed column may not exist — retry without it
    const fallbackInsert = await adminClient
      .from('session_packages')
      .insert(insertData)
      .select()
      .single()
    pkg = fallbackInsert.data
    error = fallbackInsert.error
  } else {
    pkg = fullInsert.data
    error = fullInsert.error
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, package: pkg })
}

// PATCH /api/session-packages - Log a payment against a package (increment amount_paid)
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
  const { packageId, paymentAmount } = body

  if (!packageId || !paymentAmount) {
    return NextResponse.json({ error: 'packageId and paymentAmount are required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Get current amount_paid
  const { data: pkg, error: fetchErr } = await adminClient
    .from('session_packages')
    .select('amount_paid')
    .eq('id', packageId)
    .single()

  if (fetchErr || !pkg) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  }

  const newPaid = (parseFloat(pkg.amount_paid) || 0) + parseFloat(paymentAmount)

  const { error } = await adminClient
    .from('session_packages')
    .update({ amount_paid: newPaid })
    .eq('id', packageId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, newAmountPaid: newPaid })
}
