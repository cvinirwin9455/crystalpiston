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

// GET /api/templates?type=week|day - List templates scoped to the coach's organization
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  const adminClient = await getAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)

  let query = adminClient
    .from('templates')
    .select('id, name, type, category, data, created_at, organization_id')
    .order('name', { ascending: true })

  // Scope to the coach's organization
  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  if (type) {
    query = query.eq('type', type)
  }

  const { data: templates, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(templates || [])
}

// POST /api/templates - Create a new template (scoped to coach's org)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { name, type, category, data } = body

  if (!name || !type || !data) {
    return NextResponse.json({ error: 'name, type, and data are required' }, { status: 400 })
  }

  if (type !== 'week' && type !== 'day') {
    return NextResponse.json({ error: 'type must be "week" or "day"' }, { status: 400 })
  }

  const adminClient = await getAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)

  const { data: template, error } = await adminClient
    .from('templates')
    .insert({
      name,
      type,
      category: category || null,
      data,
      organization_id: orgId,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, template })
}

// DELETE /api/templates - Delete a template by id (scoped to coach's org)
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { templateId } = body

  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)

  // Only allow deleting templates within the coach's own org
  let query = adminClient
    .from('templates')
    .delete()
    .eq('id', templateId)

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  const { error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// PATCH /api/templates - Update a template by id (scoped to coach's org)
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { templateId, name, category, data } = body

  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)

  const updateFields: Record<string, any> = {}
  if (name !== undefined) updateFields.name = name
  if (category !== undefined) updateFields.category = category
  if (data !== undefined) updateFields.data = data

  // Only allow updating templates within the coach's own org
  let query = adminClient
    .from('templates')
    .update(updateFields)
    .eq('id', templateId)

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  const { data: template, error } = await query.select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, template })
}