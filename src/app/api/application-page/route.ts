import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveCoachRequestScope } from '@/lib/coach-scope'

// Authenticated endpoints for managing a coach's public application page (the
// editable "offer" shown at /join/<slug>).
//   GET   /api/application-page  -> the coach's current page config (+ slug)
//   PATCH /api/application-page  -> update headline/intro/pricing/slug/enabled
//
// Super-admin "view as coach" is honored via ?org=&coach= (GET) or org/coach in
// the body (PATCH), resolved through resolveCoachRequestScope (overrides allowed
// for super admins only). All reads/writes are scoped to the resolved coachId,
// so a super admin viewing a coach edits THAT coach's page, not their own.

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

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const orgOverride = searchParams.get('org')
  const coachOverride = searchParams.get('coach')

  const admin = await createAdminClient()
  const scopeResult = await resolveCoachRequestScope(admin, user.id, orgOverride, coachOverride)
  if (!scopeResult.scope) {
    return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  }
  const { coachId, organizationId } = scopeResult.scope

  // The effective coach's name (used for the default headline/slug).
  const { data: coachProfile } = await admin
    .from('users')
    .select('name')
    .eq('id', coachId)
    .single()
  const coachDisplayName = coachProfile?.name || 'me'

  let { data: page } = await admin
    .from('coach_application_pages')
    .select('coach_id, slug, is_enabled, headline, intro, pricing, offer_types, offer_formats')
    .eq('coach_id', coachId)
    .maybeSingle()

  // Lazily create a page for coaches who don't have one yet (e.g. invited
  // after the backfill migration ran).
  if (!page) {
    let base = normalizeSlug(coachDisplayName)
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
        coach_id: coachId,
        organization_id: organizationId || null,
        slug,
        is_enabled: true,
        headline: `Apply for coaching with ${coachDisplayName}`,
        offer_types: ['running'],
        offer_formats: ['programming'],
      })
      .select('coach_id, slug, is_enabled, headline, intro, pricing, offer_types, offer_formats')
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

  const body = await request.json()
  const { headline, intro, pricing, is_enabled, slug, offer_types, offer_formats, org: orgOverride, coach: coachOverride } = body || {}

  const admin = await createAdminClient()
  const scopeResult = await resolveCoachRequestScope(admin, user.id, orgOverride, coachOverride)
  if (!scopeResult.scope) {
    return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  }
  const { coachId } = scopeResult.scope

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (headline !== undefined) updates.headline = headline
  if (intro !== undefined) updates.intro = intro
  if (pricing !== undefined) updates.pricing = pricing
  if (is_enabled !== undefined) updates.is_enabled = !!is_enabled

  // Offerings: validate against the known vocab and keep at least one each.
  const VALID_TYPES = ['running', 'personal_training']
  const VALID_FORMATS = ['programming', 'in_person']
  if (offer_types !== undefined) {
    const clean = Array.isArray(offer_types) ? offer_types.filter((t: string) => VALID_TYPES.includes(t)) : []
    if (clean.length === 0) {
      return NextResponse.json({ error: 'Select at least one thing you offer (e.g. Running or Personal Training).' }, { status: 400 })
    }
    updates.offer_types = clean
  }
  if (offer_formats !== undefined) {
    const clean = Array.isArray(offer_formats) ? offer_formats.filter((f: string) => VALID_FORMATS.includes(f)) : []
    if (clean.length === 0) {
      return NextResponse.json({ error: 'Select at least one format you offer (Programming or In-person).' }, { status: 400 })
    }
    updates.offer_formats = clean
  }

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
    if (taken && taken.coach_id !== coachId) {
      return NextResponse.json({ error: 'That link is already taken. Try another.' }, { status: 409 })
    }
    updates.slug = clean
  }

  const { data: updated, error } = await admin
    .from('coach_application_pages')
    .update(updates)
    .eq('coach_id', coachId)
    .select('coach_id, slug, is_enabled, headline, intro, pricing, offer_types, offer_formats')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'No application page found to update.' }, { status: 404 })
  }

  return NextResponse.json({ page: updated })
}
