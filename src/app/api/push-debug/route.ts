import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/push-debug - Check push notification status for current user
// This is a temporary debug route - can be removed once push is confirmed working
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

  // Check subscriptions for this user
  const { data: subscriptions, error: subError } = await adminClient
    .from('push_subscriptions')
    .select('id, endpoint, created_at, updated_at')
    .eq('user_id', user.id)

  // Check VAPID config
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    subscriptions: subscriptions || [],
    subscriptionCount: (subscriptions || []).length,
    subscriptionError: subError?.message || null,
    vapidConfigured: {
      publicKeySet: vapidPublicKey.length > 0,
      publicKeyLength: vapidPublicKey.length,
      publicKeyPrefix: vapidPublicKey.substring(0, 10) + '...',
      privateKeySet: vapidPrivateKey.length > 0,
    },
  })
}
