import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Skip middleware entirely for webhook endpoints (they don't need auth/sessions)
  if (request.nextUrl.pathname.startsWith('/api/webhooks/')) {
    return NextResponse.next()
  }

  const host = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname

  // If on Crystal Pistol domain and accessing platform routes (login, admin, dashboard, etc.),
  // redirect to First Mile Coach. Marketing pages (/, #about, etc.) stay on Crystal Pistol domain.
  if (host.includes('crystalpistol') || host.includes('crystalpiston.vercel.app')) {
    const platformRoutes = ['/login', '/admin', '/dashboard', '/set-password', '/reset-password', '/forgot-password', '/auth']
    const isPlatformRoute = platformRoutes.some(route => pathname === route || pathname.startsWith(route + '/') || pathname.startsWith(route + '?'))
    if (isPlatformRoute) {
      const redirectUrl = new URL(pathname + request.nextUrl.search, 'https://www.firstmilecoach.com')
      return NextResponse.redirect(redirectUrl, 301)
    }
  }

  // Rewrite /favicon.ico based on domain
  if (pathname === '/favicon.ico') {
    if (host.includes('firstmilecoach')) {
      // Redirect to the correct favicon for First Mile Coach
      return NextResponse.redirect(new URL('/firstmile/favicon.png', request.url), 302)
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
