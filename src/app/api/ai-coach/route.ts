import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOrgIdForUser } from '@/lib/org'

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
    const activeClients = await getActiveClients(adminClient, await getOrgIdForUser(adminClient, user.id))

    // Fetch admin's distance unit preference
    let adminDistanceUnit = 'mi'
    try {
      const { data: notifPrefs } = await adminClient
        .from('notification_preferences')
        .select('distance_unit')
        .eq('user_id', user.id)
        .maybeSingle()
      if (notifPrefs?.distance_unit) adminDistanceUnit = notifPrefs.distance_unit
    } catch {}

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
      const clientData = await getClientContext(adminClient, clientId, effectiveDepth, adminDistanceUnit)
      context = clientData
    } else {
      // All clients summary
      const summaryData = await getAllClientsSummary(adminClient, activeClients, dataDepth || 'light', adminDistanceUnit)
      context = summaryData
    }

    // Build the system prompt
    const today = new Date()
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const todayName = dayNames[today.getDay()]
    const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

    const clientName = clientId ? (activeClients.find((c: any) => c.user_id === clientId)?.name || 'this client') : null

    const systemPrompt = `You are Crystal's coaching assistant. Crystal is a running coach.

ABSOLUTE RULE: You must ONLY state facts that appear in the CLIENT DATA below. If a workout shows "NOT LOGGED" it was NOT completed. If a workout shows "UPCOMING" it hasn't happened yet. NEVER fabricate or assume completion status, distances, or any data points. If in doubt, say "no data available" rather than guessing.

DISTANCE UNIT: Always use ${adminDistanceUnit === 'km' ? 'KILOMETERS (km)' : 'MILES (mi)'} when mentioning distances. Never use ${adminDistanceUnit === 'km' ? 'miles' : 'kilometers'}.

${clientName ? `Crystal is asking about: ${clientName}. Answer specifically about this client.` : 'Crystal is asking about all her active clients.'}

WHAT YOU DO:
- Give 3-4 bullet points max
- Be BALANCED — always mention what the client IS doing (including client-added workouts and Strava activity) before noting concerns
- Tell Crystal what to DO (message a client, adjust a plan, check in)
- Spot patterns she might miss (e.g. "RPE trending up every week" or "always skips Thursdays")
- Suggest specific conversations or plan changes
- Be SPECIFIC — cite actual data points (days, workouts, skip reasons, RPE numbers)
- If a workout was skipped, mention WHY (the skip reason is in the data)
- Always include CLIENT-ADDED workout data — if a client skipped programmed workouts but did their own runs/walks, MENTION IT. They are still being active.
- Use the distance amounts from the data when referencing what clients have done

WHAT YOU NEVER DO:
- Never repeat stats (X/Y workouts, miles, RPE numbers) — Crystal has those on her dashboard
- Never mention days that haven't happened yet — they're in the future
- Never flag workouts as "missed" or "skipped" if they're on a day that hasn't occurred yet this week
- NEVER say "skipped all workouts this week" if it's only Monday or Tuesday — the week JUST STARTED. Only days that have passed count.
- Never use wrong pronouns — check the client's gender in the data and use she/her or he/him correctly
- Never be overly negative — if a client is doing ANYTHING (client-added workouts, Strava activities, partial completions), acknowledge it positively before raising concerns
- Never ignore client-added workouts when assessing activity levels — a client who skips programmed workouts but does their own 5km runs is NOT inactive
- NEVER FABRICATE DATA. If a workout shows "NOT LOGGED" or "UPCOMING" in the data, it has NOT been completed. Do not say a client "completed" a workout unless the data explicitly shows status: complete/partial.
- NEVER invent distances, RPE numbers, or completion status. Only cite data points that are EXPLICITLY in the CLIENT DATA section below.
- If the data shows 0 completed workouts for the current week, say "no workouts logged yet this week" — do NOT invent a completion.
- "NOT LOGGED" means the workout exists and is DUE but the client hasn't recorded whether they did it or skipped it yet. This is DIFFERENT from "no workout programmed". Do NOT say "first workout is on Wednesday" if Monday shows "NOT LOGGED" — that means Monday HAS a workout, it just hasn't been logged yet.
- When summarizing the current week, look at EACH DAY's status. If Monday shows "NOT LOGGED", say "Monday's [type] workout hasn't been logged yet" — don't skip over it.
- Never use headers, sections, or markdown formatting
- Never write more than 4 bullet points
- Never confuse CLIENT-ADDED workouts (extras the client chose to do) with PROGRAMMED workouts (what Crystal assigned). If a client skipped their programmed workouts but did their own walks instead, that is NOT "completing their workouts" — they skipped their plan.
- Never say a client "completed their workouts" if the data shows SKIPPED status on programmed workouts

CRITICAL DATE RULES:
- Today is ${dateStr} (${todayName}).
- The week runs Monday to Sunday.
- Only Monday through ${todayName} have happened so far this week.
- ${todayName === 'Monday' ? 'ONLY Monday has happened. Do NOT judge the week yet — it literally just started today. A client cannot have "skipped all week" if only Monday has passed.' : todayName === 'Tuesday' ? 'Only Mon-Tue have happened. The week JUST started — do not draw weekly conclusions from 1-2 days.' : todayName === 'Wednesday' ? 'Only Mon-Wed have happened.' : todayName === 'Thursday' ? 'Only Mon-Thu have happened.' : todayName === 'Friday' ? 'Only Mon-Fri have happened.' : todayName === 'Saturday' ? 'Only Mon-Sat have happened.' : 'The full week has happened.'}
- Do NOT count Thursday, Friday, Saturday, or Sunday as missed if today is Wednesday or earlier.
- A client who logged 3 workouts Mon-Wed out of 3 programmed Mon-Wed is at 100% for the week so far.
- NEVER say "has not completed any workouts this week" if it's Monday — the first workout of the week may not even be due yet or may be later today.
- NEVER comment on "0 distance this week" or "no distance logged this week" if it's early in the week (Mon-Wed) and no RUN or distance workout was programmed for the days that have passed. If Monday was a Rest day and today is Monday, the client has done exactly what was asked.
- NEVER compare current week distance to past weeks if the current week has barely started. A "drop from 99km to 0km" is meaningless if it's only Monday and the runs are scheduled for later in the week.
- Only flag distance concerns if a distance workout was PROGRAMMED for a day that HAS PASSED and the client didn't do it.

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
        temperature: 0.3,
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
  const orgId = await getOrgIdForUser(adminClient, user.id)
  let clientQuery = adminClient
    .from('users')
    .select('id, name')
    .eq('role', 'client')
    .neq('status', 'inactive')
  if (orgId) clientQuery = clientQuery.eq('organization_id', orgId)
  const { data: clientUsers } = await clientQuery

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
async function getActiveClients(adminClient: any, orgId?: string | null) {
  // Active clients are determined by users.status (not clients table)
  let query = adminClient
    .from('users')
    .select('id, name')
    .eq('role', 'client')
    .neq('status', 'inactive')
  if (orgId) query = query.eq('organization_id', orgId)
  const { data: clientUsers } = await query

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
async function getClientContext(adminClient: any, clientId: string, depth: string, distanceUnit: string = 'mi'): Promise<string> {
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

  console.log(`[AI Coach] Client ${clientId}: clients.id=${client.id}, published weeks found: ${allPublishedWeeks?.length || 0}`)

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
  let allWorkouts: any[] = []
  let logMap = new Map<string, any>()
  if (weeks && weeks.length > 0) {
    const weekIds = weeks.map((w: any) => w.id)
    let workoutsData: any[] = []
    // Batch week IDs to avoid query limits
    for (let i = 0; i < weekIds.length; i += 20) {
      const batch = weekIds.slice(i, i + 20)
      const { data } = await adminClient
        .from('workouts')
        .select('id, week_id, day, type, training_type, miles')
        .in('week_id', batch)
      if (data) workoutsData = [...workoutsData, ...data]
    }
    allWorkouts = workoutsData

    const workoutIds = allWorkouts.map((w: any) => w.id)
    let logs: any[] = []
    if (workoutIds.length > 0) {
      // Batch in groups of 50 to avoid Supabase URL length limits on .in() queries
      for (let i = 0; i < workoutIds.length; i += 50) {
        const batch = workoutIds.slice(i, i + 50)
        const { data: logsData, error: logsError } = await adminClient
          .from('workout_logs')
          .select('workout_id, status, skip_reason, rpe, actual_miles, actual_pace, duration, sleep, notes, avg_heartrate, max_heartrate')
          .in('workout_id', batch)
        if (logsError) console.error('[AI Coach] Logs query error:', logsError.message)
        if (logsData) logs = [...logs, ...logsData]
      }
    }

    logMap = new Map(logs.map((l: any) => [l.workout_id, l]))
    console.log(`[AI Coach] Client ${clientId}: Found ${weeks.length} weeks (IDs: ${weeks.map((w:any) => w.id).join(',')}), ${allWorkouts.length} workouts, ${logs.length} logs. Current week: ${weeks[0]?.date_range}`)

    for (const week of weeks) {
      const weekWorkouts = allWorkouts.filter((w: any) => w.week_id === week.id)
      const completed = weekWorkouts.filter((w: any) => logMap.has(w.id))
      const totalMilesMi = completed.filter((w: any) => {
        const log = logMap.get(w.id)
        return log && log.status !== 'skipped'
      }).reduce((s: number, w: any) => {
        const log = logMap.get(w.id)
        return s + (Number(log?.actual_miles) || Number(w.miles) || 0)
      }, 0)

      // Also include client-added workout miles for this week
      let clientAddedMilesMi = 0
      try {
        const { data: cwData } = await adminClient
          .from('client_workouts')
          .select('miles, completed')
          .eq('week_id', week.id)
        clientAddedMilesMi = (cwData || []).filter((cw: any) => cw.completed && cw.miles).reduce((s: number, cw: any) => s + (Number(cw.miles) || 0), 0)
      } catch {}

      const totalMilesWithExtras = totalMilesMi + clientAddedMilesMi
      // Convert to admin's preferred unit
      const totalDist = distanceUnit === 'km' ? totalMilesWithExtras * 1.60934 : totalMilesWithExtras
      const unitLabel = distanceUnit === 'km' ? 'km' : 'mi'
      const avgRpe = completed.filter((w: any) => logMap.get(w.id)?.rpe).length > 0
        ? (completed.reduce((s: number, w: any) => s + (logMap.get(w.id)?.rpe || 0), 0) / completed.filter((w: any) => logMap.get(w.id)?.rpe).length).toFixed(1)
        : 'N/A'

      workoutSummary += `\nWeek ${week.date_range} (${week.focus || 'no focus'})${isCurrentWeek2 ? ' [THIS IS THE CURRENT WEEK - only through ' + dayNames2[todayIdx2] + ']' : ''}:\n`
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
      
      workoutSummary += `  Completion: ${relevantCompleted.length}/${nonRestRelevant.length} PROGRAMMED non-rest workouts completed${relevantSkipped.length > 0 ? ` | ${relevantSkipped.length} SKIPPED` : ''}${nonRestRelevant.length === 0 ? ' (no non-rest workouts due yet for days that have passed)' : ''}${isCurrentWeek2 ? ' (through ' + dayNames2[todayIdx2] + ' only)' : ''}\n`
      workoutSummary += `  Distance: ${totalDist.toFixed(1)} ${unitLabel}${clientAddedMilesMi > 0 ? ` (includes ${(distanceUnit === 'km' ? clientAddedMilesMi * 1.60934 : clientAddedMilesMi).toFixed(1)} ${unitLabel} from client-added workouts)` : ''}\n`
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
          const logMiles = Number(log?.actual_miles) || Number(wo.miles) || 0
          const logDist = distanceUnit === 'km' ? (logMiles * 1.60934).toFixed(1) : logMiles.toFixed(1)
          workoutSummary += `    ${wo.day} ${wo.type}${wo.training_type ? '/' + wo.training_type : ''}: ${statusLabel}${log.status === 'skipped' && log.skip_reason ? ' (' + log.skip_reason + ')' : ''} | ${log.status !== 'skipped' ? logDist + unitLabel + ' | RPE ' + (log.rpe || '?') : ''}${log.sleep ? ' | Sleep ' + log.sleep : ''}${log.notes && !log.notes.startsWith('Auto-synced') && !log.notes.startsWith('Synced from') ? ' | "' + log.notes + '"' : ''}\n`
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
    
    if (clientWorkouts && clientWorkouts.length > 0) {
      extraContext += '\n\nCLIENT-ADDED & STRAVA WORKOUTS (actual activity the client DID — this IS training they completed on their own):\n'
      for (const cw of clientWorkouts) {
        const cwDist = cw.miles ? (distanceUnit === 'km' ? (Number(cw.miles) * 1.60934).toFixed(1) : Number(cw.miles).toFixed(1)) : '?'
        const sourceLabel = cw.source === 'strava' ? '[Strava]' : '[Client-Added]'
        extraContext += `  ${cw.day} ${sourceLabel} ${cw.type}${cw.training_type ? '/' + cw.training_type : ''}${cw.activity_name ? ' "' + cw.activity_name + '"' : ''}: ${cwDist}${distanceUnit} ${cw.completed ? '(completed)' : '(planned)'} ${cw.notes || ''}\n`
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

${(() => {
  // Compute progress trends from training history
  if (!weeks || weeks.length < 2) return 'PROGRESS TRENDS: Not enough data (need 2+ weeks).'
  
  const weeklyStats = weeks.map((week: any) => {
    const weekWorkouts = allWorkouts.filter((w: any) => w.week_id === week.id)
    const weekLogs = weekWorkouts.filter((w: any) => logMap.has(w.id)).map((w: any) => logMap.get(w.id))
    const completedLogs = weekLogs.filter((l: any) => l.status === 'complete')
    const skippedLogs = weekLogs.filter((l: any) => l.status === 'skipped')
    const nonRest = weekWorkouts.filter((w: any) => w.type !== 'rest')
    const totalMilesMi = completedLogs.reduce((s: number, l: any) => s + (Number(l.actual_miles) || 0), 0)
    const totalDist2 = distanceUnit === 'km' ? totalMilesMi * 1.60934 : totalMilesMi
    const avgRpe = completedLogs.filter((l: any) => l.rpe).length > 0 
      ? completedLogs.reduce((s: number, l: any) => s + (l.rpe || 0), 0) / completedLogs.filter((l: any) => l.rpe).length 
      : null
    const avgPace = completedLogs.filter((l: any) => l.actual_pace).map((l: any) => {
      const match = l.actual_pace.match(/(\d+):(\d+)/)
      return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : null
    }).filter(Boolean)
    
    return {
      dateRange: week.date_range,
      completed: completedLogs.length,
      skipped: skippedLogs.length,
      total: nonRest.length,
      dist: Math.round(totalDist2 * 10) / 10,
      avgRpe,
      avgPaceSec: avgPace.length > 0 ? Math.round(avgPace.reduce((a: number, b: number) => a + b, 0) / avgPace.length) : null,
    }
  }).reverse() // oldest first for trend analysis

  let trends = 'PROGRESS TRENDS (oldest → newest):\n'
  trends += weeklyStats.map((w: any) => {
    const paceStr = w.avgPaceSec ? `${Math.floor(w.avgPaceSec / 60)}:${(w.avgPaceSec % 60).toString().padStart(2, '0')}/${distanceUnit}` : '?'
    return `  ${w.dateRange}: ${w.completed}/${w.total} done (${w.skipped} skipped) | ${w.dist}${distanceUnit} | RPE ${w.avgRpe?.toFixed(1) || '?'} | Pace ${paceStr}`
  }).join('\n')

  // Calculate direction
  if (weeklyStats.length >= 2) {
    const recent = weeklyStats.slice(-2)
    const distTrend = recent[1].dist - recent[0].dist
    const complianceTrend = (recent[1].completed / (recent[1].total || 1)) - (recent[0].completed / (recent[0].total || 1))
    trends += `\n  DIRECTION: Distance ${distTrend > 0 ? '↑' : distTrend < 0 ? '↓' : '→'} (${distTrend > 0 ? '+' : ''}${distTrend.toFixed(1)}${distanceUnit}) | Compliance ${complianceTrend > 0 ? '↑' : complianceTrend < 0 ? '↓' : '→'}`
  }
  
  return trends
})()}

TRAINING HISTORY (last ${weeks?.length || 0} weeks):${workoutSummary || '\nNo published weeks yet.'}${extraContext}`
  } catch (err: any) {
    return `Error loading client data: ${err.message}`
  }
}

