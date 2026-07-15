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


// PATCH /api/client-workouts - Mark a client-added workout as complete/incomplete
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, completed, notes } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const updates: Record<string, any> = {}
  if (completed !== undefined) updates.completed = completed
  if (notes !== undefined) updates.completed_notes = notes

  // RLS ensures only the owner can update
  const { error } = await supabase
    .from('client_workouts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send email notification to Crystal when a client marks a workout complete
  if (completed === true) {
    try {
      await notifyCrystalClientWorkout(user.id, id, request)
    } catch (notifErr) {
      console.error('Failed to send client workout notification:', notifErr)
    }
  }

  return NextResponse.json({ success: true })
}

// Helper: notify Crystal when a client completes a client-added workout
async function notifyCrystalClientWorkout(userId: string, workoutId: string, request: Request) {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get assigned coaches for this client via client_coaches
  const { data: clientRecord } = await adminClient
    .from('clients')
    .select('id')
    .eq('user_id', userId)
    .single()

  let notifEmails: string[] = []

  if (clientRecord) {
    const { data: coachAssignments } = await adminClient
      .from('client_coaches')
      .select('coach_id')
      .eq('client_id', clientRecord.id)

    if (coachAssignments && coachAssignments.length > 0) {
      const coachIds = coachAssignments.map((ca: any) => ca.coach_id)
      const { data: coachUsers } = await adminClient
        .from('users')
        .select('id, email')
        .in('id', coachIds)

      for (const coach of coachUsers || []) {
        // Check each coach's notification preferences
        const { data: coachPrefs } = await adminClient
          .from('notification_preferences')
          .select('workout_completed, notification_emails')
          .eq('user_id', coach.id)
          .maybeSingle()

        const pref = coachPrefs?.workout_completed || 'immediate'
        if (pref !== 'immediate') continue

        // Use custom notification emails if set, otherwise coach's email
        if (coachPrefs?.notification_emails) {
          const emails = coachPrefs.notification_emails.split(',').map((e: string) => e.trim()).filter(Boolean)
          notifEmails.push(...emails)
        } else if (coach.email) {
          notifEmails.push(coach.email)
        }
      }
    }
  }

  // Fallback: if no coach assignments found, use first admin
  if (notifEmails.length === 0) {
    const { data: adminUsers } = await adminClient
      .from('users')
      .select('id, email')
      .eq('role', 'admin')
      .limit(1)
    const adminUser = adminUsers?.[0]
    if (!adminUser?.email) return
    notifEmails = [adminUser.email]
  }

  if (notifEmails.length === 0) return

  // Get client name
  const { data: clientUser } = await adminClient
    .from('users')
    .select('name')
    .eq('id', userId)
    .single()
  const clientName = clientUser?.name || 'A client'

  // Get the workout details
  const { data: workout } = await adminClient
    .from('client_workouts')
    .select('day, type, training_type, miles, notes, source, activity_name')
    .eq('id', workoutId)
    .single()

  if (!workout) return

  const isStrava = workout.source === 'strava'
  const workoutTitle = workout.activity_name || workout.notes || `${workout.type} workout`
  const workoutDay = workout.day || ''
  const workoutMiles = workout.miles ? `${workout.miles} mi` : ''

  const { sendEmail, getProductionUrl, getEmailBrandFromOrgId } = await import('@/lib/email')
  const { getOrgIdForUser } = await import('@/lib/org')
  const orgId = await getOrgIdForUser(adminClient, userId)
  const brand = getEmailBrandFromOrgId(orgId)
  const siteUrl = getProductionUrl(request.url)

  const subject = `${clientName} completed: ${workoutTitle}${isStrava ? ' (Strava)' : ''}`
  const statusColor = '#22c55e'
  const details = [
    workoutMiles,
    isStrava ? 'Synced from Strava' : 'Client-added workout',
  ].filter(Boolean).join(' &bull; ')

  const emailHtml = `
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">${clientName} — ${workoutDay}</h2>
    <div style="margin: 0 0 8px; display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}44;">Completed</div>
    ${isStrava ? '<div style="margin: 0 0 8px 8px; display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background-color: #f9731622; color: #f97316; border: 1px solid #f9731644;">Strava Sync</div>' : ''}
    <p style="margin: 12px 0 4px; font-size: 15px; color: #ffffff; font-weight: 600;">${workoutTitle}${workoutMiles ? ' — ' + workoutMiles : ''}</p>
    ${details ? `<p style="margin: 8px 0 24px; font-size: 13px; color: #b0b0b0; line-height: 1.5;">${details}</p>` : ''}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${siteUrl}/admin" style="display: inline-block; background-color: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">View in Dashboard</a>
        </td>
      </tr>
    </table>
  `

  for (const email of notifEmails) {
    sendEmail({ to: email, subject, html: emailHtml, brand }).catch(console.error)
  }
}
