import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/strava/connection - Check if user has Strava connected
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: connection } = await adminClient
    .from('strava_connections')
    .select('id, strava_athlete_id, athlete_firstname, athlete_lastname, athlete_profile, connected_at')
    .eq('user_id', user.id)
    .single()

  if (!connection) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    athleteId: connection.strava_athlete_id,
    athleteName: `${connection.athlete_firstname || ''} ${connection.athlete_lastname || ''}`.trim(),
    athleteProfile: connection.athlete_profile,
    connectedAt: connection.connected_at,
  })
}

// DELETE /api/strava/connection - Disconnect Strava
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get the connection to deauthorize on Strava's end
  const { data: connection } = await adminClient
    .from('strava_connections')
    .select('access_token')
    .eq('user_id', user.id)
    .single()

  if (connection) {
    // Deauthorize on Strava (best effort)
    try {
      await fetch('https://www.strava.com/oauth/deauthorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: connection.access_token }),
      })
    } catch (err) {
      console.error('Failed to deauthorize on Strava:', err)
    }
  }

  // Delete the connection from our DB
  const { error } = await adminClient
    .from('strava_connections')
    .delete()
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
