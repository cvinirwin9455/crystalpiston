import webPush from 'web-push'

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@firstmilecoach.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// Brand assets for push notifications (mirrors email branding logic)
const CRYSTAL_PISTOL_ORG_ID = 'fffa6f6b-8226-40d9-9e49-ff17164334f4'

export function getPushBrandFromOrgId(orgId: string | null | undefined): { name: string; icon: string } {
  // All platform push notifications now use First Mile branding
  return {
    name: 'First Mile Coach',
    icon: 'https://www.firstmilecoach.com/firstmile/favicon.png',
  }
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  icon?: string
  badge?: string
  tag?: string
  requireInteraction?: boolean
  actions?: Array<{ action: string; title: string }>
}

/**
 * Send a push notification to a specific user.
 * Fetches all their active push subscriptions and sends to each.
 * Automatically cleans up expired/invalid subscriptions.
 */
export async function sendPushToUser(
  adminClient: any,
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[Push] VAPID keys not configured, skipping push notification')
    return { sent: 0, failed: 0 }
  }

  // Get all subscriptions for this user
  const { data: subscriptions, error } = await adminClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, subscription_json')
    .eq('user_id', userId)

  if (error || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0
  const expiredIds: string[] = []

  for (const sub of subscriptions) {
    try {
      const pushSubscription = JSON.parse(sub.subscription_json)
      await webPush.sendNotification(pushSubscription, JSON.stringify(payload))
      sent++
    } catch (err: any) {
      failed++
      // If subscription is expired/invalid (410 Gone or 404), mark for cleanup
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        expiredIds.push(sub.id)
      } else {
        console.error(`[Push] Failed to send to ${sub.endpoint}:`, err?.message || err)
      }
    }
  }

  // Clean up expired subscriptions
  if (expiredIds.length > 0) {
    await adminClient
      .from('push_subscriptions')
      .delete()
      .in('id', expiredIds)
  }

  return { sent, failed }
}

/**
 * Send push notifications to multiple users at once.
 */
export async function sendPushToUsers(
  adminClient: any,
  userIds: string[],
  payload: PushPayload
): Promise<{ totalSent: number; totalFailed: number }> {
  let totalSent = 0
  let totalFailed = 0

  for (const userId of userIds) {
    const { sent, failed } = await sendPushToUser(adminClient, userId, payload)
    totalSent += sent
    totalFailed += failed
  }

  return { totalSent, totalFailed }
}
