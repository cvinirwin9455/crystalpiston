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

// GET /api/payments?plan_id=xxx - Get all payments for a plan
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const planId = searchParams.get('plan_id')

  if (!planId) {
    return NextResponse.json({ error: 'plan_id is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()
  const { data: payments, error } = await adminClient
    .from('payments')
    .select('id, plan_id, amount, payment_date, notes, created_at')
    .eq('plan_id', planId)
    .order('payment_date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(payments || [])
}

// POST /api/payments - Log a new payment
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
  const { planId, amount, paymentDate, notes } = body

  if (!planId || !amount) {
    return NextResponse.json({ error: 'planId and amount are required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Insert the payment record
  const { data: payment, error: paymentError } = await adminClient
    .from('payments')
    .insert({
      plan_id: planId,
      amount: parseFloat(amount),
      payment_date: paymentDate || new Date().toISOString().split('T')[0],
      notes: notes || null,
    })
    .select()
    .single()

  if (paymentError) {
    return NextResponse.json({ error: paymentError.message }, { status: 500 })
  }

  // Also update the plan's total paid amount
  const { data: plan } = await adminClient
    .from('plans')
    .select('paid')
    .eq('id', planId)
    .single()

  const newPaid = (parseFloat(plan?.paid) || 0) + parseFloat(amount)

  await adminClient
    .from('plans')
    .update({ paid: newPaid })
    .eq('id', planId)

  return NextResponse.json({ success: true, payment, newPaidTotal: newPaid })
}
