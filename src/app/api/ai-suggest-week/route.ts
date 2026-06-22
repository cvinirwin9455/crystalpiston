import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/ai-suggest-week - Generate AI-suggested week plan for a client
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify admin role
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { clientId, dateRange } = body

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  // Use service role to bypass RLS
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    // 1. Get client profile (name, gender, goal)
    const { data: clientRecord } = await adminClient
      .from('clients')
      .select('id, user_id, goal')
      .eq('id', clientId)
      .single()

    if (!clientRecord) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const { data: clientUser } = await adminClient
      .from('users')
      .select('name, gender')
      .eq('id', clientRecord.user_id)
      .single()

    // 2. Get active plan (goal, dates, where they are in training block)
    const { data: activePlans } = await adminClient
      .from('plans')
      .select('id, goal, start_date, end_date, status')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1)

    const activePlan = activePlans?.[0] || null

    // 3. Get past weeks with workouts (last 6 weeks)
    const { data: pastWeeks } = await adminClient
      .from('weeks')
      .select('id, date_range, focus, coach_message, status')
      .eq('client_id', clientId)
      .eq('status', 'published')
      .order('date_range', { ascending: false })
      .limit(6)

    const weekIds = (pastWeeks || []).map(w => w.id)

    // 4. Get workouts for those weeks
    let pastWorkouts: any[] = []
    if (weekIds.length > 0) {
      const { data } = await adminClient
        .from('workouts')
        .select('id, week_id, day, type, training_type, title, miles, description, pace_target, distance_unit')
        .in('week_id', weekIds)
        .order('sort_order', { ascending: true })
      pastWorkouts = data || []
    }

    // 5. Get workout logs (metrics) for those workouts
    const workoutIds = pastWorkouts.map(w => w.id)
    let workoutLogs: any[] = []
    if (workoutIds.length > 0) {
      const { data } = await adminClient
        .from('workout_logs')
        .select('workout_id, status, skip_reason, rpe, actual_miles, actual_pace, stress, notes, on_period, duration, energy, motivation, sleep, strength, recovery, mood, hunger, avg_heartrate, max_heartrate')
        .in('workout_id', workoutIds)
      workoutLogs = data || []
    }

    // 6. Get workout comments
    let workoutComments: any[] = []
    if (workoutIds.length > 0) {
      const { data } = await adminClient
        .from('workout_comments')
        .select('workout_id, message, created_at, user_id')
        .in('workout_id', workoutIds)
        .order('created_at', { ascending: true })
      workoutComments = data || []

      // Get user names for comments
      const commentUserIds = [...new Set(workoutComments.map(c => c.user_id))]
      if (commentUserIds.length > 0) {
        const { data: commentUsers } = await adminClient
          .from('users')
          .select('id, name, role')
          .in('id', commentUserIds)
        const userMap = new Map((commentUsers || []).map(u => [u.id, u]))
        workoutComments = workoutComments.map(c => ({
          ...c,
          userName: userMap.get(c.user_id)?.name || 'Unknown',
          isCoach: userMap.get(c.user_id)?.role === 'admin',
        }))
      }
    }

    // 7. Get client-added workouts (extra training they do on their own)
    let clientWorkouts: any[] = []
    if (weekIds.length > 0) {
      const { data } = await adminClient
        .from('client_workouts')
        .select('week_id, day, type, training_type, miles, notes, completed, source, duration, average_pace, activity_name, avg_heartrate, max_heartrate')
        .in('week_id', weekIds)
        .order('created_at', { ascending: true })
      clientWorkouts = data || []
    }

    // 8. Get Strava activities for context
    let stravaActivities: any[] = []
    if (weekIds.length > 0) {
      const { data } = await adminClient
        .from('strava_activities')
        .select('week_id, activity_name, activity_type, distance_miles, moving_time_seconds, average_heartrate, max_heartrate, match_status')
        .in('week_id', weekIds)
      stravaActivities = data || []
    }

    // Build context for AI
    const logsByWorkoutId = new Map(workoutLogs.map(l => [l.workout_id, l]))
    const commentsByWorkoutId = new Map<string, any[]>()
    for (const c of workoutComments) {
      if (!commentsByWorkoutId.has(c.workout_id)) commentsByWorkoutId.set(c.workout_id, [])
      commentsByWorkoutId.get(c.workout_id)!.push(c)
    }

    // Organize weeks with their workouts, logs, and comments
    const weeksContext = (pastWeeks || []).map(week => {
      const weekWorkouts = pastWorkouts.filter(w => w.week_id === week.id)
      const weekClientWorkouts = clientWorkouts.filter(cw => cw.week_id === week.id)
      const weekStrava = stravaActivities.filter(sa => sa.week_id === week.id)

      return {
        dateRange: week.date_range,
        focus: week.focus,
        coachMessage: week.coach_message,
        workouts: weekWorkouts.map(wo => {
          const log = logsByWorkoutId.get(wo.id)
          const comments = commentsByWorkoutId.get(wo.id) || []
          return {
            day: wo.day,
            type: wo.type,
            trainingType: wo.training_type,
            title: wo.title,
            programmedMiles: wo.miles,
            distanceUnit: wo.distance_unit || 'mi',
            description: wo.description,
            paceTarget: wo.pace_target,
            completed: !!log,
            status: log?.status || 'not logged',
            skipReason: log?.skip_reason || null,
            actualMiles: log?.actual_miles || null,
            actualPace: log?.actual_pace || null,
            rpe: log?.rpe || null,
            stress: log?.stress || null,
            energy: log?.energy || null,
            motivation: log?.motivation || null,
            sleep: log?.sleep || null,
            recovery: log?.recovery || null,
            mood: log?.mood || null,
            hunger: log?.hunger || null,
            duration: log?.duration || null,
            onPeriod: log?.on_period || false,
            avgHeartrate: log?.avg_heartrate || null,
            maxHeartrate: log?.max_heartrate || null,
            notes: log?.notes || null,
            comments: comments.map(c => ({
              from: c.isCoach ? 'Coach' : 'Client',
              message: c.message,
            })),
          }
        }),
        clientAddedWorkouts: weekClientWorkouts.map(cw => ({
          day: cw.day,
          type: cw.type,
          trainingType: cw.training_type,
          miles: cw.miles,
          notes: cw.notes,
          completed: cw.completed,
          source: cw.source,
          duration: cw.duration,
          averagePace: cw.average_pace,
          activityName: cw.activity_name,
          avgHeartrate: cw.avg_heartrate,
          maxHeartrate: cw.max_heartrate,
        })),
        stravaActivities: weekStrava.map(sa => ({
          name: sa.activity_name,
          type: sa.activity_type,
          distanceMiles: sa.distance_miles,
          movingTimeSeconds: sa.moving_time_seconds,
          avgHeartrate: sa.average_heartrate,
          maxHeartrate: sa.max_heartrate,
          matched: sa.match_status === 'matched',
        })),
      }
    })

    // Calculate summary stats
    const completedWorkouts = workoutLogs.filter(l => l.status === 'complete').length
    const skippedWorkouts = workoutLogs.filter(l => l.status === 'skipped').length
    const partialWorkouts = workoutLogs.filter(l => l.status === 'partial').length
    const totalProgrammed = pastWorkouts.filter(w => w.type !== 'rest').length
    const avgRPE = workoutLogs.filter(l => l.rpe).reduce((sum, l) => sum + l.rpe, 0) / (workoutLogs.filter(l => l.rpe).length || 1)
    const avgEnergy = workoutLogs.filter(l => l.energy).reduce((sum, l) => sum + l.energy, 0) / (workoutLogs.filter(l => l.energy).length || 1)
    const avgRecovery = workoutLogs.filter(l => l.recovery).reduce((sum, l) => sum + l.recovery, 0) / (workoutLogs.filter(l => l.recovery).length || 1)
    const avgSleep = workoutLogs.filter(l => l.sleep).reduce((sum, l) => sum + l.sleep, 0) / (workoutLogs.filter(l => l.sleep).length || 1)
    const avgStress = workoutLogs.filter(l => l.stress).reduce((sum, l) => sum + l.stress, 0) / (workoutLogs.filter(l => l.stress).length || 1)
    const recentOnPeriod = workoutLogs.some(l => l.on_period)

    // Calculate weekly mileage trend
    const weeklyMileage = (pastWeeks || []).map(week => {
      const weekWorkoutMiles = pastWorkouts
        .filter(w => w.week_id === week.id && w.miles)
        .reduce((sum, w) => sum + parseFloat(w.miles), 0)
      const actualMiles = workoutLogs
        .filter(l => pastWorkouts.find(w => w.id === l.workout_id && w.week_id === week.id) && l.actual_miles)
        .reduce((sum, l) => sum + parseFloat(l.actual_miles), 0)
      return {
        dateRange: week.date_range,
        programmedMiles: Math.round(weekWorkoutMiles * 10) / 10,
        actualMiles: Math.round(actualMiles * 10) / 10,
      }
    })

    // Determine where they are in their plan
    let weeksIntoTraining = 0
    let totalPlanWeeks = 0
    if (activePlan) {
      const planStart = new Date(activePlan.start_date)
      const planEnd = new Date(activePlan.end_date)
      const now = new Date()
      weeksIntoTraining = Math.max(0, Math.floor((now.getTime() - planStart.getTime()) / (7 * 24 * 60 * 60 * 1000)))
      totalPlanWeeks = Math.ceil((planEnd.getTime() - planStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
    }

    // Build the AI prompt
    const systemPrompt = `You are an expert running coach AI assistant helping a coach named Crystal create weekly training plans for her clients. You have deep knowledge of running periodization, training principles, and individualized programming.

Your job is to suggest a 7-day training week (Monday through Sunday) based on the client's history, metrics, goals, and feedback.

IMPORTANT RULES:
- Always respect the client's current fitness level based on actual performance data
- Progress volume by no more than 10% per week unless recovery metrics suggest otherwise
- If a client has been skipping workouts or reporting high stress/low recovery, reduce volume
- Consider the client's gender for training considerations (e.g., cycle awareness for female athletes - if on_period is reported, suggest lighter intensity)
- Factor in where they are in their overall training plan (build phase vs peak vs taper)
- Use the same workout types and subtypes that Crystal uses in her system
- Be conservative rather than aggressive - it's better to under-prescribe than over-prescribe
- Include a mix of workout types appropriate for their goal
- Always include at least 1 rest day per week
- Consider client-added workouts (extra training they do) in total volume calculations

AVAILABLE WORKOUT TYPES:
- "run" with subtypes: Easy, LongRun, Tempo, Threshold, Intervals, Fartlek, Hills, SpeedRoad, SpeedTrack, Progressive, Recovery, RacePace, ClosePace, TimeTrial, Trail, Treadmill
- "cross" (cross training - no subtype required)
- "cycling" (no subtype required)
- "walk" with subtypes: WalkPower, WalkRecovery
- "stretching" with subtypes: FoamRoll, Stretching, Yoga
- "rest" with subtype: Rest

RESPONSE FORMAT:
You must respond with a valid JSON object with this exact structure:
{
  "focus": "Brief 3-5 word focus for the week",
  "coachMessage": "A personalized motivational message for the client (1-2 sentences) that references their recent progress or the week's goals",
  "reasoning": "Brief explanation of why you chose this plan (for Crystal to review, not shown to client)",
  "days": [
    {
      "day": "Monday",
      "workouts": [
        {
          "type": "run",
          "trainingType": "Easy",
          "title": "Easy Shakeout",
          "miles": "3",
          "description": "Easy conversational pace",
          "paceTarget": "10:00-10:30/mi",
          "coachNotes": ""
        }
      ]
    },
    ... (all 7 days Monday-Sunday)
  ]
}

Each day MUST have at least one workout. Use "rest" type for rest days. The "miles" field should be a string number. Do not include "location" or "distanceUnit" fields - Crystal will set those herself.`

    const userPrompt = `Generate a week plan for this client:

CLIENT PROFILE:
- Name: ${clientUser?.name || 'Unknown'}
- Gender: ${clientUser?.gender || 'not specified'}
- Overall Goal: ${activePlan?.goal || clientRecord.goal || 'Not specified'}
- Plan Period: ${activePlan ? `${activePlan.start_date} to ${activePlan.end_date}` : 'No active plan dates'}
- Currently Week ${weeksIntoTraining} of ${totalPlanWeeks} in their plan
${dateRange ? `- Week being planned: ${dateRange}` : ''}

RECENT PERFORMANCE SUMMARY (last ${pastWeeks?.length || 0} weeks):
- Completion rate: ${totalProgrammed > 0 ? Math.round((completedWorkouts / totalProgrammed) * 100) : 0}% (${completedWorkouts} completed, ${skippedWorkouts} skipped, ${partialWorkouts} partial out of ${totalProgrammed} non-rest workouts)
- Average RPE: ${avgRPE ? avgRPE.toFixed(1) : 'N/A'}/10
- Average Energy: ${avgEnergy ? avgEnergy.toFixed(1) : 'N/A'}/10
- Average Recovery: ${avgRecovery ? avgRecovery.toFixed(1) : 'N/A'}/10
- Average Sleep: ${avgSleep ? avgSleep.toFixed(1) : 'N/A'}/10
- Average Stress: ${avgStress ? avgStress.toFixed(1) : 'N/A'}/10
${clientUser?.gender === 'female' ? `- Recent menstrual cycle reported: ${recentOnPeriod ? 'Yes (in recent logs)' : 'Not recently reported'}` : ''}

WEEKLY MILEAGE TREND (oldest to newest):
${weeklyMileage.reverse().map(w => `- ${w.dateRange}: Programmed ${w.programmedMiles}mi / Actual ${w.actualMiles}mi`).join('\n') || '- No mileage data available'}

DETAILED WEEK HISTORY (most recent first):
${JSON.stringify(weeksContext, null, 2)}

Based on all this data, suggest the next week's training plan. Consider:
1. Volume progression (or reduction if metrics suggest fatigue)
2. The client's goal and where they are in the plan
3. Which days they tend to skip (avoid overloading those days)
4. Their subjective metrics (energy, recovery, stress, sleep)
5. Any comments from coach or client about struggles or preferences
6. Extra workouts they're adding on their own (factor into total volume)
7. Heart rate data from Strava if available
${clientUser?.gender === 'female' ? '8. Menstrual cycle considerations if reported' : ''}

Respond with ONLY the JSON object, no markdown formatting or code blocks.`

    // Call AI via Vercel AI Gateway (uses OpenAI-compatible API)
    // Falls back to direct OpenAI if AI Gateway key is not set
    const aiGatewayKey = process.env.AI_GATEWAY_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY

    let baseUrl: string
    let apiKey: string

    if (aiGatewayKey) {
      // Use Vercel AI Gateway (recommended - built into Vercel, $5 free/month)
      baseUrl = 'https://ai-gateway.vercel.sh/v1'
      apiKey = aiGatewayKey
    } else if (openaiKey) {
      // Fallback to direct OpenAI API
      baseUrl = 'https://api.openai.com/v1'
      apiKey = openaiKey
    } else {
      return NextResponse.json({ 
        error: 'AI not configured. Add AI_GATEWAY_API_KEY (from Vercel AI Gateway) or OPENAI_API_KEY to environment variables.' 
      }, { status: 500 })
    }

    // Use provider-prefixed model name for AI Gateway, plain name for direct OpenAI
    const modelName = aiGatewayKey ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'

    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      console.error('AI API error:', aiResponse.status, errText)
      if (aiResponse.status === 401) {
        return NextResponse.json({ error: 'AI API key is invalid. Check your AI_GATEWAY_API_KEY or OPENAI_API_KEY in Vercel environment variables.' }, { status: 500 })
      }
      return NextResponse.json({ error: 'AI service returned an error. Please try again.' }, { status: 500 })
    }

    const aiData = await aiResponse.json()
    const responseText = aiData.choices?.[0]?.message?.content
    if (!responseText) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 })
    }

    let suggestion
    try {
      suggestion = JSON.parse(responseText)
    } catch (parseErr) {
      console.error('Failed to parse AI response:', responseText)
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 })
    }

    // Validate the structure
    if (!suggestion.days || !Array.isArray(suggestion.days) || suggestion.days.length !== 7) {
      return NextResponse.json({ error: 'AI returned invalid week structure' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      suggestion: {
        focus: suggestion.focus || '',
        coachMessage: suggestion.coachMessage || '',
        reasoning: suggestion.reasoning || '',
        days: suggestion.days,
      },
      meta: {
        model: modelName,
        weeksAnalyzed: pastWeeks?.length || 0,
        workoutsAnalyzed: pastWorkouts.length,
      },
    })

  } catch (err: any) {
    console.error('AI suggest week error:', err)
    return NextResponse.json({ error: err.message || 'Failed to generate AI suggestion' }, { status: 500 })
  }
}
