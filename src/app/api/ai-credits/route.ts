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
      return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to check credits' }, { status: 500 })
  }
}
