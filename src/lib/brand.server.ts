import { headers } from 'next/headers'
import { getBrandFromHost, getBrandBySlug } from './brand'
import type { BrandConfig } from './brand'

/**
 * Detect brand from the request hostname (server-side only).
 * Uses next/headers — only call this from Server Components or Route Handlers.
 *
 * Supports ?brand=first-mile or ?brand=crystal-pistol query param override
 * for development/preview purposes (passed via middleware as x-brand-override header).
 */
export async function getBrand(): Promise<BrandConfig> {
  const headersList = await headers()
  const host = headersList.get('host') || ''

  // Check for brand override (set by middleware from ?brand= query param)
  const brandOverride = headersList.get('x-brand-override')
  if (brandOverride) {
    const overriddenBrand = getBrandBySlug(brandOverride)
    if (overriddenBrand) return overriddenBrand
  }

  return getBrandFromHost(host)
}
