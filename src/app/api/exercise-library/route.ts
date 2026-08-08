import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOrgIdForUser } from '@/lib/org'

/**
 * Exercise Library API
 * 
 * Stores exercise library items in the 'templates' table with type='exercise_library'.
 * Each row represents one exercise with its default settings and optional demo video.
 * 
 * The data field contains:
 * {
 *   name: string,
 *   demoVideo?: string,          // YouTube or Vimeo URL
 *   defaultMeasureType?: "reps" | "time" | "distance",
 *   defaultMeasureValue?: string,
 *   defaultSets?: number,
 *   defaultRest?: string,        // e.g. "01:00"
 *   defaultWeight?: string,
 *   defaultWeightUnit?: "kg" | "lbs",
 *   defaultNotes?: string,
 * }
 */

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/exercise-library - List all exercises in the coach's library
export async function GET(request: Request) {
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

  const adminClient = await getAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)

  let query = adminClient
    .from('templates')
    .select('id, name, data, created_at, organization_id')
    .eq('type', 'exercise_library')
    .order('name', { ascending: true })

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  const { data: exercises, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transform to a flat format for the client
  const items = (exercises || []).map((row: any) => ({
    id: row.id,
    name: row.name || row.data?.name || '',
    demoVideo: row.data?.demoVideo || '',
    defaultMeasureType: row.data?.defaultMeasureType || 'reps',
    defaultMeasureValue: row.data?.defaultMeasureValue || '',
    defaultSets: row.data?.defaultSets || 3,
    defaultRest: row.data?.defaultRest || '01:00',
    defaultWeight: row.data?.defaultWeight || '',
    defaultWeightUnit: row.data?.defaultWeightUnit || 'kg',
    defaultNotes: row.data?.defaultNotes || '',
  }))

  return NextResponse.json(items)
}

// POST /api/exercise-library - Add a new exercise to the library
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
  const { name, demoVideo, defaultMeasureType, defaultMeasureValue, defaultSets, defaultRest, defaultWeight, defaultWeightUnit, defaultNotes } = body

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Exercise name is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)

  const data = {
    name: name.trim(),
    demoVideo: demoVideo || '',
    defaultMeasureType: defaultMeasureType || 'reps',
    defaultMeasureValue: defaultMeasureValue || '',
    defaultSets: defaultSets || 3,
    defaultRest: defaultRest || '01:00',
    defaultWeight: defaultWeight || '',
    defaultWeightUnit: defaultWeightUnit || 'kg',
    defaultNotes: defaultNotes || '',
  }

  const { data: exercise, error } = await adminClient
    .from('templates')
    .insert({
      name: data.name,
      type: 'exercise_library',
      category: null,
      data,
      organization_id: orgId,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    exercise: {
      id: exercise.id,
      name: data.name,
      demoVideo: data.demoVideo,
      defaultMeasureType: data.defaultMeasureType,
      defaultMeasureValue: data.defaultMeasureValue,
      defaultSets: data.defaultSets,
      defaultRest: data.defaultRest,
      defaultWeight: data.defaultWeight,
      defaultWeightUnit: data.defaultWeightUnit,
      defaultNotes: data.defaultNotes,
    },
  })
}

// PATCH /api/exercise-library - Update an exercise in the library
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
  const { id, name, demoVideo, defaultMeasureType, defaultMeasureValue, defaultSets, defaultRest, defaultWeight, defaultWeightUnit, defaultNotes } = body

  if (!id) {
    return NextResponse.json({ error: 'Exercise id is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)

  const data = {
    name: name?.trim() || '',
    demoVideo: demoVideo || '',
    defaultMeasureType: defaultMeasureType || 'reps',
    defaultMeasureValue: defaultMeasureValue || '',
    defaultSets: defaultSets || 3,
    defaultRest: defaultRest || '01:00',
    defaultWeight: defaultWeight || '',
    defaultWeightUnit: defaultWeightUnit || 'kg',
    defaultNotes: defaultNotes || '',
  }

  let query = adminClient
    .from('templates')
    .update({ name: data.name, data })
    .eq('id', id)
    .eq('type', 'exercise_library')

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  const { data: exercise, error } = await query.select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    exercise: {
      id: exercise.id,
      name: data.name,
      demoVideo: data.demoVideo,
      defaultMeasureType: data.defaultMeasureType,
      defaultMeasureValue: data.defaultMeasureValue,
      defaultSets: data.defaultSets,
      defaultRest: data.defaultRest,
      defaultWeight: data.defaultWeight,
      defaultWeightUnit: data.defaultWeightUnit,
      defaultNotes: data.defaultNotes,
    },
  })
}

// DELETE /api/exercise-library - Remove an exercise from the library
export async function DELETE(request: Request) {
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
  const { id } = body

  if (!id) {
    return NextResponse.json({ error: 'Exercise id is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)

  let query = adminClient
    .from('templates')
    .delete()
    .eq('id', id)
    .eq('type', 'exercise_library')

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  const { error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
