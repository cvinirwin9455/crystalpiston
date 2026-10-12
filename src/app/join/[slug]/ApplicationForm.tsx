'use client'

import { useState } from 'react'

type PackageData = {
  id: string
  name: string
  description: string | null
  priceCents: number
  currency: string
  billingInterval: 'monthly' | 'one_time'
}

type Page = {
  slug: string
  coachName: string
  coachAvatar: string | null
  headline: string
  intro: string
  pricing: string
  offerTypes: string[]
  offerFormats: string[]
  showPackages?: boolean
  packages?: PackageData[]
}

function formatPkgPrice(cents: number, currency: string, interval: string): string {
  const amount = (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  })
  return interval === 'monthly' ? `${amount}/mo` : `${amount}`
}

const ORANGE = '#f26522'

const TYPE_LABELS: Record<string, string> = {
  running: 'Running coaching',
  personal_training: 'Personal training',
}

// Delivery format labels shown when a package is selected
const DELIVERY_FORMAT_LABELS: Record<string, { label: string; desc: string }> = {
  programming: { label: 'Programming only', desc: 'Remote training plans you follow on your own' },
  in_person: { label: 'In-person sessions', desc: 'Train together with your coach' },
  hybrid: { label: 'Hybrid', desc: 'Combination of programming and in-person sessions' },
}

