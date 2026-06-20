import { createClient } from '@/lib/supabase/server'
import { getStravaAuthUrl } from '@/lib/strava'
import { NextResponse } from 'next/server'

// GET /api/strava/auth - Redirect user to Strava OAuth
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const redirectUri = `${url.protocol}//${url.host}/api/strava/callback`

  // Use user ID as state parameter to verify on callback
  const state = user.id

  const stravaUrl = getStravaAuthUrl(redirectUri, state)

  return NextResponse.redirect(stravaUrl)
}
