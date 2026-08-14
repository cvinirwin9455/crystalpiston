import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOrgIdForUser } from '@/lib/org'

// Helper: create admin client with service role key
async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Supported currencies
const VALID_CURRENCIES = ['USD', 'GBP', 'EUR', 'AUD', 'NZD', 'CAD']

// GET /api/org-currency - Get currency for current user's organization
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await createAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)

  if (!orgId) {
    // No org — return default USD
    return NextResponse.json({ currency: 'USD' })
  }

  const { data: org, error } = await adminClient
    .from('organizations')
    .select('currency')
    .eq('id', orgId)
    .single()

  if (error || !org) {
    // Column might not exist yet — return default
    return NextResponse.json({ currency: 'USD' })
  }

  return NextResponse.json({ currency: org.currency || 'USD' })
}

// PUT /api/org-currency - Update currency (account owners only)
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check that user is an account_coach (owner), not a regular coach
  const { data: profile } = await supabase
    .from('users')
    .select('role, coach_level')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (profile?.coach_level === 'coach') {
    return NextResponse.json({ error: 'Only account owners can change currency' }, { status: 403 })
  }

  const adminClient = await createAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)

  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 })
  }

  const body = await request.json()
  const { currency } = body

  if (!currency || !VALID_CURRENCIES.includes(currency)) {
    return NextResponse.json({ error: `Invalid currency. Must be one of: ${VALID_CURRENCIES.join(', ')}` }, { status: 400 })
  }

  const { error } = await adminClient
    .from('organizations')
    .update({ currency })
    .eq('id', orgId)

  if (error) {
    // Column might not exist — return helpful message
    if (error.code === '42703' || error.message?.includes('column')) {
      return NextResponse.json({ error: 'Currency column not found. Please run the migration first.' }, { status: 500 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, currency })
}
