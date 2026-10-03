import type { Metadata } from 'next'
import ApplicationForm from './ApplicationForm'

export const dynamic = 'force-dynamic'

type PageData = {
  slug: string
  coachName: string
  coachAvatar: string | null
  headline: string
  intro: string
  pricing: string
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
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const normalized = (slug || '').toLowerCase()
    const { data: page } = await supabase
      .from('coach_application_pages')
      .select('coach_id, slug, is_enabled, headline, intro, pricing')
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
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <img src="https://www.firstmilecoach.com/firstmile/logo.png" alt="First Mile Coach" width={150} style={{ marginBottom: 24 }} />
          <h1 style={{ fontSize: 22, color: '#2d3436', marginBottom: 8 }}>This link isn&apos;t active</h1>
          <p style={{ color: '#777', fontSize: 15 }}>This coaching application link is unavailable. Please check the link or contact your coach.</p>
        </div>
      </main>
    )
  }

  return <ApplicationForm page={page} />
}
