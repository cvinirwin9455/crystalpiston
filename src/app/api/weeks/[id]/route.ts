import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Helper: parse week date range ("Aug 25 - Aug 31") into Monday date
function parseDateRange(dateRange: string): Date | null {
  if (!dateRange) return null
  const startStr = dateRange.split(' - ')[0]
  if (!startStr) return null
  const now = new Date()
  const year = now.getFullYear()
  const parsed = new Date(`${startStr}, ${year}`)
  if (isNaN(parsed.getTime())) return null
  if (parsed.getTime() < now.getTime() - 180 * 24 * 60 * 60 * 1000) {
    return new Date(`${startStr}, ${year + 1}`)
  }
  return parsed
}

function getDateForDay(mondayDate: Date, dayName: string): Date {
  const dayMap: Record<string, number> = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 }
  const offset = dayMap[dayName] ?? 0
  const date = new Date(mondayDate)
  date.setDate(date.getDate() + offset)
  return date
}

// PATCH /api/weeks/[id] - Update a week (status, focus, coach message)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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

  const weekId = params.id
  const body = await request.json()
  const { dateRange, focus, coachMessage, status } = body

  const updates: Record<string, any> = {}
  if (dateRange !== undefined) updates.date_range = dateRange
  if (focus !== undefined) updates.focus = focus
  if (coachMessage !== undefined) updates.coach_message = coachMessage
  if (status !== undefined) updates.status = status

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('weeks')
    .update(updates)
    .eq('id', weekId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If status changed to published, notify the client
  if (status === 'published') {
    try {
      // Get the week's client_id and date_range
      const { data: week } = await supabase
        .from('weeks')
        .select('client_id, date_range, focus')
        .eq('id', weekId)
        .single()

      if (week) {
        // Auto-create session records for in-person workouts
        try {
          const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
          const sessionAdminClient = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
          )
          // Fetch this week's workouts that are in-person
          const { data: inPersonWorkouts } = await sessionAdminClient
            .from('workouts')
            .select('id, day, type, title, session_type')
            .eq('week_id', weekId)
            .eq('session_type', 'in_person')
            .neq('type', 'rest')

          if (inPersonWorkouts && inPersonWorkouts.length > 0) {
            const mondayDate = parseDateRange(week.date_range)
            if (mondayDate) {
              // Get coach session defaults
              const { data: coachPrefs } = await sessionAdminClient
                .from('notification_preferences')
                .select('default_session_time, default_session_duration, default_session_location')
                .eq('user_id', user.id)
                .single()

              const defaultTime = coachPrefs?.default_session_time || '09:00'
              const defaultDuration = coachPrefs?.default_session_duration || 60
              const defaultLocation = coachPrefs?.default_session_location || null

              // Get client org
              const { data: clientRow } = await sessionAdminClient
                .from('clients')
                .select('organization_id')
                .eq('id', week.client_id)
                .single()
              const orgId = clientRow?.organization_id || user.id

              // One session per in-person day
              const inPersonDays = [...new Set(inPersonWorkouts.map((w: any) => w.day))]
              const sessionRows = inPersonDays.map((dayName: string) => {
                const sessionDate = getDateForDay(mondayDate, dayName)
                const [hours, minutes] = defaultTime.split(':').map(Number)
                sessionDate.setHours(hours, minutes, 0, 0)
                const workout = inPersonWorkouts.find((w: any) => w.day === dayName)
                return {
                  client_id: week.client_id,
                  coach_id: user.id,
                  organization_id: orgId,
                  scheduled_at: sessionDate.toISOString(),
                  duration_minutes: defaultDuration,
                  location: defaultLocation,
                  session_type: workout?.type || null,
                  notes: workout?.title || null,
                  status: 'scheduled',
                }
              })

              if (sessionRows.length > 0) {
                await sessionAdminClient.from('sessions').insert(sessionRows)
              }
            }
          }
        } catch (sessErr) {
          console.error('Failed to auto-create sessions on publish:', sessErr)
        }

        // Get the client's user_id
        const { data: client } = await supabase
          .from('clients')
          .select('user_id')
          .eq('id', week.client_id)
          .single()

        if (client) {
          // Re-link orphaned Strava activities that were imported before this week was published
          try {
            const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
            const adminClient = createSupabaseClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!,
              { auth: { autoRefreshToken: false, persistSession: false } }
            )
            const { relinkOrphanedStravaActivities } = await import('@/lib/strava-relink')
            const relinkResult = await relinkOrphanedStravaActivities(adminClient, client.user_id, weekId, week.date_range)
            if (relinkResult.linked > 0) {
              console.log(`Re-linked ${relinkResult.linked} orphaned Strava activities to week ${weekId} (${relinkResult.matched} matched)`)
            }
          } catch (relinkErr) {
            console.error('Failed to re-link orphaned Strava activities:', relinkErr)
          }

          // Check notification preferences
          const { data: notifPrefs } = await supabase
            .from('notification_preferences')
            .select('plan_published')
            .eq('user_id', client.user_id)
            .single()

          const shouldNotify = notifPrefs ? notifPrefs.plan_published : true

          if (shouldNotify) {
            // Get client's email and name
            const { data: clientUser } = await supabase
              .from('users')
              .select('email, name')
              .eq('id', client.user_id)
              .single()

            if (clientUser?.email) {
              const { sendEmail, buildPlanPublishedEmail, getProductionUrl, getEmailBrandFromOrgId } = await import('@/lib/email')
              // Determine brand from the admin user's organization
              const { data: orgData } = await supabase
                .from('users')
                .select('organization_id')
                .eq('id', user.id)
                .single()
              const brand = getEmailBrandFromOrgId(orgData?.organization_id)
              const siteUrl = getProductionUrl(request.url)
              const emailContent = buildPlanPublishedEmail(
                clientUser.name || 'there',
                week.date_range || dateRange || '',
                week.focus || focus || '',
                siteUrl
              )
              // Fire and forget
              sendEmail({ to: clientUser.email, ...emailContent, brand }).catch(console.error)
            }

            // Send push notification
            try {
              const { createClient: createSupabaseClient2 } = await import('@supabase/supabase-js')
              const pushAdminClient = createSupabaseClient2(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                { auth: { autoRefreshToken: false, persistSession: false } }
              )
              const { sendPushToUser, getPushBrandFromOrgId } = await import('@/lib/push')
              const { data: coachProfile } = await supabase
                .from('users')
                .select('name, organization_id')
                .eq('id', user.id)
                .single()
              const pushBrand = getPushBrandFromOrgId(coachProfile?.organization_id)
              const coachName = coachProfile?.name?.split(' ')[0] || 'Your coach'
              sendPushToUser(pushAdminClient, client.user_id, {
                title: 'New training plan published!',
                body: `${coachName} published your plan for ${week.date_range || dateRange || 'this week'}${week.focus || focus ? ' — ' + (week.focus || focus) : ''}`,
                icon: pushBrand.icon,
                url: '/dashboard',
                tag: `plan-${weekId}`,
              }).catch(console.error)
            } catch (pushErr) {
              console.error('Push notification failed for plan publish:', pushErr)
            }
          }
        }
      }
    } catch (notifErr) {
      console.error('Failed to send publish notification:', notifErr)
    }
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/weeks/[id] - Delete a week and its workouts
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service role to bypass RLS for admin operations
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Check role using service role client
  const { data: profile } = await adminClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const weekId = params.id

  // Verify the week exists before deleting
  const { data: week } = await adminClient
    .from('weeks')
    .select('id')
    .eq('id', weekId)
    .single()

  if (!week) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  // Workouts will be cascade deleted due to FK constraint
  const { error } = await adminClient
    .from('weeks')
    .delete()
    .eq('id', weekId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
