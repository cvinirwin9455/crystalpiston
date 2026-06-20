import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForToken } from '@/lib/strava'
import { NextResponse } from 'next/server'

// GET /api/strava/callback - Handle Strava OAuth callback
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') // user ID
  const error = url.searchParams.get('error')
  const scope = url.searchParams.get('scope')

  // Base redirect URL (client dashboard account tab)
  const baseRedirect = `${url.protocol}//${url.host}/dashboard?tab=account`

  // Handle denial
  if (error === 'access_denied') {
    return NextResponse.redirect(`${baseRedirect}&strava=denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseRedirect}&strava=error`)
  }

  // Verify the user is still authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.id !== state) {
    return NextResponse.redirect(`${baseRedirect}&strava=error`)
  }

  // Check scope includes activity:read_all
  if (scope && !scope.includes('activity:read_all') && !scope.includes('activity:read')) {
    return NextResponse.redirect(`${baseRedirect}&strava=scope_error`)
  }

  try {
    // Exchange code for tokens
    const tokenData = await exchangeCodeForToken(code)

    // Use service role to store connection
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Upsert the connection (in case they reconnect)
    const { error: upsertError } = await adminClient
      .from('strava_connections')
      .upsert({
        user_id: user.id,
        strava_athlete_id: tokenData.athlete.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        athlete_firstname: tokenData.athlete.firstname,
        athlete_lastname: tokenData.athlete.lastname,
        athlete_profile: tokenData.athlete.profile_medium || tokenData.athlete.profile,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (upsertError) {
      console.error('Failed to store Strava connection:', upsertError)
      return NextResponse.redirect(`${baseRedirect}&strava=error`)
    }

    return NextResponse.redirect(`${baseRedirect}&strava=connected`)
  } catch (err) {
    console.error('Strava OAuth error:', err)
    return NextResponse.redirect(`${baseRedirect}&strava=error`)
  }
}
