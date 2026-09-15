import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasCoachAccess, PREFERRED_VIEW_COOKIE } from '@/lib/roles'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // If env vars are not set, just pass through (allows build without env vars)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public routes that don't require auth
  const publicRoutes = ['/', '/login', '/forgot-password', '/reset-password', '/set-password', '/auth/callback', '/terms', '/faq', '/features']
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith('/auth/'))

  // API routes that must be publicly accessible (webhooks, internal processing, etc.)
  const isPublicApi = pathname.startsWith('/api/strava/webhook') || pathname.startsWith('/api/strava/activities') || pathname.startsWith('/api/inquiry') || pathname.startsWith('/api/beta-signup') || pathname.startsWith('/api/feedback/inbound') || pathname.startsWith('/api/reset-password')

  // If not logged in and trying to access protected route, redirect to login
  if (!user && !isPublicRoute && !isPublicApi) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If logged in, check user profile for role and status
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, status, is_super_admin, has_coach_access')
      .eq('id', user.id)
      .single()

    // Coach capability = primary admin role OR granted coach access (dual-role).
    const canCoach = hasCoachAccess(profile)

    // Block archived/inactive clients from accessing protected routes
    // Admins are never blocked. Public routes (login, etc.) are not blocked.
    if (profile?.status === 'inactive' && profile?.role !== 'admin' && !isPublicRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('archived', '1')
      return NextResponse.redirect(url)
    }

    // If on login page, redirect to appropriate landing.
    // Dual-role users (coach capability + an existing client record) are sent
    // to their remembered view, or to the chooser if they have no preference.
    if (pathname === '/login') {
      const url = request.nextUrl.clone()
      const preferred = request.cookies.get(PREFERRED_VIEW_COOKIE)?.value
      if (canCoach) {
        // Detect whether they ALSO have a client record → dual-role.
        const { data: clientRow } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()
        if (clientRow) {
          // Dual-role: honor preference, else let them choose.
          if (preferred === 'client') url.pathname = '/dashboard'
          else if (preferred === 'coach') url.pathname = '/admin'
          else url.pathname = '/choose-view'
        } else {
          url.pathname = '/admin'
        }
      } else {
        url.pathname = '/dashboard'
      }
      return NextResponse.redirect(url)
    }

    // Guard admin routes by COACH CAPABILITY (not just primary role), so a
    // dual-role user whose primary role is 'client' can still reach /admin.
    if (pathname.startsWith('/admin') || pathname.startsWith('/super-admin')) {
      if (pathname.startsWith('/super-admin')) {
        // Only super admins can access /super-admin
        if (!profile?.is_super_admin) {
          const url = request.nextUrl.clone()
          url.pathname = '/admin'
          return NextResponse.redirect(url)
        }
      } else if (!canCoach) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
