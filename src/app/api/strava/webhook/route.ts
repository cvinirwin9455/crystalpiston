import { getVerifyToken } from '@/lib/strava'
import { NextResponse } from 'next/server'
import type { StravaWebhookEvent } from '@/lib/strava'

// GET /api/strava/webhook - Webhook subscription verification (Strava sends this to verify your endpoint)
export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === getVerifyToken() && challenge) {
    // Strava expects a JSON response with the challenge
    console.log('Strava webhook verified successfully')
    return NextResponse.json({ 'hub.challenge': challenge })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// POST /api/strava/webhook - Receive webhook events from Strava
export async function POST(request: Request) {
  try {
    const event: StravaWebhookEvent = await request.json()

    console.log('Strava webhook event:', JSON.stringify(event))

    // We only care about new/updated activities
    if (event.object_type !== 'activity') {
      return NextResponse.json({ received: true })
    }

    // We only care about create and update events
    if (event.aspect_type !== 'create' && event.aspect_type !== 'update') {
      return NextResponse.json({ received: true })
    }

    // Process the activity asynchronously
    // We respond immediately to Strava (they require < 2 second response)
    // Then process in background via internal API call
    const url = new URL(request.url)
    const processUrl = `${url.protocol}//${url.host}/api/strava/activities`

    // Fire and forget - process in background
    fetch(processUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Strava-Webhook-Secret': getVerifyToken(),
      },
      body: JSON.stringify({
        athleteId: event.owner_id,
        activityId: event.object_id,
        aspectType: event.aspect_type,
      }),
    }).catch(err => {
      console.error('Failed to trigger activity processing:', err)
    })

    // Respond to Strava immediately
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Strava webhook error:', err)
    // Still return 200 to avoid Strava retries for parsing errors
    return NextResponse.json({ received: true })
  }
}
