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

async function verifySuperAdmin(supabase: any, adminClient: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await adminClient
    .from('users')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) return null
  return user
}

/**
 * GET /api/super-admin/exercise-library
 * 
 * Returns the master exercise library (all seed exercises from any org as reference).
 * We query distinct exercises by name where is_seed = true, taking one representative row.
 */
export async function GET() {
  const supabase = await createClient()
  const adminClient = await getAdminClient()
  const user = await verifySuperAdmin(supabase, adminClient)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  // Get distinct seed exercises — group by name, take the first org's version
  const { data: exercises, error } = await adminClient
    .from('templates')
    .select('id, name, data, created_at')
    .eq('type', 'day')
    .eq('category', '__exercise_library__')
    .filter('data->>is_seed', 'eq', 'true')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Deduplicate by name (multiple orgs have the same exercise)
  const seen = new Set<string>()
  const uniqueExercises = (exercises || []).filter((row: any) => {
    const name = row.name || row.data?.name
    if (seen.has(name)) return false
    seen.add(name)
    return true
  })

  const items = uniqueExercises.map((row: any) => ({
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

/**
 * POST /api/super-admin/exercise-library
 * 
 * Adds a new exercise to ALL organizations.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const adminClient = await getAdminClient()
  const user = await verifySuperAdmin(supabase, adminClient)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json()
  const { name, demoVideo, defaultMeasureType, defaultMeasureValue, defaultSets, defaultRest, defaultWeight, defaultWeightUnit, defaultNotes } = body

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Exercise name is required' }, { status: 400 })
  }

  // Get all organizations
  const { data: orgs, error: orgsError } = await adminClient
    .from('organizations')
    .select('id')

  if (orgsError) {
    return NextResponse.json({ error: `Failed to fetch orgs: ${orgsError.message}` }, { status: 500 })
  }

  const exerciseData = {
    name: name.trim(),
    demoVideo: demoVideo || '',
    defaultMeasureType: defaultMeasureType || 'reps',
    defaultMeasureValue: defaultMeasureValue || '',
    defaultSets: defaultSets || 3,
    defaultRest: defaultRest || '01:00',
    defaultWeight: defaultWeight || '',
    defaultWeightUnit: defaultWeightUnit || 'kg',
    defaultNotes: defaultNotes || '',
    is_seed: true,
    is_seed_modified: false,
  }

  // Insert into all orgs
  const rows = (orgs || []).map((org: any) => ({
    name: exerciseData.name,
    type: 'day',
    category: '__exercise_library__',
    organization_id: org.id,
    data: exerciseData,
  }))

  const BATCH_SIZE = 25
  let totalInserted = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await adminClient.from('templates').insert(batch)
    if (error) {
      return NextResponse.json({ error: `Insert failed at batch ${i}: ${error.message}` }, { status: 500 })
    }
    totalInserted += batch.length
  }

  return NextResponse.json({
    success: true,
    exercise: exerciseData,
    orgsUpdated: totalInserted,
  })
}

/**
 * PATCH /api/super-admin/exercise-library
 * 
 * Updates an exercise across ALL orgs where the coach hasn't modified it.
 * Matches by the original exercise name (since the exercise may have different IDs per org).
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const adminClient = await getAdminClient()
  const user = await verifySuperAdmin(supabase, adminClient)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json()
  const { originalName, name, demoVideo, defaultMeasureType, defaultMeasureValue, defaultSets, defaultRest, defaultWeight, defaultWeightUnit, defaultNotes } = body

  if (!originalName) {
    return NextResponse.json({ error: 'originalName is required to identify the exercise' }, { status: 400 })
  }

  const exerciseData = {
    name: (name || originalName).trim(),
    demoVideo: demoVideo || '',
    defaultMeasureType: defaultMeasureType || 'reps',
    defaultMeasureValue: defaultMeasureValue || '',
    defaultSets: defaultSets || 3,
    defaultRest: defaultRest || '01:00',
    defaultWeight: defaultWeight || '',
    defaultWeightUnit: defaultWeightUnit || 'kg',
    defaultNotes: defaultNotes || '',
    is_seed: true,
    is_seed_modified: false,
  }

  // Find all seed exercises with this name that haven't been modified by coaches
  const { data: targets, error: findError } = await adminClient
    .from('templates')
    .select('id')
    .eq('type', 'day')
    .eq('category', '__exercise_library__')
    .eq('name', originalName)
    .filter('data->>is_seed', 'eq', 'true')
    .or('data->>is_seed_modified.is.null,data->>is_seed_modified.eq.false')

  if (findError) {
    return NextResponse.json({ error: `Find failed: ${findError.message}` }, { status: 500 })
  }

  if (!targets || targets.length === 0) {
    return NextResponse.json({ error: 'No unmodified seed exercises found with that name' }, { status: 404 })
  }

  // Update each one
  const targetIds = targets.map((t: any) => t.id)

  const { error: updateError, count } = await adminClient
    .from('templates')
    .update({ name: exerciseData.name, data: exerciseData })
    .in('id', targetIds)

  if (updateError) {
    return NextResponse.json({ error: `Update failed: ${updateError.message}` }, { status: 500 })
  }

  // Count how many were skipped (coach-modified)
  const { count: totalWithName } = await adminClient
    .from('templates')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'day')
    .eq('category', '__exercise_library__')
    .eq('name', originalName)

  const skipped = (totalWithName || 0) - targetIds.length

  return NextResponse.json({
    success: true,
    exercise: exerciseData,
    updated: targetIds.length,
    skippedModified: skipped,
  })
}

/**
 * DELETE /api/super-admin/exercise-library
 * 
 * Removes a seed exercise from all orgs where the coach hasn't modified it.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const adminClient = await getAdminClient()
  const user = await verifySuperAdmin(supabase, adminClient)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json()
  const { name } = body

  if (!name) {
    return NextResponse.json({ error: 'Exercise name is required' }, { status: 400 })
  }

  // Find all seed exercises with this name that haven't been modified
  const { data: targets, error: findError } = await adminClient
    .from('templates')
    .select('id')
    .eq('type', 'day')
    .eq('category', '__exercise_library__')
    .eq('name', name)
    .filter('data->>is_seed', 'eq', 'true')
    .or('data->>is_seed_modified.is.null,data->>is_seed_modified.eq.false')

  if (findError) {
    return NextResponse.json({ error: `Find failed: ${findError.message}` }, { status: 500 })
  }

  if (!targets || targets.length === 0) {
    return NextResponse.json({ error: 'No unmodified seed exercises found with that name' }, { status: 404 })
  }

  const targetIds = targets.map((t: any) => t.id)

  const { error: deleteError } = await adminClient
    .from('templates')
    .delete()
    .in('id', targetIds)

  if (deleteError) {
    return NextResponse.json({ error: `Delete failed: ${deleteError.message}` }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    deleted: targetIds.length,
  })
}
