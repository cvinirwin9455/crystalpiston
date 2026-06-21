import { getVerifyToken } from '@/lib/strava'
import { NextResponse } from 'next/server'
import type { StravaWebhookEvent } from '@/lib/strava'

// GET /api/strava/webhook - Webhook subscription verification (Strava sends this to verify your endpoint)
export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  // If Strava is verifying the webhook subscription
  if (mode === 'subscribe' && token === getVerifyToken() && challenge) {
    return new Response(JSON.stringify({ 'hub.challenge': challenge }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // For any other GET request (including Strava's initial reachability check)
  // Always return 200 with the challenge if provided, even without mode/token
  if (challenge) {
    return new Response(JSON.stringify({ 'hub.challenge': challenge }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Plain GET — return 200 so Strava knows the endpoint is reachable
  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
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
