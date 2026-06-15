import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/client-workouts?week_id=xxx - Get client-added workouts for a week
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const weekId = searchParams.get('week_id')

  if (!weekId) {
    return NextResponse.json({ error: 'week_id is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('client_workouts')
    .select('*')
    .eq('week_id', weekId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}

// POST /api/client-workouts - Create a client-added workout
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { weekId, day, type, trainingType, miles, notes } = body

  if (!weekId || !day || !type) {
    return NextResponse.json({ error: 'weekId, day, and type are required' }, { status: 400 })
  }

  // Validate the week exists and is the current week (not past/future)
  const { data: week, error: weekError } = await supabase
    .from('weeks')
    .select('id, date_range, status')
    .eq('id', weekId)
    .single()

  if (weekError || !week) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  if (week.status !== 'published') {
    return NextResponse.json({ error: 'Can only add workouts to published weeks' }, { status: 400 })
  }

  // Verify this is the current week
  const today = new Date()
  const dayOfWeek = today.getDay()
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  thisMonday.setHours(0, 0, 0, 0)

  const thisSunday = new Date(thisMonday)
  thisSunday.setDate(thisMonday.getDate() + 6)
  thisSunday.setHours(23, 59, 59, 999)

  // Parse the week's date range to check if it's the current week
  const weekStartStr = week.date_range.split(' - ')[0]
  const weekMonday = new Date(weekStartStr + ', ' + new Date().getFullYear())
  weekMonday.setHours(0, 0, 0, 0)

  // Allow a 1-day buffer for timezone differences
  const diffDays = Math.abs(Math.round((weekMonday.getTime() - thisMonday.getTime()) / (1000 * 60 * 60 * 24)))
  if (diffDays > 1) {
    return NextResponse.json({ error: 'Can only add workouts to the current week' }, { status: 400 })
  }

  // Validate run/walk require trainingType and miles
  if ((type === 'run' || type === 'walk') && !trainingType) {
    return NextResponse.json({ error: 'Run and Walk types require a subtype' }, { status: 400 })
  }
  if ((type === 'run' || type === 'walk') && !miles) {
    return NextResponse.json({ error: 'Run and Walk types require distance' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('client_workouts')
    .insert({
      user_id: user.id,
      week_id: weekId,
      day,
      type,
      training_type: trainingType || null,
      miles: miles ? parseFloat(miles) : null,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// DELETE /api/client-workouts?id=xxx - Delete a client-added workout
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // RLS ensures only the owner can delete
  const { error } = await supabase
    .from('client_workouts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
