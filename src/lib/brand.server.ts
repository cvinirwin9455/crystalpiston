import { headers } from 'next/headers'
import { getBrandFromHost } from './brand'
import type { BrandConfig } from './brand'

/**
 * Detect brand from the request hostname (server-side only).
 * Uses next/headers — only call this from Server Components or Route Handlers.
 */
export async function getBrand(): Promise<BrandConfig> {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  return getBrandFromHost(host)
}
