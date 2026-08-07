import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server'

const RP_NAME = 'First Mile Coach'
const RP_ID = process.env.WEBAUTHN_RP_ID || 'firstmilecoach.com'
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'https://firstmilecoach.com'

// Accept both www and non-www origins
function getExpectedOrigins(): string[] {
  const origins = [ORIGIN]
  if (ORIGIN.includes('://www.')) {
    origins.push(ORIGIN.replace('://www.', '://'))
  } else {
    origins.push(ORIGIN.replace('://', '://www.'))
  }
  return origins
}

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/webauthn/register - Generate registration options (challenge)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await getAdminClient()

  // Get existing credentials for this user (to exclude them)
  const { data: existingCreds } = await adminClient
    .from('webauthn_credentials')
    .select('credential_id')
    .eq('user_id', user.id)

  const excludeCredentials = (existingCreds || []).map((cred) => ({
    id: cred.credential_id,
    type: 'public-key' as const,
  }))

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.email || user.id,
    userID: new TextEncoder().encode(user.id),
    userDisplayName: user.email || 'User',
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Use device biometrics (Face ID, Touch ID)
      residentKey: 'preferred',
      userVerification: 'required',
    },
  })

  // Store the challenge temporarily for verification
  await adminClient
    .from('webauthn_challenges')
    .upsert({
      user_id: user.id,
      challenge: options.challenge,
      type: 'registration',
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min expiry
    }, { onConflict: 'user_id' })

  return NextResponse.json(options)
}

// POST /api/webauthn/register - Verify registration response
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const adminClient = await getAdminClient()

  // Get the stored challenge
  const { data: challengeData } = await adminClient
    .from('webauthn_challenges')
    .select('challenge, expires_at')
    .eq('user_id', user.id)
    .eq('type', 'registration')
    .single()

  if (!challengeData) {
    return NextResponse.json({ error: 'No registration challenge found. Please try again.' }, { status: 400 })
  }

  if (new Date(challengeData.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Challenge expired. Please try again.' }, { status: 400 })
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: getExpectedOrigins(),
      expectedRPID: RP_ID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

    // Store the credential
    const { error: insertError } = await adminClient
      .from('webauthn_credentials')
      .insert({
        user_id: user.id,
        credential_id: credential.id,
        public_key: Buffer.from(credential.publicKey).toString('base64'),
        counter: credential.counter,
        device_type: credentialDeviceType,
        backed_up: credentialBackedUp,
        transports: body.response?.transports || [],
        created_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('Error storing credential:', insertError)
      return NextResponse.json({ error: 'Failed to store credential' }, { status: 500 })
    }

    // Clean up the challenge
    await adminClient
      .from('webauthn_challenges')
      .delete()
      .eq('user_id', user.id)
      .eq('type', 'registration')

    return NextResponse.json({ verified: true })
  } catch (err: any) {
    console.error('WebAuthn registration verification error:', err)
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 400 })
  }
}
