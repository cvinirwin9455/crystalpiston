// Strava API utility functions

const STRAVA_VERIFY_TOKEN = process.env.STRAVA_VERIFY_TOKEN || 'pistolperformance_strava_webhook'

export const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize'
export const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'
export const STRAVA_API_BASE = 'https://www.strava.com/api/v3'

function getClientId(): string {
  const id = process.env.STRAVA_CLIENT_ID
  if (!id) throw new Error('STRAVA_CLIENT_ID environment variable is not set')
  return id
}

function getClientSecret(): string {
  const secret = process.env.STRAVA_CLIENT_SECRET
  if (!secret) throw new Error('STRAVA_CLIENT_SECRET environment variable is not set')
  return secret
}

export function getStravaAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'force',
    scope: 'read,activity:read_all',
    state,
  })
  return `${STRAVA_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<StravaTokenResponse> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Strava token exchange failed: ${JSON.stringify(err)}`)
  }

  return res.json()
}

export async function refreshStravaToken(refreshToken: string): Promise<StravaTokenResponse> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Strava token refresh failed: ${JSON.stringify(err)}`)
  }

  return res.json()
}

export async function getStravaActivity(accessToken: string, activityId: number): Promise<StravaActivity> {
  const res = await fetch(`${STRAVA_API_BASE}/activities/${activityId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Failed to fetch Strava activity: ${JSON.stringify(err)}`)
  }

  return res.json()
}

export async function getStravaAthlete(accessToken: string): Promise<StravaAthlete> {
  const res = await fetch(`${STRAVA_API_BASE}/athlete`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error('Failed to fetch Strava athlete')
  }

  return res.json()
}

export function getVerifyToken(): string {
  return STRAVA_VERIFY_TOKEN
}

// Helper: get a valid access token, refreshing if expired
export async function getValidAccessToken(connection: {
  access_token: string
  refresh_token: string
  expires_at: number
  id: string
}, adminClient: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  // If token expires in less than 5 minutes, refresh it
  if (connection.expires_at < now + 300) {
    const refreshed = await refreshStravaToken(connection.refresh_token)

    // Update the stored tokens
    await adminClient
      .from('strava_connections')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: refreshed.expires_at,
      })
      .eq('id', connection.id)

    return refreshed.access_token
  }

  return connection.access_token
}

// Map Strava activity type to our workout types
export function mapStravaTypeToWorkoutType(stravaType: string): string {
  switch (stravaType) {
    case 'Run':
    case 'TrailRun':
    case 'VirtualRun':
      return 'run'
    case 'Walk':
    case 'Hike':
      return 'walk'
    case 'Ride':
    case 'VirtualRide':
    case 'EBikeRide':
    case 'GravelRide':
    case 'MountainBikeRide':
      return 'cycling'
    case 'Yoga':
      return 'stretching'
    case 'WeightTraining':
    case 'Crossfit':
      return 'strength'
    default:
      return 'cross'
  }
}

// Map Strava activity type to training type
export function mapStravaTypeToTrainingType(stravaType: string, workoutType: number | null): string | null {
  // Strava workout_type field: 0=default, 1=race, 2=long run, 3=workout/intervals
  if (stravaType === 'Run' || stravaType === 'TrailRun' || stravaType === 'VirtualRun') {
    if (workoutType === 1) return 'RacePace'
    if (workoutType === 2) return 'LongRun'
    if (workoutType === 3) return 'Intervals'
    if (stravaType === 'TrailRun') return 'Trail'
    if (stravaType === 'VirtualRun') return 'Treadmill'
    return 'Easy' // Default assumption
  }
  if (stravaType === 'Walk') return 'WalkRecovery'
  return null
}

// Convert meters to miles
export function metersToMiles(meters: number): number {
  return +(meters / 1609.344).toFixed(2)
}

// Convert seconds to pace string (min:sec per mile)
export function secondsToMilePace(movingTimeSeconds: number, distanceMeters: number): string {
  if (!distanceMeters || distanceMeters === 0) return ''
  const miles = distanceMeters / 1609.344
  const totalSeconds = Math.round(movingTimeSeconds / miles)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}/mi`
}

// Convert seconds to duration string (e.g. "1h 23m" or "45m")
export function secondsToDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

// Types

export interface StravaTokenResponse {
  token_type: string
  expires_at: number
  expires_in: number
  refresh_token: string
  access_token: string
  athlete: StravaAthlete
}

export interface StravaAthlete {
  id: number
  firstname: string
  lastname: string
  profile: string
  profile_medium: string
}

export interface StravaActivity {
  id: number
  name: string
  type: string
  sport_type: string
  distance: number // meters
  moving_time: number // seconds
  elapsed_time: number // seconds
  start_date: string // ISO
  start_date_local: string // ISO local
  average_speed: number // m/s
  max_speed: number // m/s
  average_heartrate?: number
  max_heartrate?: number
  workout_type?: number | null
  description?: string
  calories?: number
  athlete: { id: number }
}

export interface StravaWebhookEvent {
  object_type: 'activity' | 'athlete'
  object_id: number
  aspect_type: 'create' | 'update' | 'delete'
  owner_id: number // athlete ID
  subscription_id: number
  event_time: number
  updates?: Record<string, any>
}
