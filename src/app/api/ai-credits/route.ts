import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/ai-credits - Check AI usage from local tracking + optional Vercel AI Gateway
export async function GET() {
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

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Monthly budget (can be configured via env or defaults to $5)
  const monthlyBudget = parseFloat(process.env.AI_MONTHLY_BUDGET || '5.00')

  // Get current month boundaries
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

  try {
    // Query local usage log for this month
    const { data: monthlyLogs, error: logError } = await adminClient
      .from('ai_usage_log')
      .select('estimated_cost, tokens_used, created_at, client_id, data_depth')
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd)
      .order('created_at', { ascending: false })

    if (logError) {
      console.error('[AI Credits] Error querying usage log:', logError)
      // Fall back to gateway-only if table doesn't exist yet
    }

    const logs = monthlyLogs || []
    const monthlyUsed = logs.reduce((sum, log) => sum + (parseFloat(log.estimated_cost) || 0), 0)
    const monthlyTokens = logs.reduce((sum, log) => sum + (log.tokens_used || 0), 0)
    const queryCount = logs.length

    // Build daily breakdown for the current month
    const dailyBreakdown: Record<string, { cost: number; queries: number }> = {}
    for (const log of logs) {
      const day = new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!dailyBreakdown[day]) dailyBreakdown[day] = { cost: 0, queries: 0 }
      dailyBreakdown[day].cost += parseFloat(log.estimated_cost) || 0
      dailyBreakdown[day].queries += 1
    }

    // Also try Vercel AI Gateway for comparison (non-blocking)
    let gatewayData: any = null
    const aiGatewayKey = process.env.AI_GATEWAY_API_KEY
    if (aiGatewayKey) {
      try {
        const res = await fetch('https://ai-gateway.vercel.sh/v1/credits', {
          headers: {
            'Authorization': `Bearer ${aiGatewayKey}`,
            'Content-Type': 'application/json',
          },
        })
        if (res.ok) {
          gatewayData = await res.json()
        }
      } catch {
        // Gateway check is optional, don't fail
      }
    }

    return NextResponse.json({
      // Local tracking (primary source of truth)
      used: monthlyUsed,
      total: monthlyBudget,
      remaining: monthlyBudget - monthlyUsed,
      tokens: monthlyTokens,
      queries: queryCount,
      month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      dailyBreakdown,
      // Gateway data (secondary/comparison)
      gateway: gatewayData,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to check credits' }, { status: 500 })
  }
}
