import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/clients/[id] - Update a client
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // Verify the requesting user is admin
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

  const userId = params.id
  const body = await request.json()
  const { name, gender, status, goal, startDate, planEnd, owed, paid } = body

  // Update users table
  const userUpdates: Record<string, any> = {}
  if (name !== undefined) userUpdates.name = name
  if (gender !== undefined) userUpdates.gender = gender
  if (status !== undefined) userUpdates.status = status

  if (Object.keys(userUpdates).length > 0) {
    const { error: userError } = await supabase
      .from('users')
      .update(userUpdates)
      .eq('id', userId)

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }
  }

  // Update clients table
  const clientUpdates: Record<string, any> = {}
  if (goal !== undefined) clientUpdates.goal = goal
  if (startDate !== undefined) clientUpdates.start_date = startDate
  if (planEnd !== undefined) clientUpdates.plan_end = planEnd
  if (owed !== undefined) clientUpdates.owed = parseFloat(owed)
  if (paid !== undefined) clientUpdates.paid = parseFloat(paid)

  if (Object.keys(clientUpdates).length > 0) {
    const { error: clientError } = await supabase
      .from('clients')
      .update(clientUpdates)
      .eq('user_id', userId)

    if (clientError) {
      return NextResponse.json({ error: clientError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/clients/[id] - Archive a client (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // Verify the requesting user is admin
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

  const userId = params.id

  // Soft delete: set status to 'inactive'
  const { error } = await supabase
    .from('users')
    .update({ status: 'inactive' })
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
