import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/ai-coach - AI coaching assistant for Crystal
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify admin
  const { data: adminUser } = await adminClient.from('users').select('role').eq('id', user.id).single()
  if (adminUser?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const body = await request.json()
  const { prompt, clientId, dataDepth } = body
  // dataDepth: 'light' (2 weeks), 'standard' (4 weeks), 'deep' (all available)

  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const aiGatewayKey = process.env.AI_GATEWAY_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  let baseUrl: string
  let apiKey: string
  let modelName: string

  if (aiGatewayKey) {
    baseUrl = 'https://ai-gateway.vercel.sh/v1'
    apiKey = aiGatewayKey
    modelName = 'openai/gpt-4o-mini'
  } else if (openaiKey) {
    baseUrl = 'https://api.openai.com/v1'
    apiKey = openaiKey
    modelName = 'gpt-4o-mini'
  } else {
    return NextResponse.json({ error: 'AI not configured. Add AI_GATEWAY_API_KEY or OPENAI_API_KEY to environment variables.' }, { status: 500 })
  }

  try {
    // Gather context data based on scope
    let context = ''
    const activeClients = await getActiveClients(adminClient)

    // Fetch recent positive feedback to learn from
    const { data: goodExamples } = await adminClient
      .from('ai_coach_feedback')
      .select('prompt, response')
      .eq('rating', 'up')
      .order('created_at', { ascending: false })
      .limit(5)

    // Fetch recent negative feedback to avoid
    const { data: badExamples } = await adminClient
      .from('ai_coach_feedback')
      .select('prompt, response')
      .eq('rating', 'down')
      .order('created_at', { ascending: false })
      .limit(3)

    if (clientId) {
      // Single client context — always use at least 'standard' depth for better insights
      const effectiveDepth = dataDepth === 'light' ? 'standard' : (dataDepth || 'standard')
      const clientData = await getClientContext(adminClient, clientId, effectiveDepth)
      context = clientData
    } else {
      // All clients summary
      const summaryData = await getAllClientsSummary(adminClient, activeClients, dataDepth || 'light')
      context = summaryData
    }

    // Build the system prompt
    const today = new Date()
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const todayName = dayNames[today.getDay()]
    const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

    const clientName = clientId ? (activeClients.find((c: any) => c.user_id === clientId)?.name || 'this client') : null

    const systemPrompt = `You are Crystal's coaching assistant. Crystal is a running coach.

${clientName ? `Crystal is asking about: ${clientName}. Answer specifically about this client.` : 'Crystal is asking about all her active clients.'}

WHAT YOU DO:
- Give 3-4 bullet points max
- Tell Crystal what to DO (message a client, adjust a plan, check in)
- Spot patterns she might miss (e.g. "RPE trending up every week" or "always skips Thursdays")
- Suggest specific conversations or plan changes
- Be SPECIFIC — cite actual data points (days, workouts, skip reasons, RPE numbers)
- If a workout was skipped, mention WHY (the skip reason is in the data)

WHAT YOU NEVER DO:
- Never repeat stats (X/Y workouts, miles, RPE numbers) — Crystal has those on her dashboard
- Never mention days that haven't happened yet — they're in the future
- Never flag workouts as "missed" if they're on a day that hasn't occurred yet this week
- Never use wrong pronouns — check the client's gender in the data and use she/her or he/him correctly
- Never use headers, sections, or markdown formatting
- Never write more than 4 bullet points
- Never confuse CLIENT-ADDED workouts (extras the client chose to do) with PROGRAMMED workouts (what Crystal assigned). If a client skipped their programmed workouts but did their own walks instead, that is NOT "completing their workouts" — they skipped their plan.
- Never say a client "completed their workouts" if the data shows SKIPPED status on programmed workouts

CRITICAL DATE RULES:
- Today is ${dateStr} (${todayName}).
- The week runs Monday to Sunday.
- Only Monday through ${todayName} have happened so far this week.
- ${todayName === 'Monday' ? 'Only Monday has happened.' : todayName === 'Tuesday' ? 'Only Mon-Tue have happened.' : todayName === 'Wednesday' ? 'Only Mon-Wed have happened.' : todayName === 'Thursday' ? 'Only Mon-Thu have happened.' : todayName === 'Friday' ? 'Only Mon-Fri have happened.' : todayName === 'Saturday' ? 'Only Mon-Sat have happened.' : 'The full week has happened.'}
- Do NOT count Thursday, Friday, Saturday, or Sunday as missed if today is Wednesday or earlier.
- A client who logged 3 workouts Mon-Wed out of 3 programmed Mon-Wed is at 100% for the week so far.

CLIENT DATA:
${context}${goodExamples && goodExamples.length > 0 ? `

STYLE CRYSTAL LIKES (based on her previous thumbs-up):
${goodExamples.map((ex: any) => `Q: "${ex.prompt.slice(0, 80)}"\nA: "${ex.response.slice(0, 200)}"`).join('\n\n')}` : ''}${badExamples && badExamples.length > 0 ? `

STYLE CRYSTAL DISLIKES (she gave thumbs-down to these — avoid this style):
${badExamples.map((ex: any) => `"${ex.response.slice(0, 150)}"`).join('\n')}` : ''}`

    // Call AI — try gateway first, fall back to direct OpenAI if rate-limited
    console.log('[AI Coach] Context being sent to AI:\n', context.slice(0, 2000))
    let response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: clientId ? 600 : 400,
        temperature: 0.7,
      }),
    })

    // If gateway rate-limits and we have an OpenAI key, retry directly
    if (!response.ok && response.status === 429 && process.env.OPENAI_API_KEY && baseUrl !== 'https://api.openai.com/v1') {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: clientId ? 600 : 400,
          temperature: 0.7,
        }),
      })
    }

    if (!response.ok) {
      const errText = await response.text()
      console.error('AI API error:', response.status, errText)
      let errorDetail = `AI returned status ${response.status}`
      let isRateLimit = false
      try {
        const errJson = JSON.parse(errText)
        errorDetail = errJson.error?.message || errJson.error || errorDetail
        if (response.status === 429 || errorDetail.toLowerCase().includes('rate') || errorDetail.toLowerCase().includes('quota')) {
          isRateLimit = true
        }
      } catch {}
      if (isRateLimit) {
        return NextResponse.json({ error: 'Rate limit reached. Wait 1-2 minutes and try again — the limit resets automatically.', isRateLimit: true }, { status: 429 })
      }
      return NextResponse.json({ error: errorDetail }, { status: 500 })
    }

    const data = await response.json()
    const aiResponse = data.choices?.[0]?.message?.content || 'No response generated.'

    return NextResponse.json({
      response: aiResponse,
      tokensUsed: data.usage?.total_tokens || 0,
      provider: baseUrl.includes('vercel') ? 'Vercel AI Gateway' : 'OpenAI Direct',
    })
  } catch (err: any) {
    console.error('AI Coach error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/ai-coach/feedback - Save thumbs up/down feedback
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const body = await request.json()
  const { prompt, response, rating, clientId } = body

  // Store in database
  await adminClient.from('ai_coach_feedback').insert({
    user_id: user.id,
    prompt: prompt?.slice(0, 500) || '',
    response: response?.slice(0, 1000) || '',
    rating,
    client_id: clientId || null,
  })

  return NextResponse.json({ success: true })
}

// GET /api/ai-coach - Get data availability for clients
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: adminUser } = await adminClient.from('users').select('role').eq('id', user.id).single()
  if (adminUser?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Get active clients with data counts
  const { data: clientUsers } = await adminClient
    .from('users')
    .select('id, name')
    .eq('role', 'client')
    .neq('status', 'inactive')

  const { data: clients } = await adminClient
    .from('clients')
    .select('id, user_id')
    .in('user_id', (clientUsers || []).map((u: any) => u.id))

  const clientDataMap: Record<string, { name: string; weeks: number; logs: number; stravaActivities: number }> = {}

  for (const client of clients || []) {
    const userName = clientUsers?.find((u: any) => u.id === client.user_id)?.name || 'Unknown'

    const { count: weekCount } = await adminClient
      .from('weeks')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .eq('status', 'published')

    const { data: weekIds } = await adminClient
      .from('weeks')
      .select('id')
      .eq('client_id', client.id)
      .eq('status', 'published')

    let logCount = 0
    let stravaCount = 0
    if (weekIds && weekIds.length > 0) {
      const { data: workouts } = await adminClient
        .from('workouts')
        .select('id')
        .in('week_id', weekIds.map(w => w.id))

      if (workouts && workouts.length > 0) {
        const { count } = await adminClient
          .from('workout_logs')
          .select('id', { count: 'exact', head: true })
          .in('workout_id', workouts.map(w => w.id))
        logCount = count || 0
      }

      const { count: sCount } = await adminClient
        .from('strava_activities')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', client.user_id)
      stravaCount = sCount || 0
    }

    clientDataMap[client.user_id] = {
      name: userName,
      weeks: weekCount || 0,
      logs: logCount,
      stravaActivities: stravaCount,
    }
  }

  return NextResponse.json(clientDataMap)
}

