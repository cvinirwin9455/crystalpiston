import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/my-plans - Get the logged-in client's plans (active + history)
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

  // Get the user's gender
  const { data: userProfile } = await adminClient
    .from('users')
    .select('gender')
    .eq('id', user.id)
    .single()

  // Get the client record (including training profile)
  const { data: client } = await adminClient
    .from('clients')
    .select('id, birthday')
    .eq('user_id', user.id)
    .single()

  if (!client) {
    return NextResponse.json({ activePlan: null, allPlans: [], gender: userProfile?.gender || null, trainingProfile: null })
  }

  // Get all plans for this client
  const { data: plans } = await adminClient
    .from('plans')
    .select('id, start_date, end_date, goal, owed, paid, status, target_distance, race_date, goal_pace, injury_notes')
    .eq('client_id', client.id)
    .order('start_date', { ascending: false })

  if (!plans || plans.length === 0) {
    return NextResponse.json({ activePlan: null, allPlans: [], gender: userProfile?.gender || null, trainingProfile: {
      birthday: client.birthday || null,
    } })
  }

  const formatted = plans.map(p => ({
    goal: p.goal || '',
    startDate: p.start_date,
    planEnd: p.end_date,
    owed: parseFloat(p.owed) || 0,
    paid: parseFloat(p.paid) || 0,
    status: p.status,
    targetDistance: p.target_distance || null,
    raceDate: p.race_date || null,
    goalPace: p.goal_pace || null,
    injuryNotes: p.injury_notes || null,
  }))

  const activePlan = formatted.find(p => p.status === 'active') || null

  return NextResponse.json({
    activePlan,
    allPlans: formatted,
    gender: userProfile?.gender || null,
    trainingProfile: {
      birthday: client.birthday || null,
    },
  })
}
