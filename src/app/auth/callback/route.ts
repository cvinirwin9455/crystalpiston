import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /auth/callback - Handle Supabase auth redirects (PKCE code exchange)
// This runs server-side so cookies are properly set for the session
export async function GET(request: Request) {
  const { searchParams, origin, hash } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  // 1. PKCE flow: exchange code for session (most common with custom SMTP)
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // If a 'next' param was specified, go there
      if (next) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      // Otherwise determine where to send the user
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Check if this is a brand new invited user (never signed in)
        // invited_at exists but email_confirmed_at might just have been set by this exchange
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        // If user was created via invite and hasn't set up their password yet
        // (their confirmation_sent_at exists, meaning they were invited)
        if (user.user_metadata?.role === 'client' && !user.last_sign_in_at) {
          return NextResponse.redirect(`${origin}/set-password`)
        }

        // For recovery (password reset) type
        if (type === 'recovery') {
          return NextResponse.redirect(`${origin}/reset-password`)
        }

        // Default: route based on role
        if (profile?.role === 'admin') {
          return NextResponse.redirect(`${origin}/admin`)
        } else {
          // New users who just exchanged code should set password
          return NextResponse.redirect(`${origin}/set-password`)
        }
      }
    }

    // If code exchange failed, redirect to login with error
    return NextResponse.redirect(`${origin}/login?error=auth_code_error`)
  }

  // 2. Token hash flow (older Supabase email format)
  if (tokenHash && type) {
    const supabase = await createClient()

    if (type === 'invite' || type === 'magiclink') {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
      })
      if (!error) {
        return NextResponse.redirect(`${origin}/set-password`)
      }
    }

    if (type === 'recovery') {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
      })
      if (!error) {
        return NextResponse.redirect(`${origin}/reset-password`)
      }
    }

    // If verification failed
    return NextResponse.redirect(`${origin}/login?error=link_expired`)
  }

  // 3. No code or token_hash — might be a hash fragment redirect
  // Hash fragments don't reach the server, so redirect to a page that handles them client-side
  if (next) {
    return NextResponse.redirect(`${origin}${next}`)
  }

  // Fallback: go to login
  return NextResponse.redirect(`${origin}/login`)
}
