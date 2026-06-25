import { createClient } from '@/lib/supabase/server'
import { getStravaAuthUrl } from '@/lib/strava'
import { NextResponse } from 'next/server'

// GET /api/strava/auth - Redirect user to Strava OAuth
export async function GET(request: Request) {
  // Verify env vars are set before redirecting
  if (!process.env.STRAVA_CLIENT_ID) {
    return NextResponse.json({ error: 'STRAVA_CLIENT_ID environment variable is not configured' }, { status: 500 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  // Always use the production domain for Strava callback (must match Strava app settings)
  const productionHost = process.env.NEXT_PUBLIC_SITE_URL 
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host 
    : 'www.crystalpistolperformance.com'
  const redirectUri = `https://${productionHost}/api/strava/callback`

  // Use user ID as state parameter to verify on callback
  const state = user.id

  const stravaUrl = getStravaAuthUrl(redirectUri, state)

  return NextResponse.redirect(stravaUrl)
}
