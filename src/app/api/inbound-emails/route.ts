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

// GET /api/inbound-emails - Get all inbound email threads for super-admin
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await getAdminClient()

  // Verify super admin
  const { data: profile } = await adminClient
    .from('users')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const threadId = searchParams.get('thread_id')
  const showArchived = searchParams.get('archived') === 'true'

  if (threadId) {
    // Get all messages in a thread
    const { data: messages, error } = await adminClient
      .from('inbound_emails')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Mark inbound messages in this thread as read
    await adminClient
      .from('inbound_emails')
      .update({ read: true })
      .eq('thread_id', threadId)
      .eq('direction', 'inbound')
      .eq('read', false)

    return NextResponse.json({ messages })
  }

  // Get thread summaries (latest message per thread)
  const { data: allEmails, error } = await adminClient
    .from('inbound_emails')
    .select('*')
    .eq('archived', showArchived)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by thread_id and get summary
  const threadMap = new Map<string, {
    thread_id: string
    from_email: string
    from_name: string | null
    subject: string
    last_message: string
    last_message_at: string
    message_count: number
    unread_count: number
    direction: string
  }>()

  for (const email of allEmails || []) {
    const existing = threadMap.get(email.thread_id)
    if (!existing) {
      threadMap.set(email.thread_id, {
        thread_id: email.thread_id,
        from_email: email.direction === 'inbound' ? email.from_email : email.to_email,
        from_name: email.direction === 'inbound' ? email.from_name : null,
        subject: email.subject || '(No subject)',
        last_message: email.body_text?.slice(0, 100) || '',
        last_message_at: email.created_at,
        message_count: 1,
        unread_count: (email.direction === 'inbound' && !email.read) ? 1 : 0,
        direction: email.direction,
      })
    } else {
      existing.message_count++
      if (email.direction === 'inbound' && !email.read) {
        existing.unread_count++
      }
      // Keep the latest message time (already sorted desc)
    }
  }

  const threads = Array.from(threadMap.values())

  // Get total unread count
  const totalUnread = threads.reduce((sum, t) => sum + t.unread_count, 0)

  return NextResponse.json({ threads, totalUnread })
}

// PATCH /api/inbound-emails - Mark as read/archived
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await getAdminClient()

  const { data: profile } = await adminClient
    .from('users')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
  }

  const body = await request.json()
  const { thread_id, action } = body

  if (!thread_id) {
    return NextResponse.json({ error: 'thread_id required' }, { status: 400 })
  }

  if (action === 'archive') {
    await adminClient
      .from('inbound_emails')
      .update({ archived: true })
      .eq('thread_id', thread_id)
  } else if (action === 'unarchive') {
    await adminClient
      .from('inbound_emails')
      .update({ archived: false })
      .eq('thread_id', thread_id)
  } else if (action === 'mark_read') {
    await adminClient
      .from('inbound_emails')
      .update({ read: true })
      .eq('thread_id', thread_id)
      .eq('direction', 'inbound')
  }

  return NextResponse.json({ success: true })
}
