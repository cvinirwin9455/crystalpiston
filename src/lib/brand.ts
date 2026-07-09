export type BrandConfig = {
  slug: 'crystal-pistol' | 'first-mile'
  name: string
  tagline: string
  domain: string
  logoUrl: string
  faviconUrl: string
  primaryColor: string
  orgId: string
  // SEO
  title: string
  description: string
  ogUrl: string
  // Login
  loginHeading: string
  loginSubtext: string
  loginLogo: string
  // Theme
  theme: 'dark' | 'light'
}

const BRANDS: Record<string, BrandConfig> = {
  'crystal-pistol': {
    slug: 'crystal-pistol',
    name: 'Pistol Performance Coaching',
    tagline: 'From 5K to 100 miles.',
    domain: 'crystalpistolperformance.com',
    logoUrl: '/IMG_5861.PNG',
    faviconUrl: '/favicon.ico',
    primaryColor: '#e94560',
    orgId: 'fffa6f6b-8226-40d9-9e49-ff17164334f4',
    title: 'Pistol Performance Coaching | Crystal - Running Coach',
    description: 'From 5K to 100 miles. Whether you\'re getting off the couch or breaking through a plateau, Crystal helps you set goals and crush them. Southwest Missouri running coach.',
    ogUrl: 'https://www.crystalpistolperformance.com',
    loginHeading: 'Client Portal',
    loginSubtext: 'Log in to track your training progress',
    loginLogo: '/IMG_5861.PNG',
    theme: 'dark',
  },
  'first-mile': {
    slug: 'first-mile',
    name: 'First Mile Coach',
    tagline: 'The $1/month platform for new coaches.',
    domain: 'firstmilecoach.com',
    logoUrl: '/firstmile/logo.png',
    faviconUrl: '/firstmile/favicon.png',
    primaryColor: '#f26522',
    orgId: '1eb9b481-b6b6-455c-b733-fee789803a17',
    title: 'First Mile Coach',
    description: 'Launch your coaching business for just $1 a month. Built for new running coaches and personal trainers getting their first clients.',
    ogUrl: 'https://firstmilecoach.com',
    loginHeading: 'Coach Login',
    loginSubtext: 'Log in to manage your clients',
    loginLogo: '/firstmile/logo.png',
    theme: 'light',
  },
}

/**
 * Detect brand from a hostname string (works client or server side).
 * No server-only imports — safe to use in client components.
 */
export function getBrandFromHost(host: string): BrandConfig {
  const hostname = host.split(':')[0].toLowerCase()

  if (hostname.includes('firstmilecoach')) {
    return BRANDS['first-mile']
  }

  // Default to Crystal Pistol (covers crystalpistolperformance.com, localhost, preview URLs)
  return BRANDS['crystal-pistol']
}

/**
 * Get brand config by slug directly.
 */
export function getBrandBySlug(slug: string): BrandConfig {
  return BRANDS[slug] || BRANDS['crystal-pistol']
}
