import type { Metadata } from 'next'
import ApplicationForm from './ApplicationForm'

export const dynamic = 'force-dynamic'

async function fetchPage(slug: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.firstmilecoach.com'
  try {
    const res = await fetch(`${base}/api/apply/${encodeURIComponent(slug)}`, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as {
      slug: string
      coachName: string
      coachAvatar: string | null
      headline: string
      intro: string
      pricing: string
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
