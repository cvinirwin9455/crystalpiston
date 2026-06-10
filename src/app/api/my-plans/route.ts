import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/my-plans - Get the logged-in client's active plan info
export async function GET() {
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

  // Get the client record
  const { data: client } = await adminClient
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!client) {
    return NextResponse.json(null)
  }

  // Get the active plan (or most recent completed if no active)
  const { data: activePlan } = await adminClient
    .from('plans')
    .select('id, start_date, end_date, goal, owed, paid, status')
    .eq('client_id', client.id)
    .eq('status', 'active')
    .single()

  if (activePlan) {
    return NextResponse.json({
      goal: activePlan.goal || '',
      startDate: activePlan.start_date,
      planEnd: activePlan.end_date,
      owed: parseFloat(activePlan.owed) || 0,
      paid: parseFloat(activePlan.paid) || 0,
      status: activePlan.status,
    })
  }

  // No active plan — check for most recent completed
  const { data: recentPlan } = await adminClient
    .from('plans')
    .select('id, start_date, end_date, goal, owed, paid, status')
    .eq('client_id', client.id)
    .order('end_date', { ascending: false })
    .limit(1)
    .single()

  if (recentPlan) {
    return NextResponse.json({
      goal: recentPlan.goal || '',
      startDate: recentPlan.start_date,
      planEnd: recentPlan.end_date,
      owed: parseFloat(recentPlan.owed) || 0,
      paid: parseFloat(recentPlan.paid) || 0,
      status: recentPlan.status,
    })
  }

  return NextResponse.json(null)
}
