import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { hasCoachAccess, PREFERRED_VIEW_COOKIE, type PreferredView } from '@/lib/roles'

// POST /api/preferred-view - Remember which view (coach|client) a dual-role
// user last chose. Sets an HTTP cookie the middleware and callbacks read.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const view = body?.view as PreferredView | undefined
  if (view !== 'coach' && view !== 'client') {
    return NextResponse.json({ error: 'view must be "coach" or "client"' }, { status: 400 })
  }

  // Validate the user is actually allowed to use the requested view.
  const { data: profile } = await supabase
    .from('users')
    .select('role, has_coach_access')
    .eq('id', user.id)
    .single()

  if (view === 'coach' && !hasCoachAccess(profile)) {
    return NextResponse.json({ error: 'You do not have coach access.' }, { status: 403 })
  }

  if (view === 'client') {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!clientRow) {
      return NextResponse.json({ error: 'You do not have a client account.' }, { status: 403 })
    }
  }

  const res = NextResponse.json({ success: true, view })
  res.cookies.set(PREFERRED_VIEW_COOKIE, view, {
    httpOnly: false, // readable client-side; not sensitive
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })
  return res
}
