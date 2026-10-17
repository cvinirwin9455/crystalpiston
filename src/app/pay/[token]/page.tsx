import type { Metadata } from 'next'
import CheckoutClient from './CheckoutClient'

// Always render fresh — never serve a cached snapshot of a payment request.
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

type PayData = {
  token: string
  coachName: string
  coachAvatar: string | null
  packageName: string | null
  amountCents: number
  currency: string
  billingInterval: 'monthly' | 'one_time'
  clientName: string | null
  status: 'pending' | 'paid' | 'cancelled' | 'expired'
  isRenewal: boolean
}

// Read the payment request directly from the DB with the service-role client
// (the payer has no account). Mirrors the /join/[slug] page approach so preview
// deployments always hit the correct database.
async function fetchPay(token: string): Promise<PayData | null> {
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
        global: { fetch: (url: any, options: any = {}) => fetch(url, { ...options, cache: 'no-store' }) },
      }
    )

    // Try with client_id (renewal flag); fall back if the column isn't present.
    let { data: pr } = await supabase
      .from('payment_requests')
      .select('coach_id, package_name, amount_cents, currency, billing_interval, client_name, status, token, client_id')
      .eq('token', token)
      .maybeSingle()
    if (!pr) {
      const retry = await supabase
        .from('payment_requests')
        .select('coach_id, package_name, amount_cents, currency, billing_interval, client_name, status, token')
        .eq('token', token)
        .maybeSingle()
      pr = retry.data
    }

    if (!pr) return null

    const { data: coach } = await supabase
      .from('users')
      .select('name, avatar_url')
      .eq('id', pr.coach_id)
      .maybeSingle()

    return {
      token: pr.token,
      coachName: coach?.name || 'Your coach',
      coachAvatar: coach?.avatar_url || null,
      packageName: pr.package_name,
      amountCents: pr.amount_cents,
      currency: pr.currency || 'usd',
      billingInterval: pr.billing_interval === 'monthly' ? 'monthly' : 'one_time',
      clientName: pr.client_name,
      status: pr.status,
      isRenewal: !!(pr as any).client_id,
    }
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Complete your payment — First Mile Coach' }
}

export default async function PayPage({ params }: { params: { token: string } }) {
  const pay = await fetchPay(params.token)

  if (!pay) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafbfc', padding: 24, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <div style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 30px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ background: '#ffffff', borderBottom: '1px solid #eef1f3', padding: '22px 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img src="https://www.firstmilecoach.com/firstmile/logo.png" alt="First Mile Coach" style={{ display: 'block', height: 72, width: 'auto' }} />
          </div>
          <div style={{ padding: '32px 28px', textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#2d3436', margin: '0 0 10px' }}>Payment link not found</h1>
            <p style={{ color: '#555b5e', fontSize: 15, lineHeight: 1.7, margin: 0 }}>This payment link is invalid or has expired. Please contact your coach for a new one.</p>
          </div>
        </div>
      </main>
    )
  }

  return <CheckoutClient pay={pay} />
}
