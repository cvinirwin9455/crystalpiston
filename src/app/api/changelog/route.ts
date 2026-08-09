import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOrgIdForUser } from '@/lib/org'

/**
 * Changelog API
 * 
 * Stores dynamic changelog entries in the 'templates' table with type='day' and category='__changelog__'.
 * Each row represents one changelog entry.
 * 
 * The data field contains:
 * {
 *   date: string,          // e.g. "August 8, 2026"
 *   area: string,          // "Admin" | "Client" | "Marketing" | "All"
 *   text: string,          // The description of the change
 *   feedbackId?: string,   // Optional link to the feedback item that triggered this
 *   source: string,        // "feedback" | "manual" — whether it came from a submission or was added manually
 * }
 */

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/changelog - List all dynamic changelog entries
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await getAdminClient()

  const { data: entries, error } = await adminClient
    .from('templates')
    .select('id, name, data, created_at')
    .eq('type', 'day')
    .eq('category', '__changelog__')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const items = (entries || []).map((row: any) => ({
    id: row.id,
    date: row.data?.date || '',
    area: row.data?.area || 'All',
    text: row.data?.text || row.name || '',
    feedbackId: row.data?.feedbackId || null,
    source: row.data?.source || 'manual',
    createdAt: row.created_at,
  }))

  return NextResponse.json(items)
}

// POST /api/changelog - Add a new changelog entry (admin only)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await getAdminClient()

  // Verify admin
  const { data: profile } = await adminClient
    .from('users')
    .select('role, coach_level, is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!profile.is_super_admin && !(profile.role === 'admin' && profile.coach_level === 'account_coach')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { date, area, text, feedbackId, source } = body

  if (!text || !text.trim()) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 })
  }

  const entryDate = date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const entryArea = area || 'All'

  const data = {
    date: entryDate,
    area: entryArea,
    text: text.trim(),
    feedbackId: feedbackId || null,
    source: source || 'manual',
  }

  const { data: entry, error } = await adminClient
    .from('templates')
    .insert({
      name: text.trim().slice(0, 100),
      type: 'day',
      category: '__changelog__',
      data,
      organization_id: null, // Changelog is global, not org-scoped
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, entry: { id: entry.id, ...data, createdAt: entry.created_at } })
}

// DELETE /api/changelog - Remove a changelog entry
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = await getAdminClient()

  const { data: profile } = await adminClient
    .from('users')
    .select('role, coach_level, is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin && !(profile?.role === 'admin' && profile?.coach_level === 'account_coach')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await adminClient
    .from('templates')
    .delete()
    .eq('id', id)
    .eq('type', 'day')
    .eq('category', '__changelog__')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
