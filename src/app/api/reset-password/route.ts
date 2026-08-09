import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail, getEmailBrandFromOrgId, getProductionUrl } from '@/lib/email'
import type { EmailBrand } from '@/lib/email'

async function getAdminClient() {
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/reset-password - Send a branded password reset email
export async function POST(request: Request) {
  const body = await request.json()
  const { email, brand: brandSlug } = body

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  // Debug: log env var status
  const hasApiKey = !!process.env.RESEND_API_KEY
  const apiKeyPrefix = process.env.RESEND_API_KEY?.slice(0, 8) || 'MISSING'
  const senderEmail = process.env.FIRSTMILE_SENDER_EMAIL || process.env.SENDER_EMAIL || 'noreply@firstmilecoach.com'
  console.log(`[reset-password] email=${email}, brand=${brandSlug}, hasApiKey=${hasApiKey}, keyPrefix=${apiKeyPrefix}, sender=${senderEmail}`)

  const adminClient = await getAdminClient()

  // Look up user by email to determine their org/brand
  const { data: userRecord } = await adminClient
    .from('users')
    .select('id, name, organization_id')
    .eq('email', email)
    .single()

  // Determine brand: use the brand passed from the client (based on hostname),
  // or fall back to the user's org if available
  let brand: EmailBrand = 'crystal-pistol'
  let domain = 'www.crystalpistolperformance.com'

  if (brandSlug === 'first-mile') {
    brand = 'first-mile'
    domain = 'www.firstmilecoach.com'
  } else if (userRecord?.organization_id) {
    const orgBrand = getEmailBrandFromOrgId(userRecord.organization_id)
    brand = orgBrand
    if (orgBrand === 'first-mile') {
      domain = 'www.firstmilecoach.com'
    }
  }

  // Generate a password recovery link without sending Supabase's built-in email
  const redirectUrl = `https://${domain}/auth/callback?next=/reset-password`

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: redirectUrl,
    },
  })

  if (linkError) {
    // Don't reveal if the email exists or not (security best practice)
    // If user doesn't exist, Supabase returns an error — we still show success
    console.error('Password reset link error:', linkError.message)
    return NextResponse.json({ success: true })
  }

  // Build the reset URL using token_hash format
  const hashedToken = linkData.properties.hashed_token
  const resetUrl = `https://${domain}/auth/callback?token_hash=${hashedToken}&type=recovery&next=/reset-password`

  // Get user's first name for the email
  const firstName = userRecord?.name?.split(' ')[0] || ''
  const platformName = brand === 'first-mile' ? 'First Mile Coach' : 'Pistol Performance Coaching'

  // Send branded password reset email via Resend
  const emailHtml = `
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff; font-weight: 700;">Reset Your Password</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #b0b0b0; line-height: 1.6;">
      ${firstName ? `Hi ${firstName}! ` : ''}We received a request to reset your password. Click the button below to choose a new one.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${resetUrl}" style="display: inline-block; background-color: #f26522; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px;">Reset Password</a>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 8px; font-size: 13px; color: #888888; line-height: 1.5;">
      If you didn&rsquo;t request a password reset, you can safely ignore this email. Your password will remain unchanged.
    </p>
  `

  const emailSent = await sendEmail({
    to: email,
    subject: `Reset your password`,
    html: emailHtml,
    brand,
  })

  if (!emailSent) {
    console.error(`[reset-password] FAILED to send email to ${email}`)
  } else {
    console.log(`[reset-password] Email sent successfully to ${email}`)
  }

  // Always return success (don't reveal if email exists)
  return NextResponse.json({ success: true, debug: { hasApiKey, keyPrefix: apiKeyPrefix, sender: senderEmail, emailSent } })
}
