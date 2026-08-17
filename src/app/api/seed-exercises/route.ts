import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { seedExerciseLibrary } from '@/lib/seed-exercise-library'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * POST /api/seed-exercises
 * 
 * Seeds the default exercise library into one or all coach organizations.
 * Super admin only.
 * 
 * Body options:
 *   { "orgId": "uuid" }           — seed a specific org
 *   { "all": true }               — seed ALL orgs that don't have exercises yet
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await getAdminClient()

  // Verify super admin
  const { data: profile } = await adminClient
    .from('users')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
  }

  const body = await request.json()
  const { orgId, all } = body

  // Seed a single org
  if (orgId) {
    const result = await seedExerciseLibrary(adminClient, orgId)
    return NextResponse.json(result)
  }

  // Seed all orgs
  if (all) {
    // Get all organizations
    const { data: orgs, error: orgsError } = await adminClient
      .from('organizations')
      .select('id, name')

    if (orgsError) {
      return NextResponse.json({ error: `Failed to fetch orgs: ${orgsError.message}` }, { status: 500 })
    }

    const results: Array<{ orgId: string; orgName: string; success: boolean; inserted: number; skipped: boolean; error?: string }> = []

    for (const org of orgs || []) {
      const result = await seedExerciseLibrary(adminClient, org.id)
      results.push({
        orgId: org.id,
        orgName: org.name,
        ...result,
      })
    }

    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0)
    const totalSkipped = results.filter((r) => r.skipped).length
    const totalFailed = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: totalFailed === 0,
      summary: {
        totalOrgs: results.length,
        seeded: results.filter((r) => r.inserted > 0).length,
        skipped: totalSkipped,
        failed: totalFailed,
        totalExercisesInserted: totalInserted,
      },
      details: results,
    })
  }

  return NextResponse.json({ error: 'Provide either "orgId" or "all: true"' }, { status: 400 })
}
