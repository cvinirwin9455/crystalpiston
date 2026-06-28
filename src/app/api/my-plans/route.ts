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

  // Get the client record (try birthday column, fall back to just id)
  let client: any = null
  const clientResult = await adminClient
    .from('clients')
    .select('id, birthday')
    .eq('user_id', user.id)
    .single()

  if (clientResult.error) {
    const fallback = await adminClient
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single()
    client = fallback.data
  } else {
    client = clientResult.data
  }

  if (!client) {
    return NextResponse.json({ activePlan: null, allPlans: [], gender: userProfile?.gender || null, trainingProfile: null, coachName: null })
  }

  // Fetch the default coach name for this client
  let coachName: string | null = null
  try {
    const { data: coachAssignment } = await adminClient
      .from('client_coaches')
      .select('coach_id')
      .eq('client_id', client.id)
      .eq('is_default', true)
      .single()

    if (coachAssignment) {
      const { data: coachUser } = await adminClient
        .from('users')
        .select('name')
        .eq('id', coachAssignment.coach_id)
        .single()
      coachName = coachUser?.name?.split(' ')[0] || null
    }
  } catch {
    // Table may not exist yet - fallback to first admin
    try {
      const { data: adminUsers } = await adminClient
        .from('users')
        .select('name')
        .eq('role', 'admin')
        .order('created_at', { ascending: true })
        .limit(1)
      coachName = adminUsers?.[0]?.name?.split(' ')[0] || null
    } catch {}
  }

  // Get all plans for this client (try new columns, fall back if they don't exist yet)
  let plans: any[] | null = null
  const fullResult = await adminClient
    .from('plans')
    .select('id, start_date, end_date, goal, owed, paid, status, target_distance, race_date, goal_pace, injury_notes')
    .eq('client_id', client.id)
    .order('start_date', { ascending: false })

  if (fullResult.error) {
    const fallback = await adminClient
      .from('plans')
      .select('id, start_date, end_date, goal, owed, paid, status')
      .eq('client_id', client.id)
      .order('start_date', { ascending: false })
    plans = fallback.data
  } else {
    plans = fullResult.data
  }

  if (!plans || plans.length === 0) {
    return NextResponse.json({ activePlan: null, allPlans: [], gender: userProfile?.gender || null, trainingProfile: {
      birthday: client.birthday || null,
    }, coachName })
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
    coachName,
  })
}
