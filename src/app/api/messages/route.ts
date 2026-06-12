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

// GET /api/messages?with_user_id=xxx - Get conversation between current user and another user
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const withUserId = searchParams.get('with_user_id')

  const adminClient = await getAdminClient()

  if (withUserId) {
    // Get conversation between current user and specified user
    const { data: messages, error } = await adminClient
      .from('messages')
      .select('id, from_user_id, to_user_id, message, read, created_at')
      .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${withUserId}),and(from_user_id.eq.${withUserId},to_user_id.eq.${user.id})`)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formatted = (messages || []).map(m => ({
      id: m.id,
      from: m.from_user_id === user.id ? 'crystal' : 'client',
      fromUserId: m.from_user_id,
      toUserId: m.to_user_id,
      message: m.message,
      read: m.read,
      createdAt: m.created_at,
      date: new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }))

    // Mark unread messages from the other user as read
    await adminClient
      .from('messages')
      .update({ read: true })
      .eq('from_user_id', withUserId)
      .eq('to_user_id', user.id)
      .eq('read', false)

    return NextResponse.json(formatted)
  }

  // No with_user_id: client fetching their own messages with Crystal
  const { data: adminUser } = await adminClient
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .single()

  if (!adminUser) {
    return NextResponse.json({ error: 'Admin user not found' }, { status: 500 })
  }

  const { data: messages, error } = await adminClient
    .from('messages')
    .select('id, from_user_id, to_user_id, message, read, created_at')
    .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${adminUser.id}),and(from_user_id.eq.${adminUser.id},to_user_id.eq.${user.id})`)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Mark unread messages from admin as read
  await adminClient
    .from('messages')
    .update({ read: true })
    .eq('from_user_id', adminUser.id)
    .eq('to_user_id', user.id)
    .eq('read', false)

  return NextResponse.json((messages || []).map(m => ({
    id: m.id,
    from: m.from_user_id === user.id ? 'client' : 'crystal',
    fromUserId: m.from_user_id,
    toUserId: m.to_user_id,
    message: m.message,
    read: m.read,
    createdAt: m.created_at,
    date: new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  })))
}

// POST /api/messages - Send a message
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { toUserId, message } = body

  if (!message || !message.trim()) {
    return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
  }

  const adminClient = await getAdminClient()

  // If toUserId not provided (client sending), find the admin
  let recipientId = toUserId
  if (!recipientId) {
    const { data: adminUser } = await adminClient
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .single()
    
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 500 })
    }
    recipientId = adminUser.id
  }

  const { data: newMessage, error } = await adminClient
    .from('messages')
    .insert({
      from_user_id: user.id,
      to_user_id: recipientId,
      message: message.trim(),
    })
    .select('id, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Send email notification if Crystal is sending to a client
  const { data: senderProfile } = await adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (senderProfile?.role === 'admin' && recipientId) {
    // Check recipient's notification preferences
    const { data: notifPrefs } = await adminClient
      .from('notification_preferences')
      .select('messages')
      .eq('user_id', recipientId)
      .single()

    const messagesPref = notifPrefs?.messages || 'immediate'

    if (messagesPref === 'immediate') {
      // Get recipient's email and name
      const { data: recipient } = await adminClient
        .from('users')
        .select('email, name')
        .eq('id', recipientId)
        .single()

      if (recipient?.email) {
        const { sendEmail, buildNewMessageEmail } = await import('@/lib/email')
        const url = new URL(request.url)
        const siteUrl = `${url.protocol}//${url.host}`
        const emailContent = buildNewMessageEmail(recipient.name || 'there', message.trim(), siteUrl)
        // Fire and forget - don't block the response
        sendEmail({ to: recipient.email, ...emailContent }).catch(console.error)
      }
    }
  }

  return NextResponse.json({
    success: true,
    messageId: newMessage.id,
    createdAt: newMessage.created_at,
  })
}
