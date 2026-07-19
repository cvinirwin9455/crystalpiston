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

/**
 * Program Templates API
 * 
 * Stored in the 'templates' table with type='program'.
 * The data field contains:
 * {
 *   totalWeeks: number,
 *   weeks: [
 *     {
 *       weekNumber: 1,  // 1 = furthest from race, totalWeeks = race week
 *       label: string,  // optional label like "Base Phase" or "Peak"
 *       days: [
 *         {
 *           day: "Monday",
 *           workouts: [
 *             { type: "cross"|"run"|"walk"|"rest"|"stretching"|"cycling", trainingType: string, miles: string, title: string, description: string, distanceUnit: string }
 *           ]
 *         },
 *         ...7 days
 *       ]
 *     },
 *     ...totalWeeks entries
 *   ]
 * }
 */

// GET /api/program-templates - List all program templates for the org
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

  const adminClient = await getAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)

  let query = adminClient
    .from('templates')
    .select('id, name, type, category, data, created_at, organization_id')
    .eq('type', 'program')
    .order('name', { ascending: true })

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  const { data: templates, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(templates || [])
}

// POST /api/program-templates - Create a new program template
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
  const { name, category, data } = body

  if (!name || !data || !data.totalWeeks || !data.weeks) {
    return NextResponse.json({ error: 'name and data (with totalWeeks and weeks) are required' }, { status: 400 })
  }

  const adminClient = await getAdminClient()
  const orgId = await getOrgIdForUser(adminClient, user.id)

  const { data: template, error } = await adminClient
    .from('templates')
    .insert({
      name,
      type: 'program',
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

// PATCH /api/program-templates - Update a program template
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

  let query = adminClient
    .from('templates')
    .update(updateFields)
    .eq('id', templateId)
    .eq('type', 'program')

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  const { data: template, error } = await query.select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, template })
}

// DELETE /api/program-templates - Delete a program template
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

  let query = adminClient
    .from('templates')
    .delete()
    .eq('id', templateId)
    .eq('type', 'program')

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  const { error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
