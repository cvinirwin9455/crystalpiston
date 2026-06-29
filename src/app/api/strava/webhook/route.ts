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
    // Then process in background via internal API call with retry
    const url = new URL(request.url)
    const processUrl = `${url.protocol}//${url.host}/api/strava/activities`

    // Fire with retry (up to 3 attempts with exponential backoff)
    const processWithRetry = async () => {
      const payload = JSON.stringify({
        athleteId: event.owner_id,
        activityId: event.object_id,
        aspectType: event.aspect_type,
      })
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch(processUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'X-Strava-Webhook-Secret': getVerifyToken(),
            },
            body: payload,
          })
          if (res.ok || res.status < 500) return // Success or client error (don't retry)
          console.error(`Strava activity processing attempt ${attempt} failed: ${res.status}`)
        } catch (err) {
          console.error(`Strava activity processing attempt ${attempt} error:`, err)
        }
        // Wait before retry: 2s, 4s, 8s
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, attempt - 1)))
      }
      console.error(`Strava activity processing FAILED after 3 attempts for activity ${event.object_id}`)
    }
    processWithRetry().catch(console.error)

    // Respond to Strava immediately
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Strava webhook error:', err)
    // Still return 200 to avoid Strava retries for parsing errors
    return NextResponse.json({ received: true })
  }
}
