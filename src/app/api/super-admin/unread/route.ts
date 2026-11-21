import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Unread tracking for the Super Admin page.
 *
 * GET  /api/super-admin/unread
 *   -> { feedback: number, inbox: number }
 *   feedback = feedback items the super admin has never opened (admin_seen_at is null)
 *   inbox    = unread inbound emails in non-archived threads
 *   (Beta signup unread counts are computed on the page from /api/super-admin,
 *    because "resolved" there depends on whether the coach has been activated.)
 *
 * POST /api/super-admin/unread  { kind: 'beta' | 'feedback', ids: string[] }
 *   Marks the given items as seen (sets admin_seen_at once; never un-sets it).
 */
async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const adminClient = await getAdminClient()
  const { data: profile } = await adminClient
    .from('users')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_super_admin) {
    return { error: NextResponse.json({ error: 'Super admin access required' }, { status: 403 }) }
  }
  return { adminClient }
}

export async function GET() {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error
  const { adminClient } = auth

  const { count: feedbackCount, error: fbError } = await adminClient
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .is('admin_seen_at', null)

  const { count: inboxCount, error: inboxError } = await adminClient
    .from('inbound_emails')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'inbound')
    .eq('read', false)
    .eq('archived', false)

  if (fbError || inboxError) {
    return NextResponse.json({ error: (fbError || inboxError)!.message }, { status: 500 })
  }

  return NextResponse.json({ feedback: feedbackCount || 0, inbox: inboxCount || 0 })
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error
  const { adminClient } = auth

  const body = await request.json().catch(() => ({}))
  const { kind, ids } = body || {}
  const table = kind === 'beta' ? 'beta_signups' : kind === 'feedback' ? 'feedback' : null
  if (!table) return NextResponse.json({ error: "kind must be 'beta' or 'feedback'" }, { status: 400 })
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'ids must be a non-empty array of strings' }, { status: 400 })
  }

  // Only touch rows that are still unseen, so the first-read time is preserved.
  const { data, error } = await adminClient
    .from(table)
    .update({ admin_seen_at: new Date().toISOString() })
    .in('id', ids)
    .is('admin_seen_at', null)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, marked: data?.length || 0 })
}
