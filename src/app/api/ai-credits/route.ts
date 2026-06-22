import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/ai-credits - Check Vercel AI Gateway credit balance
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

  const aiGatewayKey = process.env.AI_GATEWAY_API_KEY
  if (!aiGatewayKey) {
    return NextResponse.json({ error: 'AI Gateway not configured' }, { status: 500 })
  }

  try {
    const res = await fetch('https://ai-gateway.vercel.sh/v1/credits', {
      headers: {
        'Authorization': `Bearer ${aiGatewayKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('AI credits endpoint error:', res.status, errText)
      return NextResponse.json({ error: 'Failed to fetch credits', status: res.status, raw: errText }, { status: 500 })
    }

    const data = await res.json()
    console.log('AI credits raw response:', JSON.stringify(data))

    // Pass through the raw response and also try to normalize it
    // Vercel AI Gateway may use different field names
    const remaining = data.remaining ?? data.remaining_credits ?? data.balance ?? null
    const used = data.used ?? data.credits_used ?? data.usage ?? null
    const total = data.total ?? data.credits_total ?? data.limit ?? data.granted ?? null

    return NextResponse.json({
      raw: data,
      remaining: remaining,
      used: used,
      total: total,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to check credits' }, { status: 500 })
  }
}