// Helper: get active clients
async function getActiveClients(adminClient: any) {
  // Active clients are determined by users.status (not clients table)
  const { data: clientUsers } = await adminClient
    .from('users')
    .select('id, name')
    .eq('role', 'client')
    .neq('status', 'inactive')

  const { data: clients } = await adminClient
    .from('clients')
    .select('id, user_id')
    .in('user_id', (clientUsers || []).map((u: any) => u.id))

  return (clients || []).map((c: any) => ({
    ...c,
    name: clientUsers?.find((u: any) => u.id === c.user_id)?.name || 'Unknown',
  }))
}

// Helper: get single client context
async function getClientContext(adminClient: any, clientId: string, depth: string): Promise<string> {
  try {
  const weekLimit = depth === 'light' ? 2 : depth === 'standard' ? 4 : 99

  const { data: client, error: clientError } = await adminClient
    .from('clients')
    .select('id, user_id, goal')
    .eq('user_id', clientId)
    .maybeSingle()

  if (clientError || !client) return `Client not found (user_id: ${clientId}, error: ${clientError?.message || 'no record'}).`

  // Try to get optional training profile fields (columns may not exist)
  let trainingProfile: any = {}
  try {
    const { data } = await adminClient
      .from('clients')
      .select('experience_level, current_mileage, target_distance, race_date, easy_pace, goal_pace, days_per_week, age, injury_notes')
      .eq('user_id', clientId)
      .maybeSingle()
    trainingProfile = data || {}
  } catch {}

  const { data: user } = await adminClient
    .from('users')
    .select('name, gender')
    .eq('id', clientId)
    .single()

  const { data: plan } = await adminClient
    .from('plans')
    .select('goal, start_date, end_date, status, owed, paid')
    .eq('client_id', client.id)
    .eq('status', 'active')
    .maybeSingle()

  const { data: allPublishedWeeks } = await adminClient
    .from('weeks')
    .select('id, date_range, focus, status')
    .eq('client_id', client.id)
    .eq('status', 'published')

  // Filter to only weeks that have started (not future weeks)
  const today = new Date()
  const weeks = (allPublishedWeeks || []).filter((w: any) => {
    const weekStartStr = w.date_range.split(' - ')[0]
    const weekStart = new Date(weekStartStr + ', ' + today.getFullYear())
    return weekStart <= today
  }).sort((a: any, b: any) => {
    // Sort by date descending (most recent first)
    const dateA = new Date(a.date_range.split(' - ')[0] + ', ' + today.getFullYear())
    const dateB = new Date(b.date_range.split(' - ')[0] + ', ' + today.getFullYear())
    return dateB.getTime() - dateA.getTime()
  }).slice(0, weekLimit)

  let workoutSummary = ''
  if (weeks && weeks.length > 0) {
    const { data: workouts } = await adminClient
      .from('workouts')
      .select('id, week_id, day, type, training_type, miles')
      .in('week_id', weeks.map((w: any) => w.id))

    const workoutIds = (workouts || []).map((w: any) => w.id)
    let logs: any[] = []
    if (workoutIds.length > 0) {
      const { data: logsData } = await adminClient
        .from('workout_logs')
        .select('workout_id, status, skip_reason, rpe, actual_miles, actual_pace, duration, sleep, notes, avg_heartrate, max_heartrate')
        .in('workout_id', workoutIds)
      logs = logsData || []
    }

    const logMap = new Map(logs.map((l: any) => [l.workout_id, l]))

    for (const week of weeks) {
      const weekWorkouts = (workouts || []).filter((w: any) => w.week_id === week.id)
      const completed = weekWorkouts.filter((w: any) => logMap.has(w.id))
      const totalMiles = completed.filter((w: any) => {
        const log = logMap.get(w.id)
        return log && log.status !== 'skipped'
      }).reduce((s: number, w: any) => {
        const log = logMap.get(w.id)
        return s + (Number(log?.actual_miles) || Number(w.miles) || 0)
      }, 0)
      const avgRpe = completed.filter((w: any) => logMap.get(w.id)?.rpe).length > 0
        ? (completed.reduce((s: number, w: any) => s + (logMap.get(w.id)?.rpe || 0), 0) / completed.filter((w: any) => logMap.get(w.id)?.rpe).length).toFixed(1)
        : 'N/A'

      workoutSummary += `\nWeek ${week.date_range} (${week.focus || 'no focus'}):\n`
      // For current week, only count workouts on days that have happened
      const dayNames2 = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      const todayIdx2 = today.getDay() === 0 ? 6 : today.getDay() - 1
      const isCurrentWeek2 = week === weeks[0]
      const relevantWorkouts = isCurrentWeek2
        ? weekWorkouts.filter((w: any) => dayNames2.indexOf(w.day) <= todayIdx2)
        : weekWorkouts
      const relevantCompleted = relevantWorkouts.filter((w: any) => {
        const log = logMap.get(w.id)
        return log && log.status !== 'skipped'
      })
      const relevantSkipped = relevantWorkouts.filter((w: any) => {
        const log = logMap.get(w.id)
        return log && log.status === 'skipped'
      })
      const nonRestRelevant = relevantWorkouts.filter((w: any) => w.type !== 'rest')
      
      workoutSummary += `  Completion: ${relevantCompleted.length}/${nonRestRelevant.length} PROGRAMMED workouts completed${relevantSkipped.length > 0 ? ` | ${relevantSkipped.length} SKIPPED` : ''}${isCurrentWeek2 ? ' (through ' + dayNames2[todayIdx2] + ')' : ''}\n`
      workoutSummary += `  Miles: ${totalMiles.toFixed(1)}\n`
      workoutSummary += `  Avg RPE: ${avgRpe}\n`

      // Always include per-workout detail for single-client queries
      for (const wo of weekWorkouts) {
        const log = logMap.get(wo.id)
        // Check if this workout's day is in the future (hasn't happened yet this week)
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1
        const woIdx = dayNames.indexOf(wo.day)
        // Only mark as future if this is the CURRENT week (most recent)
        const isCurrentWeek = week === weeks[0]
        const isFutureDay = isCurrentWeek && woIdx > todayIdx

        if (log) {
          const statusLabel = log.status === 'skipped' ? 'SKIPPED' : log.status === 'partial' ? 'PARTIAL' : 'complete'
          workoutSummary += `    ${wo.day} ${wo.type}${wo.training_type ? '/' + wo.training_type : ''}: ${statusLabel}${log.status === 'skipped' && log.skip_reason ? ' (' + log.skip_reason + ')' : ''} | ${log.status !== 'skipped' ? (log.actual_miles || wo.miles || '?') + 'mi | RPE ' + (log.rpe || '?') : ''}${log.sleep ? ' | Sleep ' + log.sleep : ''}${log.notes && !log.notes.startsWith('Auto-synced') && !log.notes.startsWith('Synced from') ? ' | "' + log.notes + '"' : ''}\n`
        } else if (isFutureDay) {
          workoutSummary += `    ${wo.day} ${wo.type}${wo.training_type ? '/' + wo.training_type : ''}: UPCOMING (hasn't happened yet)\n`
        } else {
          workoutSummary += `    ${wo.day} ${wo.type}${wo.training_type ? '/' + wo.training_type : ''}: NOT LOGGED\n`
        }
      }
    }
  }

  // Also get client-created workouts and comments for richer context
  let extraContext = ''
  if (weeks && weeks.length > 0) {
    const { data: clientWorkouts } = await adminClient
      .from('client_workouts')
      .select('week_id, day, type, training_type, miles, notes, completed, source, activity_name')
      .in('week_id', weeks.map((w: any) => w.id))
      .eq('user_id', clientId)
      .neq('source', 'strava')
    
    if (clientWorkouts && clientWorkouts.length > 0) {
      extraContext += '\n\nCLIENT-ADDED WORKOUTS (extra training they chose to do):\n'
      for (const cw of clientWorkouts) {
        extraContext += `  ${cw.day} ${cw.type}${cw.training_type ? '/' + cw.training_type : ''}: ${cw.miles || '?'}mi ${cw.completed ? '(done)' : '(planned)'} ${cw.notes || ''}\n`
      }
    }

    // Get workout comments (conversations between coach and client)
    const workoutIds = (await adminClient.from('workouts').select('id').in('week_id', weeks.map((w: any) => w.id))).data?.map((w: any) => w.id) || []
    if (workoutIds.length > 0) {
      const { data: comments } = await adminClient
        .from('workout_comments')
        .select('workout_id, message, user_id')
        .in('workout_id', workoutIds)
        .order('created_at', { ascending: true })
        .limit(20)
      
      if (comments && comments.length > 0) {
        extraContext += '\n\nRECENT WORKOUT COMMENTS (coach-client conversations):\n'
        for (const c of comments) {
          const isCoach = c.user_id !== clientId
          extraContext += `  ${isCoach ? 'Crystal' : 'Client'}: "${c.message}"\n`
        }
      }
    }
  }

  return `CLIENT: ${user?.name || 'Unknown'} (${user?.gender === 'female' ? 'she/her' : user?.gender === 'male' ? 'he/him' : 'they/them'})
Goal: ${plan?.goal || client.goal || 'Not set'}
Plan: ${plan?.start_date || '?'} to ${plan?.end_date || '?'}
Payment: ${plan?.owed ? `$${plan.owed} owed, $${plan.paid || 0} paid${(plan.owed - (plan.paid || 0)) > 0 ? ' — $' + (plan.owed - (plan.paid || 0)) + ' OUTSTANDING' : ' — Paid in full'}` : 'No payment info'}
Profile: ${user?.gender || '?'} | Age: ${trainingProfile.age || '?'} | Experience: ${trainingProfile.experience_level || '?'} | Current MPW: ${trainingProfile.current_mileage || '?'} | Days/wk: ${trainingProfile.days_per_week || '?'}
Target: ${trainingProfile.target_distance || '?'} | Race Date: ${trainingProfile.race_date || '?'} | Easy Pace: ${trainingProfile.easy_pace || '?'} | Goal Pace: ${trainingProfile.goal_pace || '?'}
Injuries: ${trainingProfile.injury_notes || 'None noted'}

TRAINING HISTORY (last ${weeks?.length || 0} weeks):${workoutSummary || '\nNo published weeks yet.'}${extraContext}`
  } catch (err: any) {
    return `Error loading client data: ${err.message}`
  }
}

