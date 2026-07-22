import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/weeks/draft-count - Get total draft week count across all clients
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify admin role
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use service role to bypass RLS
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Single query: count all draft weeks
  const { count, error } = await adminClient
    .from('weeks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'draft')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ draftCount: count || 0 })
}
