import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/messages/unread - Get unread message counts
// For clients: returns total unread from Crystal
// For admin: returns unread counts per client
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await getAdminClient()

  // Check if user is admin
  const { data: profile } = await adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') {
    // Admin: get unread count per client (messages sent TO admin that are unread)
    const { data: unreadMessages } = await adminClient
      .from('messages')
      .select('from_user_id')
      .eq('to_user_id', user.id)
      .eq('read', false)

    // Group by from_user_id
    const countsByUser: Record<string, number> = {}
    let total = 0
    for (const msg of unreadMessages || []) {
      countsByUser[msg.from_user_id] = (countsByUser[msg.from_user_id] || 0) + 1
      total++
    }

    return NextResponse.json({ total, byClient: countsByUser })
  }

  // Client: get unread count from admin
  const { data: unreadMessages } = await adminClient
    .from('messages')
    .select('id')
    .eq('to_user_id', user.id)
    .eq('read', false)

  return NextResponse.json({ total: unreadMessages?.length || 0 })
}
