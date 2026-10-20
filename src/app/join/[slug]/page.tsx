import type { Metadata } from 'next'
import ApplicationForm from './ApplicationForm'

// Always render fresh from the DB — never serve a cached snapshot. Without
// force-no-store the Supabase REST reads can be served from Next's data cache,
// which showed stale (empty) intro/pricing after a coach edited their offer.
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

type PageData = {
  slug: string
  coachName: string
  coachAvatar: string | null
  headline: string
  intro: string
  pricing: string
  offerTypes: string[]
  offerFormats: string[]
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

    return {
      slug: page.slug,
      coachName: coach?.name || 'Your coach',
      coachAvatar: coach?.avatar_url || null,
      headline: page.headline || `Apply for coaching with ${coach?.name || 'me'}`,
      intro: page.intro || '',
      pricing: page.pricing || '',
      offerTypes: Array.isArray(page.offer_types) && page.offer_types.length ? page.offer_types : ['running'],
      offerFormats: Array.isArray(page.offer_formats) && page.offer_formats.length ? page.offer_formats : ['programming'],
    }
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await fetchPage(params.slug)
  if (!page) return { title: 'Apply for Coaching — First Mile Coach' }

  // Per-coach social preview. The root layout defaults to the First Mile
  // "launch your coaching business" pitch — which is aimed at COACHES, not the
  // prospective clients a coach shares their /join link with. We must override
  // openGraph / twitter / canonical here so link previews and crawlers show the
  // COACH's page, not the platform ad.
  const title = `Apply for coaching with ${page.coachName}`
  const description =
    page.intro ||
    page.headline ||
    `Apply to train with ${page.coachName} on First Mile Coach.`
  // Prefer the coach's own photo as the preview image; fall back to the
  // First Mile logo so the card is never blank. These must be ABSOLUTE urls.
  const image = page.coachAvatar || 'https://www.firstmilecoach.com/firstmile/logo.png'
  const url = `https://www.firstmilecoach.com/join/${page.slug}`

  return {
    title: `${title} — First Mile Coach`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'First Mile Coach',
      type: 'website',
      locale: 'en_US',
      images: [{ url: image, alt: page.coachName }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
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
