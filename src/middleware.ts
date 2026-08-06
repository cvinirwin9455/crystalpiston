import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Rewrite /favicon.ico based on domain
  if (request.nextUrl.pathname === '/favicon.ico') {
    const host = request.headers.get('host') || ''
    if (host.includes('firstmilecoach')) {
      return NextResponse.rewrite(new URL('/firstmile/favicon.png', request.url))
    }
    // Crystal Pistol: serve the default /favicon.ico from public/
    return NextResponse.next()
  }

  // Brand override via ?brand= query param (for previewing First Mile on any domain)
  const brandParam = request.nextUrl.searchParams.get('brand')
  if (brandParam) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-brand-override', brandParam)
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    })
    return response
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - public folder files (images, etc.)
     * Note: favicon.ico IS included now so we can rewrite it per domain
     */
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|JPG|PNG)$).*)',
  ],
}
