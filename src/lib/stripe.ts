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

// The platform's Connect OAuth client id (ca_...). Required for the OAuth
// "connect your existing Stripe account" flow. Found in the Stripe dashboard
// under Connect settings.
export function getConnectClientId(): string | null {
  return process.env.STRIPE_CONNECT_CLIENT_ID || null
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  if (!_stripe) {
    // Intentionally do NOT pin apiVersion — let the installed SDK use its own
    // default so the request shapes we send always match the types the SDK was
    // built against.
    // Note: do NOT pass `clientId` here — it is not a valid Stripe config key
    // in current SDK versions and causes a "Config object may only contain..."
    // error. We pass client_id explicitly on the OAuth authorizeUrl call instead.
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      appInfo: { name: 'First Mile Coach', url: 'https://www.firstmilecoach.com' },
    })
  }
  return _stripe
}
