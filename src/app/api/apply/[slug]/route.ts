import { NextResponse } from 'next/server'

// PUBLIC (unauthenticated) endpoints for a coach's application link.
//   GET  /api/apply/<slug>  -> returns the coach's public "offer" page content
//   POST /api/apply/<slug>  -> submits a new application (lead capture, NO account)
//
// Both use the service-role key so an unauthenticated prospect can read the
// coach's page and insert an application, while RLS keeps everything else
// locked down. This mirrors the existing /api/beta-signup pattern.

async function adminClient() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// --- GET: public page content for the prospect-facing /join/<slug> page ---
export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const slug = (params.slug || '').toLowerCase()
  const supabase = await adminClient()

  const { data: page, error } = await supabase
    .from('coach_application_pages')
    .select('coach_id, slug, is_enabled, headline, intro, pricing, offer_types, offer_formats')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
  if (!page || !page.is_enabled) {
    // Treat disabled or missing the same way — don't leak which coaches exist.
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Pull the coach's display name + avatar for the page header.
  const { data: coach } = await supabase
    .from('users')
    .select('name, avatar_url')
    .eq('id', page.coach_id)
    .maybeSingle()

  return NextResponse.json({
    slug: page.slug,
    coachName: coach?.name || 'Your coach',
    coachAvatar: coach?.avatar_url || null,
    headline: page.headline || `Apply for coaching with ${coach?.name || 'me'}`,
    intro: page.intro || '',
    pricing: page.pricing || '',
    offerTypes: Array.isArray(page.offer_types) && page.offer_types.length ? page.offer_types : ['running'],
    offerFormats: Array.isArray(page.offer_formats) && page.offer_formats.length ? page.offer_formats : ['programming'],
  })
}

// --- POST: submit an application (lead capture only, no account created) ---
export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    const slug = (params.slug || '').toLowerCase()
    const body = await request.json()
    const {
      full_name, email, phone, age, sex, running_experience, primary_goal,
      target_race, days_available, current_prs, injuries, why_coaching,
      plan_interest, consent_ip, consent_user_agent,
      interested_types, interested_formats,
      pt_goal, training_experience, equipment_access,
      preferred_location, sessions_per_week,
    } = body || {}

    if (!full_name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }

    const supabase = await adminClient()

    // Resolve the coach that owns this link (and what they actually offer).
    const { data: page } = await supabase
      .from('coach_application_pages')
      .select('coach_id, organization_id, is_enabled, offer_types, offer_formats')
      .eq('slug', slug)
      .maybeSingle()

    if (!page || !page.is_enabled) {
      return NextResponse.json({ error: 'This application link is not active.' }, { status: 404 })
    }

    const ageInt = age != null && String(age).trim() !== '' ? parseInt(String(age), 10) : null

    // Only keep selections the coach actually offers (defend against tampering).
    const offeredTypes = Array.isArray(page.offer_types) ? page.offer_types : ['running']
    const offeredFormats = Array.isArray(page.offer_formats) ? page.offer_formats : ['programming']
    const pickedTypes = Array.isArray(interested_types) ? interested_types.filter((t: string) => offeredTypes.includes(t)) : []
    const pickedFormats = Array.isArray(interested_formats) ? interested_formats.filter((f: string) => offeredFormats.includes(f)) : []

    const { error: insertError } = await supabase
      .from('coach_applications')
      .insert({
        coach_id: page.coach_id,
        organization_id: page.organization_id,
        full_name: String(full_name).trim(),
        email: String(email).trim().toLowerCase(),
        phone: phone || null,
        age: Number.isFinite(ageInt as number) ? ageInt : null,
        sex: sex || null,
        running_experience: running_experience || null,
        primary_goal: primary_goal || null,
        target_race: target_race || null,
        days_available: days_available || null,
        current_prs: current_prs || null,
        injuries: injuries || null,
        why_coaching: why_coaching || null,
        plan_interest: plan_interest || null,
        interested_types: pickedTypes,
        interested_formats: pickedFormats,
        pt_goal: pt_goal || null,
        training_experience: training_experience || null,
        equipment_access: equipment_access || null,
        preferred_location: preferred_location || null,
        sessions_per_week: sessions_per_week || null,
        status: 'pending',
        consent_ip: consent_ip || 'unknown',
        consent_user_agent: consent_user_agent || 'unknown',
      })

    if (insertError) {
      return NextResponse.json({ error: `Could not submit: ${insertError.message}` }, { status: 500 })
    }

    // Best-effort notification email to the coach so they don't have to keep
    // refreshing their panel. Never block the applicant on email delivery.
    try {
      await notifyCoach(supabase, page.coach_id, String(full_name).trim(), String(email).trim())
    } catch (err) {
      console.error('Coach application notification failed:', err)
    }

    return NextResponse.json({
      success: true,
      message: "Thanks! Your application has been sent. Your coach will review it and be in touch soon.",
    })
  } catch (err: any) {
    console.error('Application submit crash:', err)
    return NextResponse.json({ error: `Server error: ${err?.message || 'unknown'}` }, { status: 500 })
  }
}

async function notifyCoach(
  supabase: any,
  coachId: string,
  applicantName: string,
  applicantEmail: string
) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const { data: coach } = await supabase
    .from('users')
    .select('email, name')
    .eq('id', coachId)
    .maybeSingle()
  if (!coach?.email) return

  const senderEmail = process.env.FIRSTMILE_SENDER_EMAIL || process.env.SENDER_EMAIL || 'noreply@firstmilecoach.com'
  const coachFirst = (coach.name || '').split(' ')[0] || 'there'

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: `First Mile Coach <${senderEmail}>`,
      to: [coach.email],
      reply_to: 'hello@firstmilecoach.com',
      subject: `New coaching application: ${applicantName}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fafbfc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafbfc;padding:40px 20px;"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,0.08);overflow:hidden;">
      <tr><td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(145deg,#2d3436,#3d4447);">
        <img src="https://www.firstmilecoach.com/firstmile/logo.png" alt="First Mile Coach" width="160" style="display:block;margin:0 auto;border-radius:8px;" />
      </td></tr>
      <tr><td style="padding:40px 32px;">
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#2d3436;">New application, ${coachFirst}!</h1>
        <p style="margin:0 0 20px;font-size:16px;color:#555b5e;line-height:1.7;">
          <strong style="color:#2d3436;">${applicantName}</strong> (${applicantEmail}) applied through your coaching link.
        </p>
        <p style="margin:0 0 24px;font-size:14px;color:#555b5e;line-height:1.7;">
          Open your <strong>Applications</strong> tab in First Mile to review the full application and accept or decline it.
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
          <td align="center" style="border-radius:50px;background:#f26522;">
            <a href="https://www.firstmilecoach.com/admin?view=applications" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:700;color:#fff;text-decoration:none;border-radius:50px;">REVIEW APPLICATION</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid rgba(0,0,0,0.06);text-align:center;background:#fafbfc;">
        <p style="margin:0;font-size:12px;color:#9e9e9e;">First Mile Coach</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
      text: `New application, ${coachFirst}!\n\n${applicantName} (${applicantEmail}) applied through your coaching link.\n\nOpen your Applications tab in First Mile to review and accept or decline:\nhttps://www.firstmilecoach.com/admin?view=applications`,
    }),
  })
}
