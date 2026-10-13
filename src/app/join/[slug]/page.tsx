import type { Metadata } from 'next'
import ApplicationForm from './ApplicationForm'

// Always render fresh from the DB — never serve a cached snapshot. Without
// force-no-store the Supabase REST reads can be served from Next's data cache,
// which showed stale (empty) intro/pricing after a coach edited their offer.
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

type PackageData = {
  id: string
  name: string
  description: string | null
  priceCents: number
  currency: string
  billingInterval: 'monthly' | 'one_time'
  includesRunning: boolean
  includesStrength: boolean
  includesInPerson: boolean
  includesProgramming: boolean
}

type PageData = {
  slug: string
  coachName: string
  coachAvatar: string | null
  headline: string
  intro: string
  pricing: string
  offerTypes: string[]
  offerFormats: string[]
  showPackages: boolean
  packages: PackageData[]
}

// Read the coach's public application page DIRECTLY from the database using the
// service-role client. We deliberately do NOT make an HTTP fetch to our own API
// here: on preview/branch deployments an absolute base URL (NEXT_PUBLIC_SITE_URL)
// can point at the WRONG environment (e.g. production), which would look up the
// slug in the wrong database and render "not active". Querying the DB directly
// always uses the same database this deployment is wired to.
async function fetchPage(slug: string): Promise<PageData | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        // Force every PostgREST read to bypass Next's fetch cache so edits to a
        // coach's offer (intro/pricing) appear immediately.
        global: { fetch: (url: any, options: any = {}) => fetch(url, { ...options, cache: 'no-store' }) },
      }
    )

    const normalized = (slug || '').toLowerCase()
    const { data: page } = await supabase
      .from('coach_application_pages')
      .select('coach_id, slug, is_enabled, headline, intro, pricing, offer_types, offer_formats')
      .eq('slug', normalized)
      .maybeSingle()

    if (!page || !page.is_enabled) return null

    const { data: coach } = await supabase
      .from('users')
      .select('name, avatar_url')
      .eq('id', page.coach_id)
      .maybeSingle()

    // show_packages lives on coach_application_pages but may not exist on DBs
    // that haven't run the packages migration yet — read it separately so a
    // missing column never breaks the main page query. Defaults to true.
    let showPackages = true
    try {
      const { data: flagRow } = await supabase
        .from('coach_application_pages')
        .select('show_packages')
        .eq('slug', normalized)
        .maybeSingle()
      if (flagRow && typeof flagRow.show_packages === 'boolean') showPackages = flagRow.show_packages
    } catch { /* column not present yet — keep default */ }

    // Active packages for this coach (safe if the table doesn't exist yet).
    let packages: PackageData[] = []
    if (showPackages) {
      // Try with the new includes_* columns first; fall back if they don't exist yet.
      const { data: pkgRows, error: pkgError } = await supabase
        .from('coach_packages')
        .select('id, name, description, price_cents, currency, billing_interval, includes_running, includes_strength, includes_in_person, includes_programming, is_active, sort_order')
        .eq('coach_id', page.coach_id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (pkgError) {
        // Columns likely don't exist yet — query without them and default sensibly.
        const { data: fallbackRows } = await supabase
          .from('coach_packages')
          .select('id, name, description, price_cents, currency, billing_interval, is_active, sort_order')
          .eq('coach_id', page.coach_id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
        packages = (fallbackRows || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description || null,
          priceCents: p.price_cents,
          currency: p.currency || 'usd',
          billingInterval: p.billing_interval === 'one_time' ? 'one_time' : 'monthly',
          includesRunning: true,
          includesStrength: false,
          includesInPerson: false,
          includesProgramming: true,
        }))
      } else {
        packages = (pkgRows || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description || null,
          priceCents: p.price_cents,
          currency: p.currency || 'usd',
          billingInterval: p.billing_interval === 'one_time' ? 'one_time' : 'monthly',
          includesRunning: p.includes_running ?? true,
          includesStrength: p.includes_strength ?? false,
          includesInPerson: p.includes_in_person ?? false,
          includesProgramming: p.includes_programming ?? true,
        }))
      }
    }

    return {
      slug: page.slug,
      coachName: coach?.name || 'Your coach',
      coachAvatar: coach?.avatar_url || null,
      headline: page.headline || `Apply for coaching with ${coach?.name || 'me'}`,
      intro: page.intro || '',
      pricing: page.pricing || '',
      offerTypes: Array.isArray(page.offer_types) && page.offer_types.length ? page.offer_types : ['running'],
      offerFormats: Array.isArray(page.offer_formats) && page.offer_formats.length ? page.offer_formats : ['programming'],
      showPackages,
      packages,
    }
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await fetchPage(params.slug)
  if (!page) return { title: 'Apply for Coaching — First Mile Coach' }
  return {
    title: `${page.headline} — First Mile Coach`,
    description: page.intro || `Apply for coaching with ${page.coachName}.`,
  }
}

export default async function JoinPage({ params }: { params: { slug: string } }) {
  const page = await fetchPage(params.slug)

  if (!page) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafbfc', padding: 24, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <div style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 30px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ background: '#ffffff', borderBottom: '1px solid #eef1f3', padding: '22px 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img src="https://www.firstmilecoach.com/firstmile/logo.png" alt="First Mile Coach" style={{ display: 'block', height: 72, width: 'auto' }} />
          </div>
          <div style={{ padding: '32px 28px', textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#2d3436', margin: '0 0 10px' }}>Not accepting applications</h1>
            <p style={{ color: '#555b5e', fontSize: 15, lineHeight: 1.7, margin: 0 }}>This coach currently isn&apos;t accepting applications. Please check back later or reach out to them directly.</p>
          </div>
        </div>
      </main>
    )
  }

  return <ApplicationForm page={page} />
}
