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

// GET /api/payments?plan_id=xxx OR ?client_id=xxx
// - plan_id: returns programming payments for that plan (legacy behavior)
// - client_id: returns ALL payments (programming + session) for that client
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const planId = searchParams.get('plan_id')
  const clientId = searchParams.get('client_id')

  if (!planId && !clientId) {
    return NextResponse.json({ error: 'plan_id or client_id is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Helper: try selecting with new columns, fall back to legacy columns
  const selectWithFallback = async (filterCol: string, filterVal: string) => {
    const full = await adminClient
      .from('payments')
      .select('id, plan_id, client_id, amount, payment_date, notes, payment_type, session_package_id, created_at')
      .eq(filterCol, filterVal)
      .order('payment_date', { ascending: false })
    if (!full.error) return full
    // Fall back to legacy columns (payment_type etc. don't exist yet)
    return await adminClient
      .from('payments')
      .select('id, plan_id, amount, payment_date, notes, created_at')
      .eq(filterCol, filterVal)
      .order('payment_date', { ascending: false })
  }

  let result
  if (clientId) {
    result = await selectWithFallback('client_id', clientId)
  } else {
    result = await selectWithFallback('plan_id', planId!)
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  return NextResponse.json(result.data || [])
}

// POST /api/payments - Log a new payment (programming OR session)
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
  const { planId, clientId, amount, paymentDate, notes, paymentType, sessionPackageId } = body

  if (!amount) {
    return NextResponse.json({ error: 'amount is required' }, { status: 400 })
  }

  const type = paymentType === 'session' ? 'session' : 'programming'

  if (type === 'programming' && !planId) {
    return NextResponse.json({ error: 'planId is required for programming payments' }, { status: 400 })
  }
  if (type === 'session' && !clientId) {
    return NextResponse.json({ error: 'clientId is required for session payments' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Resolve client_id for programming payments (from the plan) if not provided
  let resolvedClientId = clientId || null
  if (type === 'programming' && !resolvedClientId && planId) {
    const { data: plan } = await adminClient.from('plans').select('client_id').eq('id', planId).single()
    resolvedClientId = plan?.client_id || null
  }

  // Insert the payment record (with fallback if new columns don't exist)
  const insertData: any = {
    plan_id: type === 'programming' ? planId : null,
    amount: parseFloat(amount),
    payment_date: paymentDate || new Date().toISOString().split('T')[0],
    notes: notes || null,
  }

  let payment: any = null
  const fullInsert = await adminClient
    .from('payments')
    .insert({ ...insertData, payment_type: type, client_id: resolvedClientId, session_package_id: type === 'session' ? (sessionPackageId || null) : null })
    .select()
    .single()

  if (fullInsert.error) {
    // Legacy fallback: only works for programming payments
    if (type === 'programming') {
      const legacy = await adminClient.from('payments').insert(insertData).select().single()
      payment = legacy.data
      if (legacy.error) return NextResponse.json({ error: legacy.error.message }, { status: 500 })
    } else {
      return NextResponse.json({ error: fullInsert.error.message }, { status: 500 })
    }
  } else {
    payment = fullInsert.data
  }

  // Update the running total on the relevant record
  if (type === 'programming') {
    const { data: plan } = await adminClient.from('plans').select('paid').eq('id', planId).single()
    const newPaid = (parseFloat(plan?.paid) || 0) + parseFloat(amount)
    await adminClient.from('plans').update({ paid: newPaid }).eq('id', planId)
    return NextResponse.json({ success: true, payment, newPaidTotal: newPaid })
  } else {
    // Session payment: apply to the specified package, or the oldest package with a balance
    let targetPackageId = sessionPackageId
    if (!targetPackageId) {
      const { data: pkgs } = await adminClient
        .from('session_packages')
        .select('id, amount_paid, amount_owed')
        .eq('client_id', clientId)
        .order('purchased_at', { ascending: true })
      // Find first package with outstanding balance
      const target = (pkgs || []).find((p: any) => (parseFloat(p.amount_owed) || 0) > (parseFloat(p.amount_paid) || 0))
      targetPackageId = target?.id || (pkgs || [])[0]?.id
    }
    if (targetPackageId) {
      const { data: pkg } = await adminClient.from('session_packages').select('amount_paid').eq('id', targetPackageId).single()
      const newPaid = (parseFloat(pkg?.amount_paid) || 0) + parseFloat(amount)
      await adminClient.from('session_packages').update({ amount_paid: newPaid }).eq('id', targetPackageId)
    }
    return NextResponse.json({ success: true, payment })
  }
}
