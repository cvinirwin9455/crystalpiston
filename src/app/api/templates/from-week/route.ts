import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveCoachRequestScope } from '@/lib/coach-scope'
import { buildWeekTemplateData } from '@/lib/week-to-template'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/templates/from-week
// Body: { weekId, name, category?, org?, coach? }
//
// Save an already-SAVED client week (published or draft, past, current or future) as a
// reusable week template. Until now a template could only be made from the Create Week
// form while drafting. Super-admin "view as coach" is honored via org/coach in the body,
// so the template lands in the VIEWED coach's organization.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { weekId, name, category, org: orgOverride, coach: coachOverride } = body || {}

  if (!weekId || typeof weekId !== 'string') {
    return NextResponse.json({ error: 'weekId is required' }, { status: 400 })
  }
  const templateName = String(name || '').trim()
  if (!templateName) return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
  if (templateName.length > 120) return NextResponse.json({ error: 'Template name is too long (120 characters max)' }, { status: 400 })
  const templateCategory = String(category || '').trim().slice(0, 60) || null

  const admin = await getAdminClient()
  const scopeResult = await resolveCoachRequestScope(admin, user.id, orgOverride, coachOverride)
  if (!scopeResult.scope) {
    return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  }
  const { organizationId, coachId, effectiveProfile } = scopeResult.scope
  if (!organizationId) {
    return NextResponse.json({ error: 'Your account is not part of an organization yet.' }, { status: 400 })
  }

  // Load the week and make sure it belongs to a client of THIS coach's organization.
  const { data: week } = await admin
    .from('weeks')
    .select('id, client_id, focus, coach_message')
    .eq('id', weekId)
    .maybeSingle()
  if (!week) return NextResponse.json({ error: 'Week not found' }, { status: 404 })

  const { data: client } = await admin.from('clients').select('id, user_id').eq('id', week.client_id).maybeSingle()
  const { data: clientUser } = client
    ? await admin.from('users').select('organization_id').eq('id', client.user_id).maybeSingle()
    : { data: null }
  if (!client || !clientUser || clientUser.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Coaches limited to their own clients may only use weeks of clients assigned to them.
  if (effectiveProfile.access_level === 'own_clients') {
    const { data: assignment } = await admin
      .from('client_coaches')
      .select('id')
      .eq('client_id', client.id)
      .eq('coach_id', coachId)
      .maybeSingle()
    if (!assignment) {
      return NextResponse.json({ error: 'This client isn\u2019t assigned to you.' }, { status: 403 })
    }
  }

  const { data: workouts, error: workoutsError } = await admin
    .from('workouts')
    .select('*')
    .eq('week_id', week.id)
    .order('sort_order', { ascending: true })
  if (workoutsError) return NextResponse.json({ error: workoutsError.message }, { status: 500 })
  if (!workouts || workouts.length === 0) {
    return NextResponse.json({ error: 'This week has no workouts to save as a template.' }, { status: 400 })
  }

  // Days the client moved workouts to are not part of the coach's programming; use the
  // original day when a move was recorded. (Table may not exist on older databases.)
  const originalDay = new Map<string, string>()
  const { data: moves } = await admin
    .from('workout_moves')
    .select('workout_id, original_day')
    .eq('week_id', week.id)
    .eq('workout_type', 'programmed')
  for (const m of moves || []) {
    if (m.workout_id && m.original_day) originalDay.set(m.workout_id, m.original_day)
  }

  const data = buildWeekTemplateData(week, workouts, originalDay)

  const { data: template, error } = await admin
    .from('templates')
    .insert({
      name: templateName,
      type: 'week',
      category: templateCategory,
      data,
      organization_id: organizationId,
    })
    .select('id, name')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, template })
}