// Helper: get all clients summary
async function getAllClientsSummary(adminClient: any, activeClients: any[], depth: string): Promise<string> {
  let summary = `ACTIVE CLIENTS (${activeClients.length}):\n\n`

  // Determine current week's Monday
  const today = new Date()
  const dayOfWeek = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  monday.setHours(0, 0, 0, 0)

  for (const client of activeClients) {
    const { data: plan } = await adminClient
      .from('plans')
      .select('goal, owed, paid')
      .eq('client_id', client.id)
      .eq('status', 'active')
      .maybeSingle()

    const outstanding = plan?.owed && plan?.paid !== undefined ? (plan.owed - (plan.paid || 0)) : 0

    // Find the week that matches the current calendar week
    const { data: allWeeks } = await adminClient
      .from('weeks')
      .select('id, date_range, focus')
      .eq('client_id', client.id)
      .eq('status', 'published')

    let currentWeek: any = null
    for (const week of allWeeks || []) {
      const weekStartStr = week.date_range.split(' - ')[0]
      const weekStart = new Date(weekStartStr + ', ' + today.getFullYear())
      const diffDays = Math.abs(Math.round((weekStart.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24)))
      if (diffDays <= 1) {
        currentWeek = week
        break
      }
    }

    let thisWeekStatus = 'No plan published for this week'
    if (currentWeek) {
      const { data: workouts } = await adminClient
        .from('workouts')
        .select('id, type, day, miles')
        .eq('week_id', currentWeek.id)

      const workoutIds = (workouts || []).map((w: any) => w.id)
      let completedCount = 0
      let totalRpe = 0
      let rpeCount = 0
      if (workoutIds.length > 0) {
        const { data: logs } = await adminClient
          .from('workout_logs')
          .select('workout_id, status, rpe')
          .in('workout_id', workoutIds)
        completedCount = (logs || []).length
        for (const log of logs || []) {
          if (log.rpe) { totalRpe += log.rpe; rpeCount++ }
        }
      }

      // Also count client-created workouts that are completed this week
      const { data: clientWorkouts } = await adminClient
        .from('client_workouts')
        .select('id, completed')
        .eq('week_id', currentWeek.id)
        .eq('user_id', client.user_id)
        .eq('completed', true)
      const clientCompletedCount = (clientWorkouts || []).length

      // Only count programmed non-rest workouts that are on days up to today
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      const todayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 0=Mon, 6=Sun
      const pastDays = days.slice(0, todayIndex + 1)
      const pastWorkouts = (workouts || []).filter((w: any) => w.type !== 'rest' && pastDays.includes(w.day))

      const totalSoFar = pastWorkouts.length
      const totalCompleted = completedCount + clientCompletedCount
      if (totalSoFar === 0) {
        thisWeekStatus = `${totalCompleted} completed (no programmed workouts due yet)`
      } else {
        thisWeekStatus = `${totalCompleted} completed out of ${totalSoFar} due so far (${7 - todayIndex - 1} days remaining in week)`
      }
    }

    summary += `• ${client.name} — Goal: ${plan?.goal || '?'} | ${thisWeekStatus}${outstanding > 0 ? ' | ⚠️ $' + outstanding + ' outstanding' : ''}\n`
  }

  return summary
}
