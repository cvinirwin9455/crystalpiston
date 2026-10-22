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
    return NextResponse.json({ activePlan: null, allPlans: [], gender: userProfile?.gender || null, trainingProfile: null, coachName: null, coachAvatarUrl: null, coachStravaUrl: null })
  }

  // Fetch the coach name/photo for this client. Prefer the coach flagged
  // is_default; if none is flagged (e.g. a client has multiple coaches but no
  // default was set), fall back to the first-assigned coach rather than showing
  // a generic "your coach" placeholder.
  let coachName: string | null = null
  let coachAvatarUrl: string | null = null
  let coachStravaUrl: string | null = null

  // Resolve a coach user's display name + avatar (with Strava photo fallback).
  const resolveCoachProfile = async (coachId: string) => {
    const { data: coachUser } = await adminClient
      .from('users')
      .select('name, avatar_url')
      .eq('id', coachId)
      .maybeSingle()
    coachName = coachUser?.name || null
    coachAvatarUrl = coachUser?.avatar_url || null
    if (!coachAvatarUrl) {
      const { data: strava } = await adminClient
        .from('strava_connections')
        .select('athlete_profile')
        .eq('user_id', coachId)
        .maybeSingle()
      if (strava?.athlete_profile) {
        coachStravaUrl = strava.athlete_profile.replace(/^http:\/\//i, 'https://')
      }
    }
  }

  try {
    // Pull ALL of this client's coach assignments (no is_default filter, no
    // .single() — both would error when there's no default or several coaches).
    const { data: assignments } = await adminClient
      .from('client_coaches')
      .select('coach_id, is_default, created_at')
      .eq('client_id', client.id)
      .order('is_default', { ascending: false }) // default (true) first
      .order('created_at', { ascending: true })  // then earliest-assigned

    // Prefer the explicitly-flagged default; otherwise the first assignment.
    const chosen =
      (assignments || []).find((a: any) => a.is_default) ||
      (assignments || [])[0] ||
      null

    console.log(`[my-plans] Client ${user.id}, clients.id=${client.id}, coach assignments=${assignments?.length ?? 0}, chosen coach:`, chosen?.coach_id || null)

    if (chosen?.coach_id) {
      await resolveCoachProfile(chosen.coach_id)
    }
  } catch {
    // client_coaches may not exist yet — fall back to the first admin.
    try {
      const { data: adminUsers } = await adminClient
        .from('users')
        .select('id, name, avatar_url')
        .eq('role', 'admin')
        .order('created_at', { ascending: true })
        .limit(1)
      if (adminUsers?.[0]?.id) await resolveCoachProfile(adminUsers[0].id)
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
    }, coachName, coachAvatarUrl, coachStravaUrl })
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
    coachAvatarUrl,
    coachStravaUrl,
  })
}
