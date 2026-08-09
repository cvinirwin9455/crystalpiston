import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOrgIdForUser } from '@/lib/org'

// Helper: create admin client with service role key
async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Default features (all enabled) - used when no row exists yet
const DEFAULT_FEATURES = {
  run: true,
  walk: true,
  cycling: true,
  crossTraining: true,
  stretching: true,
}

// GET /api/org-features - Get feature toggles for current user's org
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await createAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)

  if (!orgId) {
    // No org — return all features enabled (fallback)
    return NextResponse.json(DEFAULT_FEATURES)
  }

  const { data: features } = await adminClient
    .from('organization_features')
    .select('*')
    .eq('organization_id', orgId)
    .single()

  if (!features) {
    // No row exists yet — create one with defaults
    await adminClient
      .from('organization_features')
      .insert({ organization_id: orgId })

    return NextResponse.json(DEFAULT_FEATURES)
  }

  return NextResponse.json({
    run: features.feature_run,
    walk: features.feature_walk,
    cycling: features.feature_cycling,
    crossTraining: features.feature_cross_training,
    stretching: features.feature_stretching,
  })
}

// PUT /api/org-features - Update feature toggles (account owners only)
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check that user is an account_coach (owner), not a regular coach
  const { data: profile } = await supabase
    .from('users')
    .select('role, coach_level')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' || profile?.coach_level === 'coach') {
    return NextResponse.json({ error: 'Only account owners can manage feature toggles' }, { status: 403 })
  }

  const adminClient = await createAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)

  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 })
  }

  const body = await request.json()
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }

  if (body.run !== undefined) updates.feature_run = body.run
  if (body.walk !== undefined) updates.feature_walk = body.walk
  if (body.cycling !== undefined) updates.feature_cycling = body.cycling
  if (body.crossTraining !== undefined) updates.feature_cross_training = body.crossTraining
  if (body.stretching !== undefined) updates.feature_stretching = body.stretching

  // Upsert: update if exists, insert if not
  const { error } = await adminClient
    .from('organization_features')
    .upsert({
      organization_id: orgId,
      ...updates,
    }, { onConflict: 'organization_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
