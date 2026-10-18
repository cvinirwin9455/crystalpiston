// ─── Go-live guard ───────────────────────────────────────────────────────────
// Loud reminder in the build logs when this build is using LIVE Stripe keys.
// Flipping to live = real money. Before trusting it, work through the checklist
// in docs/stripe-go-live.md (live webhook, env vars, $1 charge + refund test,
// and the reliability fixes #1–#3 from docs/stripe-review.md).
;(() => {
  const sk = process.env.STRIPE_SECRET_KEY || ''
  const cc = process.env.STRIPE_CONNECT_CLIENT_ID || ''
  const isLive = sk.startsWith('sk_live_') || cc.startsWith('ca_live_')
  if (isLive) {
    console.warn('\n' + '='.repeat(72))
    console.warn('🚨 STRIPE IS IN *LIVE* MODE — real money will move.')
    console.warn('   Before relying on this, complete docs/stripe-go-live.md:')
    console.warn('   • live webhook registered + live signing secret set')
    console.warn('   • $1 real charge + refund, and $1/mo subscription + cancel')
    console.warn('   • reliability fixes #1–#3 from docs/stripe-review.md')
    console.warn('='.repeat(72) + '\n')
  }
})()

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Force chunk hash regeneration
  generateBuildId: async () => {
    return `build-${Date.now()}`
  },
  headers: async () => {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