export default function ApplicationForm({ page }: { page: Page }) {
  const hasPackages = page.showPackages !== false && page.packages && page.packages.length > 0

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
    // Personal-training-specific
    pt_goal: '',
    training_experience: '',
    equipment_access: '',
    // In-person-specific
    preferred_location: '',
    sessions_per_week: '',
  })
  // Package selection (when coach has packages)
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  // Delivery format selection (shown after package is selected)
  const [selectedDeliveryFormat, setSelectedDeliveryFormat] = useState<string>('')
  // Prospect's selections for NO-packages flow (subset of what the coach offers)
  const [interestedTypes, setInterestedTypes] = useState<string[]>([])
  const [interestedFormats, setInterestedFormats] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) =>
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val])

  // --- Determine what delivery formats the coach offers (for the package flow) ---
  // Map offer_formats to the simplified delivery options
  const availableDeliveryFormats: string[] = []
  if (page.offerFormats.includes('programming')) availableDeliveryFormats.push('programming')
  if (page.offerFormats.includes('in_person')) availableDeliveryFormats.push('in_person')
  // If coach offers both programming AND in_person, also offer "hybrid" as an option
  if (page.offerFormats.includes('programming') && page.offerFormats.includes('in_person')) {
    availableDeliveryFormats.push('hybrid')
  }
  const singleDeliveryFormat = availableDeliveryFormats.length === 1 ? availableDeliveryFormats[0] : null

  // --- NO PACKAGES FLOW: use the tickbox approach ---
  const singleType = page.offerTypes.length === 1 ? page.offerTypes[0] : null
  const singleFormat = page.offerFormats.length === 1 ? page.offerFormats[0] : null

  // --- Determine which question sections to show ---
  let showRunning = false
  let showPT = false
  let showInPerson = false

  if (hasPackages) {
    // PACKAGES FLOW: questions depend on selectedDeliveryFormat (or auto if only one option)
    const effectiveDelivery = singleDeliveryFormat || selectedDeliveryFormat
    // For offer types, if coach only offers one type, use that; otherwise show both running + PT sections
    // (we could refine this later, but for now if coach offers PT they likely want those questions)
    showRunning = page.offerTypes.includes('running')
    showPT = page.offerTypes.includes('personal_training')
    // In-person questions show if delivery is in_person or hybrid
    showInPerson = effectiveDelivery === 'in_person' || effectiveDelivery === 'hybrid'
  } else {
    // NO PACKAGES FLOW: questions depend on tickbox selections
    const effectiveTypes = singleType ? [singleType] : interestedTypes
    const effectiveFormats = singleFormat ? [singleFormat] : interestedFormats
    showRunning = effectiveTypes.includes('running')
    showPT = effectiveTypes.includes('personal_training')
    showInPerson = effectiveFormats.includes('in_person')
  }

  // Should we show the questions section? (need delivery format selected in packages flow, or tickboxes in no-packages flow)
  const showQuestions = hasPackages
    ? !!(singleDeliveryFormat || selectedDeliveryFormat)
    : true // no-packages flow always shows questions based on tickboxes

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (hasPackages) {
      // PACKAGES FLOW validation
      if (!selectedPackageId) {
        setError('Please select a coaching package.')
        return
      }
      if (!singleDeliveryFormat && !selectedDeliveryFormat) {
        setError('Please choose how you\'d like to train.')
        return
      }
    } else {
      // NO PACKAGES FLOW validation
      if (!singleType && interestedTypes.length === 0) {
        setError("Please choose what you're interested in.")
        return
      }
      if (!singleFormat && interestedFormats.length === 0) {
        setError("Please choose how you'd like to train.")
        return
      }
    }

    setLoading(true)
    setError(null)

    let userIp = 'unknown'
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json')
      userIp = (await ipRes.json()).ip
    } catch {
      /* non-blocking */
    }

    // Build interested_types and interested_formats for the submission
    let submitTypes: string[]
    let submitFormats: string[]

    if (hasPackages) {
      // Use all coach's offer types (they apply regardless of delivery format)
      submitTypes = page.offerTypes
      // Map delivery format back to interested_formats
      const delivery = singleDeliveryFormat || selectedDeliveryFormat
      if (delivery === 'hybrid') {
        submitFormats = ['programming', 'in_person']
      } else {
        submitFormats = [delivery]
      }
    } else {
      submitTypes = singleType ? [singleType] : interestedTypes
      submitFormats = singleFormat ? [singleFormat] : interestedFormats
    }

    try {
      const res = await fetch(`/api/apply/${encodeURIComponent(page.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          selected_package_id: hasPackages ? selectedPackageId : null,
          interested_types: submitTypes,
          interested_formats: submitFormats,
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
        <div style={{ background: '#ffffff', borderBottom: '1px solid #eef1f3', padding: '22px 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <img src="https://www.firstmilecoach.com/firstmile/logo.png" alt="First Mile Coach" style={{ display: 'block', height: 72, width: 'auto' }} />
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
          {/* Show legacy pricing text only if coach has NO packages */}
          {!hasPackages && page.pricing && (
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

            {/* --- NO PACKAGES FLOW: What are you interested in? (only if coach offers 2+ types) --- */}
            {!hasPackages && !singleType && page.offerTypes.length > 1 && (
              <div style={{ ...groupStyle, marginTop: 22 }}>
                <label style={labelStyle}>What are you interested in? *</label>
                {page.offerTypes.map((t) => (
                  <label key={t} style={checkRow}>
                    <input type="checkbox" checked={interestedTypes.includes(t)} onChange={() => toggle(interestedTypes, setInterestedTypes, t)} />
                    <span>{TYPE_LABELS[t] || t}</span>
                  </label>
                ))}
              </div>
            )}

            {/* --- NO PACKAGES FLOW: How would you like to train? (only if coach offers 2+ formats) --- */}
            {!hasPackages && !singleFormat && page.offerFormats.length > 1 && (
              <div style={groupStyle}>
                <label style={labelStyle}>How would you like to train? *</label>
                {page.offerFormats.map((f) => (
                  <label key={f} style={checkRow}>
                    <input type="checkbox" checked={interestedFormats.includes(f)} onChange={() => toggle(interestedFormats, setInterestedFormats, f)} />
                    <span>{f === 'programming' ? 'Programming only (remote — I follow a plan on my own)' : f === 'in_person' ? 'In-person training (sessions with you)' : f}</span>
                  </label>
                ))}
              </div>
            )}

            {/* --- PACKAGES FLOW: Package selection with delivery format picker --- */}
            {hasPackages && (
              <div style={{ ...groupStyle, marginTop: 22 }}>
                <label style={labelStyle}>Which package are you interested in? *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {page.packages!.map((pkg) => {
                    const isSelected = selectedPackageId === pkg.id
                    return (
                      <div key={pkg.id}>
                        <label
                          style={{
                            ...packageOption,
                            borderColor: isSelected ? ORANGE : '#dfe3e6',
                            background: isSelected ? '#fff8f4' : '#fff',
                            borderBottomLeftRadius: isSelected && !singleDeliveryFormat ? 0 : 10,
                            borderBottomRightRadius: isSelected && !singleDeliveryFormat ? 0 : 10,
                          }}
                        >
                          <input
                            type="radio"
                            name="selected_package"
                            value={pkg.id}
                            checked={isSelected}
                            onChange={() => {
                              setSelectedPackageId(pkg.id)
                              // Reset delivery format when changing package
                              if (!singleDeliveryFormat) setSelectedDeliveryFormat('')
                            }}
                            style={{ marginRight: 12, accentColor: ORANGE }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 700, color: '#2d3436' }}>{pkg.name}</span>
                            {pkg.description && <span style={{ display: 'block', fontSize: 12, color: '#8a8f93', marginTop: 2 }}>{pkg.description}</span>}
                          </div>
                          <span style={{ fontWeight: 800, color: ORANGE, marginLeft: 12, whiteSpace: 'nowrap' }}>
                            {formatPkgPrice(pkg.priceCents, pkg.currency, pkg.billingInterval)}
                          </span>
                        </label>

                        {/* Delivery format picker - expands under selected package */}
                        {isSelected && !singleDeliveryFormat && (
                          <div style={deliveryFormatBox}>
                            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#2d3436' }}>
                              How would you like to work with {page.coachName.split(' ')[0]}?
                            </p>
                            {availableDeliveryFormats.map((fmt) => (
                              <label
                                key={fmt}
                                style={{
                                  ...deliveryOption,
                                  borderColor: selectedDeliveryFormat === fmt ? ORANGE : '#e8eaec',
                                  background: selectedDeliveryFormat === fmt ? '#fff' : '#fafbfc',
                                }}
                              >
                                <input
                                  type="radio"
                                  name="delivery_format"
                                  value={fmt}
                                  checked={selectedDeliveryFormat === fmt}
                                  onChange={() => setSelectedDeliveryFormat(fmt)}
                                  style={{ marginRight: 10, accentColor: ORANGE }}
                                />
                                <div>
                                  <span style={{ fontWeight: 600, color: '#2d3436' }}>{DELIVERY_FORMAT_LABELS[fmt]?.label || fmt}</span>
                                  <span style={{ display: 'block', fontSize: 12, color: '#8a8f93', marginTop: 1 }}>{DELIVERY_FORMAT_LABELS[fmt]?.desc || ''}</span>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={groupStyle}>
              <label style={labelStyle}>Primary goal</label>
              <input style={inputStyle} value={form.primary_goal} onChange={set('primary_goal')} placeholder="What are you hoping to achieve?" />
            </div>
            <div style={groupStyle}>
              <label style={labelStyle}>Days available to train</label>
              <input style={inputStyle} value={form.days_available} onChange={set('days_available')} placeholder="e.g. Mon/Wed/Fri + weekends" />
            </div>

            {/* --- Running block (only show when questions should be visible) --- */}
            {showQuestions && showRunning && (
              <div style={sectionBox}>
                <p style={sectionTitle}>About your running</p>
                <div style={groupStyle}>
                  <label style={labelStyle}>Running experience &amp; current weekly mileage</label>
                  <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={form.running_experience} onChange={set('running_experience')} placeholder="e.g. Running 3 years, ~25 miles/week" />
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Target race / date</label>
                  <input style={inputStyle} value={form.target_race} onChange={set('target_race')} placeholder="e.g. NYC Marathon, Nov 2027" />
                </div>
                <div style={{ ...groupStyle, marginBottom: 0 }}>
                  <label style={labelStyle}>Current PRs (if any)</label>
                  <input style={inputStyle} value={form.current_prs} onChange={set('current_prs')} placeholder="e.g. 5K 22:30, half 1:45" />
                </div>
              </div>
            )}

            {/* --- Personal training block (only show when questions should be visible) --- */}
            {showQuestions && showPT && (
              <div style={sectionBox}>
                <p style={sectionTitle}>About your training</p>
                <div style={groupStyle}>
                  <label style={labelStyle}>Main goal</label>
                  <select style={inputStyle} value={form.pt_goal} onChange={set('pt_goal')}>
                    <option value="">Select…</option>
                    <option value="build_strength">Build strength</option>
                    <option value="lose_weight">Lose weight</option>
                    <option value="general_fitness">General fitness</option>
                    <option value="muscle_gain">Muscle gain</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div style={groupStyle}>
                  <label style={labelStyle}>Training experience</label>
                  <select style={inputStyle} value={form.training_experience} onChange={set('training_experience')}>
                    <option value="">Select…</option>
                    <option value="new">New to training</option>
                    <option value="some">Some experience</option>
                    <option value="experienced">Experienced</option>
                  </select>
                </div>
                <div style={{ ...groupStyle, marginBottom: 0 }}>
                  <label style={labelStyle}>Where will you train &amp; what equipment do you have?</label>
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.equipment_access} onChange={set('equipment_access')} placeholder="e.g. Full gym membership / home with dumbbells + bands" />
                </div>
              </div>
            )}

            {/* --- In-person block (only show when questions should be visible) --- */}
            {showQuestions && showInPerson && (
              <div style={sectionBox}>
                <p style={sectionTitle}>In-person sessions</p>
                <div style={groupStyle}>
                  <label style={labelStyle}>Preferred location / area</label>
                  <input style={inputStyle} value={form.preferred_location} onChange={set('preferred_location')} placeholder="e.g. Downtown gym, your area, etc." />
                </div>
                <div style={{ ...groupStyle, marginBottom: 0 }}>
                  <label style={labelStyle}>How many sessions per week are you after?</label>
                  <input style={inputStyle} value={form.sessions_per_week} onChange={set('sessions_per_week')} placeholder="e.g. 2 per week" />
                </div>
              </div>
            )}

            <div style={groupStyle}>
              <label style={labelStyle}>Injuries / limitations</label>
              <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.injuries} onChange={set('injuries')} placeholder="Anything your coach should know" />
            </div>
            {/* Only show free-text plan interest if coach has NO packages (legacy/fallback) */}
            {!hasPackages && page.pricing && (
              <div style={groupStyle}>
                <label style={labelStyle}>Which plan are you interested in?</label>
                <input style={inputStyle} value={form.plan_interest} onChange={set('plan_interest')} placeholder="Name the one from above, or 'not sure yet'" />
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
const checkRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', marginBottom: 8,
  border: '1px solid #dfe3e6', borderRadius: 10, fontSize: 14, color: '#2d3436', cursor: 'pointer', lineHeight: 1.4,
}
const packageOption: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '12px 14px',
  border: '2px solid #dfe3e6', borderRadius: 10, fontSize: 14, color: '#2d3436', cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s',
}
const deliveryFormatBox: React.CSSProperties = {
  padding: '14px 16px', background: '#fff8f4', border: '2px solid #f26522', borderTop: 'none',
  borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
}
const deliveryOption: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 6, padding: '10px 12px', marginBottom: 8,
  border: '1px solid #e8eaec', borderRadius: 8, fontSize: 14, cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s',
}
const sectionBox: React.CSSProperties = {
  margin: '0 0 16px', padding: 16, background: '#fafbfc', border: '1px solid #eef1f3', borderRadius: 12,
}
const sectionTitle: React.CSSProperties = {
  margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#2d3436', textTransform: 'uppercase', letterSpacing: 0.4,
}
