import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { hasCoachAccess } from '@/lib/roles'

// Authenticated endpoints for a coach to manage THEIR OWN public application
// page (the editable "offer" shown at /join/<slug>).
//   GET   /api/application-page  -> the coach's current page config (+ slug)
//   PATCH /api/application-page  -> update headline/intro/pricing/slug/enabled

async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

function normalizeSlug(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('name, role, has_coach_access, is_super_admin, organization_id')
    .eq('id', user.id)
    .single()

  if (!hasCoachAccess(profile) && !profile?.is_super_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = await createAdminClient()
  let { data: page } = await admin
    .from('coach_application_pages')
    .select('coach_id, slug, is_enabled, headline, intro, pricing')
    .eq('coach_id', user.id)
    .maybeSingle()

  // Lazily create a page for coaches who don't have one yet (e.g. invited
  // after the backfill migration ran).
  if (!page) {
    let base = normalizeSlug(profile?.name || 'coach')
    if (base.length < 2) base = 'coach'
    let slug = base
    let n = 1
    // Find a free slug.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: taken } = await admin
        .from('coach_application_pages')
        .select('coach_id')
        .eq('slug', slug)
        .maybeSingle()
      if (!taken) break
      n += 1
      slug = `${base}-${n}`
    }
    const { data: created, error: createErr } = await admin
      .from('coach_application_pages')
      .insert({
        coach_id: user.id,
        organization_id: profile?.organization_id || null,
        slug,
        is_enabled: true,
        headline: `Apply for coaching with ${profile?.name || 'me'}`,
      })
      .select('coach_id, slug, is_enabled, headline, intro, pricing')
      .single()
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
    page = created
  }

  return NextResponse.json({ page })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, has_coach_access, is_super_admin')
    .eq('id', user.id)
    .single()

  if (!hasCoachAccess(profile) && !profile?.is_super_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { headline, intro, pricing, is_enabled, slug } = body || {}
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }

  if (headline !== undefined) updates.headline = headline
  if (intro !== undefined) updates.intro = intro
  if (pricing !== undefined) updates.pricing = pricing
  if (is_enabled !== undefined) updates.is_enabled = !!is_enabled

  const admin = await createAdminClient()

  if (slug !== undefined) {
    const clean = normalizeSlug(slug)
    if (!SLUG_RE.test(clean) || clean.length < 2) {
      return NextResponse.json({ error: 'Link must be 2–40 letters, numbers, or hyphens.' }, { status: 400 })
    }
    // Ensure uniqueness against OTHER coaches.
    const { data: taken } = await admin
      .from('coach_application_pages')
      .select('coach_id')
      .eq('slug', clean)
      .maybeSingle()
    if (taken && taken.coach_id !== user.id) {
      return NextResponse.json({ error: 'That link is already taken. Try another.' }, { status: 409 })
    }
    updates.slug = clean
  }

  const { data: updated, error } = await admin
    .from('coach_application_pages')
    .update(updates)
    .eq('coach_id', user.id)
    .select('coach_id, slug, is_enabled, headline, intro, pricing')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'No application page found to update.' }, { status: 404 })
  }

  return NextResponse.json({ page: updated })
}
