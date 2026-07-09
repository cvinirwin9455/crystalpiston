'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const FIRST_MILE_ORG_ID = '1cb9b481-b6b6-455c-b733-fce789803a17'

export default function BetaSignupForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [coachingType, setCoachingType] = useState('')
  const [expectedClients, setExpectedClients] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  const supabase = createClient()

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

    const formData = {
      organization_id: FIRST_MILE_ORG_ID,
      full_name: fullName.trim(),
      email: email.trim(),
      coaching_type: coachingType,
      expected_clients: parseInt(expectedClients),
      agreed_to_terms: agreeTerms,
      signed_up_at: new Date().toISOString(),
      consent_ip: userIp,
      consent_user_agent: navigator.userAgent,
      consent_terms_version: 'v1-july-2026',
    }

    try {
      const { error } = await supabase
        .from('beta_signups')
        .insert([formData])

      if (error) {
        if (error.code === '23505') {
          setMessage({ text: "You've already signed up! We'll be in touch soon.", type: 'info' })
        } else {
          setMessage({ text: `DB error ${error.code}: ${error.message}`, type: 'error' })
        }
      } else {
        setMessage({ text: "You're in! We'll be in touch with next steps soon.", type: 'success' })
        setFullName('')
        setEmail('')
        setCoachingType('')
        setExpectedClients('')
        setAgreeTerms(false)
      }
    } catch (err: any) {
      console.error('Submission error:', err)
      const detail = err?.message || err?.error_description || JSON.stringify(err)
      setMessage({ text: `Error: ${detail}`, type: 'error' })
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
