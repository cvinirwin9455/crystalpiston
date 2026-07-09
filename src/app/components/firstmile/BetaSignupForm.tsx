'use client'

import { useState } from 'react'

export default function BetaSignupForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [coachingType, setCoachingType] = useState('')
  const [expectedClients, setExpectedClients] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // Get IP for consent record
    let userIp = 'unknown'
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json')
      const ipData = await ipRes.json()
      userIp = ipData.ip
    } catch {
      // IP detection failed — still submit
    }

    try {
      const res = await fetch('/api/beta-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          coaching_type: coachingType,
          expected_clients: expectedClients,
          agreed_to_terms: agreeTerms,
          consent_ip: userIp,
          consent_user_agent: navigator.userAgent,
          consent_terms_version: 'v1-july-2026',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage({ text: data.error || 'Something went wrong. Please try again or email us directly.', type: 'error' })
      } else if (data.duplicate) {
        setMessage({ text: data.message, type: 'info' })
      } else {
        setMessage({ text: data.message, type: 'success' })
        setFullName('')
        setEmail('')
        setCoachingType('')
        setExpectedClients('')
        setAgreeTerms(false)
      }
    } catch (err) {
      console.error('Submission error:', err)
      setMessage({ text: 'Something went wrong. Please try again or email us directly.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fmc-beta-form-wrapper fmc-fade-in">
      <h3>Apply for Beta Access</h3>
      <form onSubmit={handleSubmit}>
        <div className="fmc-form-group">
          <label htmlFor="fmc-full-name">Full Name</label>
          <input
            type="text"
            id="fmc-full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Your full name"
          />
        </div>

        <div className="fmc-form-group">
          <label htmlFor="fmc-email">Email</label>
          <input
            type="email"
            id="fmc-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
        </div>

        <div className="fmc-form-group">
          <label htmlFor="fmc-coaching-type">What type of coaching do you do?</label>
          <select
            id="fmc-coaching-type"
            value={coachingType}
            onChange={(e) => setCoachingType(e.target.value)}
            required
          >
            <option value="" disabled>Select one...</option>
            <option value="running_coach">Running Coach</option>
            <option value="personal_trainer">Personal Trainer</option>
            <option value="both">Both</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="fmc-form-group">
          <label htmlFor="fmc-expected-clients">How many clients do you expect to bring on during the beta?</label>
          <input
            type="number"
            id="fmc-expected-clients"
            value={expectedClients}
            onChange={(e) => setExpectedClients(e.target.value)}
            required
            placeholder="e.g. 10"
            min="1"
          />
        </div>

        <div className="fmc-form-group fmc-form-group-checkbox">
          <label className="fmc-checkbox-label">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              required
            />
            <span>
              I&apos;ve read and agree to the{' '}
              <a href="/terms" target="_blank">Beta Testing Terms &amp; Conditions</a>
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="fmc-beta-submit-btn"
        >
          {loading ? 'Submitting...' : 'Join the Beta'}
        </button>

        {message && (
          <div className={`fmc-form-message fmc-form-message-${message.type}`}>
            {message.text}
          </div>
        )}
      </form>
    </div>
  )
}
