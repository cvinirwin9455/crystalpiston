import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { hasCoachAccess } from '@/lib/roles'

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
  // Try selecting the richest column set first, peeling optional columns
  // (status, amount_owed) that may not exist in a given DB yet.
  let packages: any[] | null = null
  let pkgError: any = null
  const selectVariants = [
    'id, sessions_purchased, amount_paid, amount_owed, status, notes, purchased_at',
    'id, sessions_purchased, amount_paid, amount_owed, notes, purchased_at',
    'id, sessions_purchased, amount_paid, notes, purchased_at',
  ]
  for (const sel of selectVariants) {
    const attempt = await adminClient
      .from('session_packages')
      .select(sel)
      .eq('client_id', clientId)
      .order('purchased_at', { ascending: false })
    if (!attempt.error) {
      packages = attempt.data
      pkgError = null
      break
    }
    pkgError = attempt.error
  }

  if (pkgError) {
    // Table may not exist yet
    return NextResponse.json({ packages: [], sessionsRemaining: 0 })
  }

  // Calculate sessions remaining — only ACTIVE packages count toward the
  // balance (closed ones are kept for history but don't add sessions).
  let sessionsRemaining = 0
  const totalPurchased = (packages || [])
    .filter((p: any) => (p.status ?? 'active') === 'active')
    .reduce((sum: number, p: any) => sum + (p.sessions_purchased || 0), 0)

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
    .select('role, has_coach_access')
    .eq('id', user.id)
    .single()

  if (!hasCoachAccess(profile)) {
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
    .select('role, has_coach_access')
    .eq('id', user.id)
    .single()

  if (!hasCoachAccess(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { packageId, paymentAmount, action, clientId } = body

  const adminClient = await getAdminClient()

  // --- Status actions: close out / reopen a client's session packages ---
  // Used when a coach completes a per-session/hybrid plan and chooses what to
  // do with unused sessions. 'close_all' marks the client's active packages
  // inactive (balance -> 0); 'reopen_all' brings closed packages back.
  if (action === 'close_all' || action === 'reopen_all') {
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required for this action' }, { status: 400 })
    }
    const from = action === 'close_all' ? 'active' : 'closed'
    const to = action === 'close_all' ? 'closed' : 'active'
    const { data: updated, error: statusErr } = await adminClient
      .from('session_packages')
      .update({ status: to })
      .eq('client_id', clientId)
      .eq('status', from)
      .select('id')

    if (statusErr) {
      // status column may not exist yet — surface a clear message
      return NextResponse.json(
        { error: 'Could not update session packages. Run RUN_THIS_session_package_status.sql first.', detail: statusErr.message },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true, updated: updated?.length ?? 0 })
  }

  // --- Default: log a payment against a package (increment amount_paid) ---
  if (!packageId || !paymentAmount) {
    return NextResponse.json({ error: 'packageId and paymentAmount are required' }, { status: 400 })
  }

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
