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

    if (clientId) {
      // Single client context
      const clientData = await getClientContext(adminClient, clientId, dataDepth || 'standard')
      context = clientData
    } else {
      // All clients summary
      const summaryData = await getAllClientsSummary(adminClient, activeClients, dataDepth || 'light')
      context = summaryData
    }

    // Build the system prompt
    const systemPrompt = `You are Crystal's coaching assistant. Crystal is a running coach who can already see all her client data on her dashboard — DO NOT repeat numbers, stats, mileage, completion rates, or RPE values she already has.

Your job: give SHORT, ACTIONABLE coaching insights she can't easily see herself.

Rules:
- MAX 3-5 bullet points total. No headers, no sections, no summaries, no markdown formatting.
- Never list stats she can already see (miles, RPE, completion %). She has those.
- Focus ONLY on: patterns/trends, what to say to the client, specific plan adjustments, red flags.
- Write like a quick note from a smart assistant — casual, direct, useful.
- If you don't have enough data to spot patterns, say so in one line and stop.
- Start your response immediately with the first bullet point. No greeting, no intro.

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}

CLIENT DATA:
${context}`

    // Call AI
    const response = await fetch(`${baseUrl}/chat/completions`, {
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
        max_tokens: 400,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      console.error('OpenAI error:', err)
      return NextResponse.json({ error: 'AI service error' }, { status: 500 })
    }

    const data = await response.json()
    const aiResponse = data.choices?.[0]?.message?.content || 'No response generated.'

    return NextResponse.json({
      response: aiResponse,
      tokensUsed: data.usage?.total_tokens || 0,
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

  const body = await request.json()
  const { prompt, response, rating } = body // rating: 'up' | 'down'

  // Store feedback (just log for now — can add a table later)
  console.log(`AI Coach Feedback [${rating}]: prompt="${prompt?.slice(0, 100)}" response="${response?.slice(0, 100)}"`)

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
  const { data: clients } = await adminClient
    .from('clients')
    .select('id, user_id')
    .eq('status', 'active')

  const { data: users } = await adminClient
    .from('users')
    .select('id, name')
    .in('id', (clients || []).map(c => c.user_id))

  const clientDataMap: Record<string, { name: string; weeks: number; logs: number; stravaActivities: number }> = {}

  for (const client of clients || []) {
    const userName = users?.find(u => u.id === client.user_id)?.name || 'Unknown'

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
  const { data: clients } = await adminClient
    .from('clients')
    .select('id, user_id')
    .eq('status', 'active')

  const { data: users } = await adminClient
    .from('users')
    .select('id, name')
    .in('id', (clients || []).map((c: any) => c.user_id))

  return (clients || []).map((c: any) => ({
    ...c,
    name: users?.find((u: any) => u.id === c.user_id)?.name || 'Unknown',
  }))
}

// Helper: get single client context
async function getClientContext(adminClient: any, clientId: string, depth: string): Promise<string> {
  const weekLimit = depth === 'light' ? 2 : depth === 'standard' ? 4 : 99

  const { data: client } = await adminClient
    .from('clients')
    .select('id, user_id, goal, experience_level, current_mileage, target_distance, race_date, easy_pace, goal_pace, days_per_week, age, injury_notes')
    .eq('user_id', clientId)
    .single()

  if (!client) return 'Client not found.'

  const { data: user } = await adminClient
    .from('users')
    .select('name, gender')
    .eq('id', clientId)
    .single()

  const { data: plan } = await adminClient
    .from('plans')
    .select('goal, start_date, end_date, status')
    .eq('client_id', client.id)
    .eq('status', 'active')
    .single()

  const { data: weeks } = await adminClient
    .from('weeks')
    .select('id, date_range, focus, status')
    .eq('client_id', client.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(weekLimit)

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
        .select('workout_id, status, rpe, actual_miles, actual_pace, duration, sleep, notes, avg_heartrate, max_heartrate')
        .in('workout_id', workoutIds)
      logs = logsData || []
    }

    const logMap = new Map(logs.map((l: any) => [l.workout_id, l]))

    for (const week of weeks) {
      const weekWorkouts = (workouts || []).filter((w: any) => w.week_id === week.id)
      const completed = weekWorkouts.filter((w: any) => logMap.has(w.id))
      const totalMiles = completed.reduce((s: number, w: any) => {
        const log = logMap.get(w.id)
        return s + (Number(log?.actual_miles) || Number(w.miles) || 0)
      }, 0)
      const avgRpe = completed.filter((w: any) => logMap.get(w.id)?.rpe).length > 0
        ? (completed.reduce((s: number, w: any) => s + (logMap.get(w.id)?.rpe || 0), 0) / completed.filter((w: any) => logMap.get(w.id)?.rpe).length).toFixed(1)
        : 'N/A'

      workoutSummary += `\nWeek ${week.date_range} (${week.focus || 'no focus'}):\n`
      workoutSummary += `  Completion: ${completed.length}/${weekWorkouts.length} workouts\n`
      workoutSummary += `  Miles: ${totalMiles.toFixed(1)}\n`
      workoutSummary += `  Avg RPE: ${avgRpe}\n`

      if (depth !== 'light') {
        for (const wo of weekWorkouts) {
          const log = logMap.get(wo.id)
          if (log) {
            workoutSummary += `    ${wo.day} ${wo.type}${wo.training_type ? '/' + wo.training_type : ''}: ${log.status} | ${log.actual_miles || wo.miles || '?'}mi | RPE ${log.rpe || '?'} | ${log.notes || ''}\n`
          } else {
            workoutSummary += `    ${wo.day} ${wo.type}${wo.training_type ? '/' + wo.training_type : ''}: NOT LOGGED\n`
          }
        }
      }
    }
  }

  return `CLIENT: ${user?.name || 'Unknown'}
Goal: ${plan?.goal || client.goal || 'Not set'}
Plan: ${plan?.start_date || '?'} to ${plan?.end_date || '?'}
Profile: ${user?.gender || '?'} | Age: ${client.age || '?'} | Experience: ${client.experience_level || '?'} | Current MPW: ${client.current_mileage || '?'} | Days/wk: ${client.days_per_week || '?'}
Target: ${client.target_distance || '?'} | Race Date: ${client.race_date || '?'} | Easy Pace: ${client.easy_pace || '?'} | Goal Pace: ${client.goal_pace || '?'}
Injuries: ${client.injury_notes || 'None noted'}

TRAINING HISTORY (last ${weeks?.length || 0} weeks):${workoutSummary || '\nNo published weeks yet.'}`
}

// Helper: get all clients summary
async function getAllClientsSummary(adminClient: any, activeClients: any[], depth: string): Promise<string> {
  let summary = `ACTIVE CLIENTS (${activeClients.length}):\n\n`

  for (const client of activeClients) {
    const { data: plan } = await adminClient
      .from('plans')
      .select('goal')
      .eq('client_id', client.id)
      .eq('status', 'active')
      .maybeSingle()

    // Get this week's data
    const { data: recentWeeks } = await adminClient
      .from('weeks')
      .select('id, date_range, focus')
      .eq('client_id', client.id)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(1)

    let thisWeekStatus = 'No plan'
    if (recentWeeks && recentWeeks.length > 0) {
      const { data: workouts } = await adminClient
        .from('workouts')
        .select('id, type, miles')
        .eq('week_id', recentWeeks[0].id)

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
      const total = (workouts || []).filter((w: any) => w.type !== 'rest').length
      const avgRpe = rpeCount > 0 ? (totalRpe / rpeCount).toFixed(1) : '?'
      thisWeekStatus = `${completedCount}/${total} done | Avg RPE: ${avgRpe}`
    }

    summary += `• ${client.name} — Goal: ${plan?.goal || '?'} | This week: ${thisWeekStatus}\n`
  }

  return summary
}
