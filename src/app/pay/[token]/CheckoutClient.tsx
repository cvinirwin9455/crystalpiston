'use client'

import { useEffect, useState } from 'react'

type PayData = {
  token: string
  coachName: string
  coachAvatar: string | null
  packageName: string | null
  amountCents: number
  currency: string
  billingInterval: 'monthly' | 'one_time'
  recurMonths?: number | null
  clientName: string | null
  status: 'pending' | 'paid' | 'cancelled' | 'expired'
  isRenewal?: boolean
}

const ORANGE = '#f26522'

function formatAmount(cents: number, currency: string): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  })
}

export default function CheckoutClient({ pay }: { pay: PayData }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 'form' | 'paid' | 'confirming' | 'cancelled'
  const [view, setView] = useState<'form' | 'paid' | 'confirming' | 'cancelled'>(
    pay.status === 'paid' ? 'paid' : 'form'
  )

  // On return from Stripe (?status=success|cancelled), confirm/fulfill.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status')
    if (status === 'success') {
      setView('confirming')
      confirmPayment()
    } else if (status === 'cancelled') {
      setView('cancelled')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function confirmPayment(attempt = 1) {
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(pay.token)}/confirm`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.status === 'paid') {
        setView('paid')
        return
      }
      // Stripe may not have finalized the session yet — retry a few times.
      if (attempt < 4) {
        setTimeout(() => confirmPayment(attempt + 1), 1500)
        return
      }
      // Still not confirmed after retries — show paid (their card WAS charged)
      // but we couldn't finalize provisioning. The webhook is the backstop.
      setView('paid')
    } catch {
      if (attempt < 4) {
        setTimeout(() => confirmPayment(attempt + 1), 1500)
        return
      }
      setView('paid')
    }
  }

  async function startCheckout() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(pay.token)}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not start checkout. Please try again.')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const amount = formatAmount(pay.amountCents, pay.currency)
  const first = (pay.clientName || '').split(' ')[0] || 'there'

  // Subscription (monthly) presentation.
  const isSubscription = pay.billingInterval === 'monthly'
  const months = pay.recurMonths && pay.recurMonths > 0 ? pay.recurMonths : null
  // "US$75/month" for subscriptions; plain amount for one-time.
  const amountDisplay = isSubscription ? `${amount}/mo` : amount
  // Human description of the billing terms, shown under the package name.
  const termsLine = isSubscription
    ? (months
        ? `Billed monthly for ${months} month${months === 1 ? '' : 's'}`
        : 'Billed monthly until cancelled')
    : 'One-time payment'
  // Button label.
  const payLabel = isSubscription ? `Subscribe · ${amount}/mo` : `Pay ${amount}`

  return (
    <main style={pageWrap}>
      <div style={card}>
        <div style={{ background: '#fff', borderBottom: '1px solid #eef1f3', padding: '22px 0', display: 'flex', justifyContent: 'center' }}>
          <img src="https://www.firstmilecoach.com/firstmile/logo.png" alt="First Mile Coach" style={{ display: 'block', height: 64, width: 'auto' }} />
        </div>

        {view === 'paid' ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
            <h1 style={{ fontSize: 22, color: '#2d3436', margin: '0 0 10px' }}>
              {isSubscription ? "You're subscribed!" : 'Payment complete!'}
            </h1>
            <p style={{ color: '#555b5e', fontSize: 15, lineHeight: 1.7, margin: '0 0 14px' }}>
              {pay.isRenewal
                ? <>Thanks, {first}! Your payment to <strong>{pay.coachName}</strong> was successful. Your coaching continues — your new plan is now active in your account.</>
                : <>Thanks, {first}! Your payment to <strong>{pay.coachName}</strong> was successful. Check your email for a link to set your password and access your training.</>}
            </p>
            {isSubscription && (
              <div style={{ margin: '0 auto', maxWidth: 360, padding: '14px 16px', borderRadius: 12, background: '#f6f8f9', border: '1px solid #eef1f3', textAlign: 'left' }}>
                <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#2d3436' }}>Your subscription</p>
                <p style={{ margin: 0, fontSize: 13, color: '#555b5e', lineHeight: 1.6 }}>
                  <strong>{pay.packageName || 'Coaching'}</strong> — {amount}/month{months ? ` for ${months} month${months === 1 ? '' : 's'}` : ', ongoing until cancelled'}.
                  You&apos;ll be billed automatically each month. To cancel, just reach out to {pay.coachName}.
                </p>
              </div>
            )}
          </div>
        ) : view === 'confirming' ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <h1 style={{ fontSize: 20, color: '#2d3436', margin: '0 0 10px' }}>Confirming your payment…</h1>
            <p style={{ color: '#555b5e', fontSize: 14, margin: 0 }}>One moment.</p>
          </div>
        ) : (
          <div style={{ padding: '28px 28px 32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 20 }}>
              {pay.coachAvatar ? (
                <img src={pay.coachAvatar} alt={pay.coachName} width={72} height={72} style={{ borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: ORANGE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800 }}>
                  {(pay.coachName || '?').trim().charAt(0).toUpperCase()}
                </div>
              )}
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#2d3436', margin: '14px 0 2px' }}>Complete your payment</h1>
              <p style={{ fontSize: 14, color: '#9aa0a4', margin: 0 }}>Coaching with {pay.coachName}</p>
            </div>

            {view === 'cancelled' && (
              <div style={{ margin: '0 0 16px', padding: '12px 14px', borderRadius: 10, background: '#fff6ec', color: '#9a5b1e', fontSize: 14 }}>
                Payment cancelled — no charge was made. You can try again below.
              </div>
            )}

            <div style={{ border: '1px solid #eef1f3', borderRadius: 12, padding: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#2d3436' }}>{pay.packageName || 'Coaching'}</span>
                <span style={{ fontWeight: 800, color: ORANGE, fontSize: 18 }}>{amountDisplay}</span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9aa0a4' }}>{termsLine}</p>
            </div>

            {isSubscription && (
              <div style={{ margin: '0 0 20px', padding: '14px 16px', borderRadius: 12, background: '#fff6ec', border: '1px solid #ffe0c2' }}>
                <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#9a5b1e' }}>🔄 This is a monthly subscription</p>
                <p style={{ margin: 0, fontSize: 13, color: '#9a5b1e', lineHeight: 1.6 }}>
                  You&apos;ll be charged <strong>{amount}</strong> today and then <strong>{amount} every month</strong>
                  {months
                    ? <> for <strong>{months} month{months === 1 ? '' : 's'}</strong>, after which it ends automatically.</>
                    : <>, until you or {pay.coachName} cancels it.</>}
                  {' '}You can ask {pay.coachName} to cancel anytime.
                </p>
              </div>
            )}

            {error && (
              <div style={{ margin: '0 0 16px', padding: '12px 14px', borderRadius: 10, background: '#fdecea', color: '#b3261e', fontSize: 14 }}>
                {error}
              </div>
            )}

            <button
              onClick={startCheckout}
              disabled={loading}
              style={{
                width: '100%', padding: '14px 0', fontSize: 16, fontWeight: 700, color: '#fff',
                background: ORANGE, border: 'none', borderRadius: 50, cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Redirecting…' : payLabel}
            </button>
            <p style={{ margin: '14px 0 0', fontSize: 12, color: '#9aa0a4', textAlign: 'center', lineHeight: 1.6 }}>
              {isSubscription
                ? 'Payment is handled securely by Stripe. You can cancel your monthly subscription at any time by contacting your coach.'
                : pay.isRenewal
                  ? 'Payment is handled securely by Stripe. Your coaching continues once your payment completes.'
                  : 'Payment is handled securely by Stripe. Your First Mile account is created once your payment completes.'}
            </p>
          </div>
        )}

        <div style={{ padding: '16px 28px', borderTop: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', background: '#fafbfc' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#9e9e9e' }}>Powered by First Mile Coach</p>
        </div>
      </div>
    </main>
  )
}

const pageWrap: React.CSSProperties = {
  minHeight: '100vh', background: '#fafbfc', padding: '40px 16px',
  display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}
const card: React.CSSProperties = {
  width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16,
  border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden', boxShadow: '0 4px 30px rgba(0,0,0,0.06)',
}
