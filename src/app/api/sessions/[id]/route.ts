import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOrgIdForUser } from '@/lib/org'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// PATCH /api/sessions/[id] - Update session status or details
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = await getAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)
  const sessionId = params.id

  // Verify session exists and belongs to this org
  const { data: existing } = await adminClient
    .from('sessions')
    .select('id, organization_id, status')
    .eq('id', sessionId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (orgId && existing.organization_id !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const allowedFields = [
    'scheduled_at',
    'duration_minutes',
    'location',
    'session_type',
    'notes',
    'workout_id',
    'status',
  ]

  const validStatuses = [
    'scheduled',
    'completed',
    'cancelled_charged',
    'cancelled_no_charge',
    'no_show',
    'rescheduled',
  ]

  // Build update object from allowed fields only
  const updates: Record<string, any> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Validate status if provided
  if (updates.status && !validStatuses.includes(updates.status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
  }

  // Set marked_at when status changes to a terminal state
  if (updates.status && updates.status !== 'scheduled' && updates.status !== existing.status) {
    updates.marked_at = new Date().toISOString()
  }

  const { data: session, error } = await adminClient
    .from('sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ session })
}

// DELETE /api/sessions/[id] - Delete a session
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = await getAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)
  const sessionId = params.id

  // Verify session exists and belongs to this org
  const { data: existing } = await adminClient
    .from('sessions')
    .select('id, organization_id')
    .eq('id', sessionId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (orgId && existing.organization_id !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await adminClient
    .from('sessions')
    .delete()
    .eq('id', sessionId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
