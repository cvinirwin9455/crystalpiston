import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/webauthn/check - Check if current user has biometric credentials registered
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await getAdminClient()

  const { data: credentials, error } = await adminClient
    .from('webauthn_credentials')
    .select('id, credential_id, device_type, created_at')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    hasCredentials: (credentials || []).length > 0,
    credentials: (credentials || []).map(c => ({
      id: c.id,
      deviceType: c.device_type,
      createdAt: c.created_at,
    })),
  })
}

// POST /api/webauthn/check - Check if an email has biometric credentials (for login page)
export async function POST(request: Request) {
  const body = await request.json()
  const { email } = body

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // Look up user
  const { data: userRecord } = await adminClient
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!userRecord) {
    // Don't reveal if user exists
    return NextResponse.json({ hasCredentials: false })
  }

  const { data: credentials } = await adminClient
    .from('webauthn_credentials')
    .select('id')
    .eq('user_id', userRecord.id)
    .limit(1)

  return NextResponse.json({
    hasCredentials: (credentials || []).length > 0,
  })
}
