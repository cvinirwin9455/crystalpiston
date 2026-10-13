import Stripe from 'stripe'

// Shared server-side Stripe client. The secret key is per-environment:
//   - Vercel Preview  -> Stripe TEST (sandbox) secret key
//   - Vercel Production -> Stripe LIVE secret key
// Never import this into a client component — it would leak the secret key.
//
// We lazily construct the client so that a missing key during build/prerender
// doesn't crash the whole app; routes that need Stripe check isStripeConfigured
// first and return a friendly error.

let _stripe: Stripe | null = null

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // Pin an API version for predictable behaviour across SDK upgrades.
      apiVersion: '2025-09-30.clover',
      appInfo: { name: 'First Mile Coach', url: 'https://www.firstmilecoach.com' },
    })
  }
  return _stripe
}
