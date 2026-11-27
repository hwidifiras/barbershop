// Server only (uses the service-role client and the private key). Sends browser notifications (Web Push) to the phones saved in push_subscriptions.
// Keys: NEXT_PUBLIC_VAPID_PUBLIC_KEY (also read by the browser), VAPID_PRIVATE_KEY (secret), and
// optionally VAPID_SUBJECT (a mailto: or https: contact for the push services). Without the keys,
// nothing is sent and the settings card says notifications are not available.

import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'
import type { PushPayload } from '@/lib/barbershop-push'

let configured: boolean | null = null

export function pushConfigured(): boolean {
  if (configured !== null) return configured
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return (configured = false)
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://www.we-discipline.com', pub, priv)
    configured = true
  } catch (err) {
    console.error('[push] invalid VAPID keys:', err instanceof Error ? err.message : err)
    configured = false
  }
  return configured
}

export interface PushResult { sent: number; failed: number; removed: number }

/**
 * Send to every saved device of a shop. `employeeId` limits barber devices (phase 5) to their own
 * bookings; devices with no barber (the owner) always receive. Dead subscriptions (404/410: the person
 * uninstalled the app or turned notifications off) are deleted. Never throws.
 */
export async function sendPushToBusiness(
  businessId: string,
  payload: PushPayload,
  opts: { employeeId?: string | null; endpoint?: string } = {},
): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, removed: 0 }
  if (!pushConfigured()) return result
  const db = createServiceClient()
  let q = db.from('push_subscriptions').select('id, endpoint, p256dh, auth, employee_id').eq('business_id', businessId)
  if (opts.endpoint) q = q.eq('endpoint', opts.endpoint)
  const { data: subs, error } = await q
  if (error) {
    console.error('[push] load subscriptions:', error.message)
    return result
  }
  const targets = (subs ?? []).filter((s) => !s.employee_id || !opts.employeeId || s.employee_id === opts.employeeId)
  const body = JSON.stringify(payload)

  await Promise.all(targets.map(async (s) => {
    try {
      // TTL 12 h: a phone that stays off longer would only show a stale booking.
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 12 * 3600, urgency: 'high' })
      result.sent++
      await db.from('push_subscriptions').update({ last_success_at: new Date().toISOString() }).eq('id', s.id)
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        result.removed++
        await db.from('push_subscriptions').delete().eq('id', s.id)
      } else {
        result.failed++
        console.error('[push] send failed:', status ?? '', err instanceof Error ? err.message : err)
      }
    }
  }))
  console.log('[push]', JSON.stringify({ businessId, tag: payload.tag, ...result }))
  return result
}
