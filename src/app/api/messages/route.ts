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
    // Admin viewing a client's messages: show all messages between that client and ANY admin
    const { data: profile } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    let messages: any[] = []
    let queryError: any = null

    if (profile?.role === 'admin') {
      // Get all admin IDs
      const { data: allAdmins } = await adminClient
        .from('users')
        .select('id')
        .eq('role', 'admin')

      const adminIds = (allAdmins || []).map(a => a.id)

      // Fetch messages between the client and ANY admin
      const orFilter = adminIds.map(aid => `and(from_user_id.eq.${aid},to_user_id.eq.${withUserId}),and(from_user_id.eq.${withUserId},to_user_id.eq.${aid})`).join(',')

      const result = await adminClient
        .from('messages')
        .select('id, from_user_id, to_user_id, message, read, created_at')
        .or(orFilter)
        .order('created_at', { ascending: true })

      messages = result.data || []
      queryError = result.error
    } else {
      const result = await adminClient
        .from('messages')
        .select('id, from_user_id, to_user_id, message, read, created_at')
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${withUserId}),and(from_user_id.eq.${withUserId},to_user_id.eq.${user.id})`)
        .order('created_at', { ascending: true })

      messages = result.data || []
      queryError = result.error
    }

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 })
    }

    const formatted = messages.map(m => ({
      id: m.id,
      from: m.from_user_id === withUserId ? 'client' : 'crystal',
      fromUserId: m.from_user_id,
      toUserId: m.to_user_id,
      message: m.message,
      read: m.read,
      createdAt: m.created_at,
      date: new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }))

    // Mark unread messages from the client as read (for current admin)
    await adminClient
      .from('messages')
      .update({ read: true })
      .eq('from_user_id', withUserId)
      .eq('to_user_id', user.id)
      .eq('read', false)

    return NextResponse.json(formatted)
  }

  // No with_user_id: client fetching their own messages with Crystal
  const { data: adminUsers } = await adminClient
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1)

  const adminUser = adminUsers?.[0]
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
    const { data: adminUsers } = await adminClient
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
    
    const adminUser = adminUsers?.[0]
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

  // Send email notification based on who is sending to whom (fire and forget, don't block response)
  try {
  const { data: senderProfile } = await adminClient
    .from('users')
    .select('role, name')
    .eq('id', user.id)
    .single()

  // Check recipient's role to determine notification logic
  const { data: recipientProfile } = await adminClient
    .from('users')
    .select('role, email, name')
    .eq('id', recipientId)
    .single()

  if (recipientProfile?.role === 'admin') {
    // Sending TO an admin (Crystal): check admin's notification preferences
    const { data: adminNotifPrefs } = await adminClient
      .from('notification_preferences')
      .select('client_message, notification_emails')
      .eq('user_id', recipientId)
      .maybeSingle()

    const clientMessagePref = adminNotifPrefs?.client_message || 'immediate'

    if (clientMessagePref === 'immediate') {
      let notifEmails: string[] = []
      if (adminNotifPrefs?.notification_emails) {
        notifEmails = adminNotifPrefs.notification_emails.split(',').map((e: string) => e.trim()).filter(Boolean)
      }
      if (notifEmails.length === 0 && recipientProfile.email) {
        notifEmails = [recipientProfile.email]
      }

      if (notifEmails.length > 0) {
        const { sendEmail } = await import('@/lib/email')
        const url = new URL(request.url)
        const siteUrl = `${url.protocol}//${url.host}`
        const senderName = senderProfile?.name || 'A client'
        const truncated = message.trim().length > 150 ? message.trim().slice(0, 150) + '...' : message.trim()

        const emailHtml = `
          <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">New message from ${senderName}</h2>
          <div style="margin: 0 0 24px; padding: 16px; background-color: rgba(212,168,83,0.1); border-left: 3px solid #d4a853; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #e0e0e0; line-height: 1.5;">${truncated}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
            <tr>
              <td align="center">
                <a href="${siteUrl}/admin" style="display: inline-block; background-color: #e94560; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">View Message</a>
              </td>
            </tr>
          </table>
        `

        for (const email of notifEmails) {
          sendEmail({ to: email, subject: `New message from ${senderName}`, html: emailHtml }).catch(console.error)
        }
      }
    }
  } else if (recipientProfile?.role === 'client') {
    // Sending TO a client: check client's message preferences
    const { data: notifPrefs } = await adminClient
      .from('notification_preferences')
      .select('messages')
      .eq('user_id', recipientId)
      .maybeSingle()

    const messagesPref = notifPrefs?.messages || 'immediate'

    if (messagesPref === 'immediate' && recipientProfile.email) {
      const { sendEmail, buildNewMessageEmail } = await import('@/lib/email')
      const url = new URL(request.url)
      const siteUrl = `${url.protocol}//${url.host}`
      const emailContent = buildNewMessageEmail(recipientProfile.name || 'there', message.trim(), siteUrl)
      sendEmail({ to: recipientProfile.email, ...emailContent }).catch(console.error)
    }
  }
  } catch (notifErr) {
    console.error('Notification error (message still sent):', notifErr)
  }

  return NextResponse.json({
    success: true,
    messageId: newMessage.id,
    createdAt: newMessage.created_at,
  })
}
