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

// GET /api/plans?client_id=xxx - Get all plans for a client
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
  const { data: plans, error } = await adminClient
    .from('plans')
    .select('id, client_id, start_date, end_date, goal, owed, paid, status, completion_reason, created_at')
    .eq('client_id', clientId)
    .order('start_date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(plans || [])
}

// POST /api/plans - Create a new plan for a client
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
  const { clientId, startDate, endDate, owed, goal } = body

  if (!clientId || !startDate || !endDate) {
    return NextResponse.json({ error: 'clientId, startDate, and endDate are required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  const { data: plan, error } = await adminClient
    .from('plans')
    .insert({
      client_id: clientId,
      start_date: startDate,
      end_date: endDate,
      goal: goal || null,
      owed: owed ? parseFloat(owed) : 0,
      paid: 0,
      status: 'active',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, plan })
}

// PATCH /api/plans - Update a plan (payment, status, dates)
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
  const { planId, startDate, endDate, owed, paid, status, completionReason } = body

  if (!planId) {
    return NextResponse.json({ error: 'planId is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  const updates: Record<string, any> = {}
  if (startDate !== undefined) updates.start_date = startDate
  if (endDate !== undefined) updates.end_date = endDate
  if (owed !== undefined) updates.owed = parseFloat(owed)
  if (paid !== undefined) updates.paid = parseFloat(paid)
  if (status !== undefined) updates.status = status
  if (completionReason !== undefined) updates.completion_reason = completionReason

  const { error } = await adminClient
    .from('plans')
    .update(updates)
    .eq('id', planId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