// Helper: get all clients summary
async function getAllClientsSummary(adminClient: any, activeClients: any[], depth: string, distanceUnit: string = 'mi'): Promise<string> {
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
      let skippedCount = 0
      let totalRpe = 0
      let rpeCount = 0
      if (workoutIds.length > 0) {
        const { data: logs } = await adminClient
          .from('workout_logs')
          .select('workout_id, status, rpe')
          .in('workout_id', workoutIds)
        completedCount = (logs || []).filter((l: any) => l.status === 'complete').length
        skippedCount = (logs || []).filter((l: any) => l.status === 'skipped').length
        for (const log of logs || []) {
          if (log.rpe) { totalRpe += log.rpe; rpeCount++ }
        }
      }

      // Only count programmed non-rest workouts that are on days up to today
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      const todayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 0=Mon, 6=Sun
      const pastDays = days.slice(0, todayIndex + 1)
      const pastWorkouts = (workouts || []).filter((w: any) => w.type !== 'rest' && pastDays.includes(w.day))

      const totalSoFar = pastWorkouts.length
      if (totalSoFar === 0) {
        thisWeekStatus = `No programmed workouts due yet this week`
      } else {
        thisWeekStatus = `${completedCount}/${totalSoFar} PROGRAMMED completed${skippedCount > 0 ? ` | ${skippedCount} SKIPPED` : ''} (${7 - todayIndex - 1} days remaining)`
      }
    }

    summary += `• ${client.name} — Goal: ${plan?.goal || '?'} | ${thisWeekStatus}${outstanding > 0 ? ' | ⚠️ $' + outstanding + ' outstanding' : ''}\n`
  }

  return summary
}
