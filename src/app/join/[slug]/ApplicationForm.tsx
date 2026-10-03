'use client'

import { useState } from 'react'

type Page = {
  slug: string
  coachName: string
  coachAvatar: string | null
  headline: string
  intro: string
  pricing: string
}

const ORANGE = '#f26522'

export default function ApplicationForm({ page }: { page: Page }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    age: '',
    sex: '',
    running_experience: '',
    primary_goal: '',
    target_race: '',
    days_available: '',
    current_prs: '',
    injuries: '',
    plan_interest: '',
    why_coaching: '',
  })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    let userIp = 'unknown'
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json')
      userIp = (await ipRes.json()).ip
    } catch {
      /* non-blocking */
    }

    try {
      const res = await fetch(`/api/apply/${encodeURIComponent(page.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          consent_ip: userIp,
          consent_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || `Something went wrong (${res.status}).`)
      } else {
        setDone(true)
      }
    } catch (err: any) {
      setError(`Network error: ${err?.message || 'could not reach server'}`)
    } finally {
      setLoading(false)
    }
  }

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#2d3436', marginBottom: 6 }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 13px', fontSize: 15, border: '1px solid #dfe3e6',
    borderRadius: 10, outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#2d3436',
  }
  const groupStyle: React.CSSProperties = { marginBottom: 16 }

  if (done) {
    return (
      <main style={pageWrap}>
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <img src="https://www.firstmilecoach.com/firstmile/logo.png" alt="First Mile Coach" width={150} style={{ marginBottom: 24 }} />
          <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
          <h1 style={{ fontSize: 22, color: '#2d3436', margin: '0 0 10px' }}>Application sent!</h1>
          <p style={{ color: '#555b5e', fontSize: 15, lineHeight: 1.7, margin: 0 }}>
            Thanks for applying to train with <strong>{page.coachName}</strong>. They&apos;ll review your
            application and reach out to you soon.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main style={pageWrap}>
      <div style={card}>
        {/* First Mile branding strip (white, logo at a legible size) */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid #eef1f3', padding: '18px 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <img src="https://www.firstmilecoach.com/firstmile/logo.png" alt="First Mile Coach" style={{ display: 'block', height: 40, width: 'auto' }} />
        </div>

        {/* Coach hero: avatar + name centered */}
        <div style={{ padding: '28px 28px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          {page.coachAvatar ? (
            <img src={page.coachAvatar} alt={page.coachName} width={84} height={84} style={{ borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }} />
          ) : (
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: '#f26522', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800 }}>
              {(page.coachName || '?').trim().charAt(0).toUpperCase()}
            </div>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#2d3436', margin: '16px 0 0', lineHeight: 1.25 }}>{page.headline}</h1>
        </div>

        <div style={{ padding: '12px 28px 32px' }}>
          {page.intro && (
            <p style={{ fontSize: 15, color: '#555b5e', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: '8px 0 20px', textAlign: 'center' }}>{page.intro}</p>
          )}
          {page.pricing && (
            <div style={{ margin: '0 0 24px', padding: 18, background: '#fff8f4', borderRadius: 12, border: '1px solid rgba(242,101,34,0.15)' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#2d3436', textTransform: 'uppercase', letterSpacing: 0.4 }}>Coaching Plans</p>
              <p style={{ margin: 0, fontSize: 14, color: '#555b5e', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{page.pricing}</p>
            </div>
          )}

          <div style={{ height: 1, background: '#eef1f3', margin: '4px 0 24px' }} />
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#2d3436', margin: '0 0 4px' }}>Your details</h2>
          <p style={{ fontSize: 13, color: '#9aa0a4', margin: '0 0 20px' }}>Tell {page.coachName.split(' ')[0]} about yourself. Fields marked * are required.</p>

          <form onSubmit={handleSubmit}>
            <div style={groupStyle}>
              <label style={labelStyle}>Full name *</label>
              <input style={inputStyle} value={form.full_name} onChange={set('full_name')} required placeholder="Your full name" />
            </div>
            <div style={groupStyle}>
              <label style={labelStyle}>Email *</label>
              <input style={inputStyle} type="email" value={form.email} onChange={set('email')} required placeholder="you@example.com" />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ ...groupStyle, flex: 1 }}>
                <label style={labelStyle}>Phone</label>
                <input style={inputStyle} value={form.phone} onChange={set('phone')} placeholder="(555) 123-4567" />
              </div>
              <div style={{ ...groupStyle, width: 90 }}>
                <label style={labelStyle}>Age</label>
                <input style={inputStyle} type="number" min="0" value={form.age} onChange={set('age')} placeholder="30" />
              </div>
            </div>
            <div style={groupStyle}>
              <label style={labelStyle}>Sex</label>
              <select style={inputStyle} value={form.sex} onChange={set('sex')}>
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={groupStyle}>
              <label style={labelStyle}>Running experience &amp; current weekly mileage</label>
              <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={form.running_experience} onChange={set('running_experience')} placeholder="e.g. Running 3 years, ~25 miles/week" />
            </div>
            <div style={groupStyle}>
              <label style={labelStyle}>Primary goal</label>
              <input style={inputStyle} value={form.primary_goal} onChange={set('primary_goal')} placeholder="e.g. First marathon, 5K PR" />
            </div>
            <div style={groupStyle}>
              <label style={labelStyle}>Target race / date</label>
              <input style={inputStyle} value={form.target_race} onChange={set('target_race')} placeholder="e.g. NYC Marathon, Nov 2027" />
            </div>
            <div style={groupStyle}>
              <label style={labelStyle}>Days available to train</label>
              <input style={inputStyle} value={form.days_available} onChange={set('days_available')} placeholder="e.g. Mon/Wed/Fri + weekends" />
            </div>
            <div style={groupStyle}>
              <label style={labelStyle}>Current PRs (if any)</label>
              <input style={inputStyle} value={form.current_prs} onChange={set('current_prs')} placeholder="e.g. 5K 22:30, half 1:45" />
            </div>
            <div style={groupStyle}>
              <label style={labelStyle}>Injuries / limitations</label>
              <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.injuries} onChange={set('injuries')} placeholder="Anything your coach should know" />
            </div>
            {page.pricing && (
              <div style={groupStyle}>
                <label style={labelStyle}>Which plan are you interested in?</label>
                <input style={inputStyle} value={form.plan_interest} onChange={set('plan_interest')} placeholder="Name the plan from above, or 'not sure yet'" />
              </div>
            )}
            <div style={groupStyle}>
              <label style={labelStyle}>Why are you looking for coaching?</label>
              <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.why_coaching} onChange={set('why_coaching')} placeholder="A sentence or two about what you're after" />
            </div>

            {error && (
              <div style={{ margin: '0 0 16px', padding: '12px 14px', borderRadius: 10, background: '#fdecea', color: '#b3261e', fontSize: 14 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px 0', fontSize: 16, fontWeight: 700, color: '#fff',
                background: ORANGE, border: 'none', borderRadius: 50, cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Sending…' : 'Submit Application'}
            </button>
          </form>
        </div>

        <div style={{ padding: '18px 28px', borderTop: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', background: '#fafbfc' }}>
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
  width: '100%', maxWidth: 520, background: '#fff', borderRadius: 16,
  border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden', boxShadow: '0 4px 30px rgba(0,0,0,0.06)',
}
