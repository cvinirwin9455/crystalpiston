import { NextResponse } from 'next/server'
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server'

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

// POST /api/webauthn/authenticate - Generate authentication options OR verify response
// Body: { email } → generate options
// Body: { email, response } → verify response and create session
export async function POST(request: Request) {
  const body = await request.json()
  const { email, response: authResponse } = body

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Look up user by email
  const { data: userRecord } = await adminClient
    .from('users')
    .select('id, email')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!userRecord) {
    // Don't reveal whether user exists - return generic error
    return NextResponse.json({ error: 'Biometric login not available for this account' }, { status: 400 })
  }

  // STEP 1: Generate authentication options (when no authResponse provided)
  if (!authResponse) {
    // Get user's registered credentials
    const { data: credentials } = await adminClient
      .from('webauthn_credentials')
      .select('credential_id, transports')
      .eq('user_id', userRecord.id)

    if (!credentials || credentials.length === 0) {
      return NextResponse.json({ error: 'No biometric credentials registered for this account' }, { status: 400 })
    }

    const allowCredentials = credentials.map((cred) => ({
      id: cred.credential_id,
      type: 'public-key' as const,
      transports: cred.transports || ['internal'],
    }))

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      userVerification: 'required',
    })

    // Store challenge for verification
    await adminClient
      .from('webauthn_challenges')
      .upsert({
        user_id: userRecord.id,
        challenge: options.challenge,
        type: 'authentication',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }, { onConflict: 'user_id' })

    return NextResponse.json(options)
  }

  // STEP 2: Verify authentication response
  const { data: challengeData } = await adminClient
    .from('webauthn_challenges')
    .select('challenge, expires_at')
    .eq('user_id', userRecord.id)
    .eq('type', 'authentication')
    .single()

  if (!challengeData) {
    return NextResponse.json({ error: 'No authentication challenge found. Please try again.' }, { status: 400 })
  }

  if (new Date(challengeData.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Challenge expired. Please try again.' }, { status: 400 })
  }

  // Get the credential that was used
  const { data: credential } = await adminClient
    .from('webauthn_credentials')
    .select('credential_id, public_key, counter, transports')
    .eq('user_id', userRecord.id)
    .eq('credential_id', authResponse.id)
    .single()

  if (!credential) {
    return NextResponse.json({ error: 'Credential not recognized' }, { status: 400 })
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: getExpectedOrigins(),
      expectedRPID: RP_ID,
      credential: {
        id: credential.credential_id,
        publicKey: new Uint8Array(Buffer.from(credential.public_key, 'base64')),
        counter: credential.counter,
        transports: credential.transports || ['internal'],
      },
    })

    if (!verification.verified) {
      return NextResponse.json({ error: 'Biometric verification failed' }, { status: 400 })
    }

    // Update the counter
    await adminClient
      .from('webauthn_credentials')
      .update({ counter: verification.authenticationInfo.newCounter })
      .eq('user_id', userRecord.id)
      .eq('credential_id', authResponse.id)

    // Clean up challenge
    await adminClient
      .from('webauthn_challenges')
      .delete()
      .eq('user_id', userRecord.id)
      .eq('type', 'authentication')

    // Generate a Supabase session for this user
    // Use the admin API to generate a magic link token, then exchange it
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: userRecord.email,
    })

    if (linkError || !linkData) {
      console.error('Failed to generate session link:', linkError)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    // Return the token hashed properties so the client can establish a session
    // The client will use supabase.auth.verifyOtp() with the token_hash
    return NextResponse.json({
      verified: true,
      tokenHash: linkData.properties?.hashed_token,
      email: userRecord.email,
    })
  } catch (err: any) {
    console.error('WebAuthn authentication verification error:', err)
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 400 })
  }
}
