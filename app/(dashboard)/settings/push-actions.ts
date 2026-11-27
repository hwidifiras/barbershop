'use server'

// Browser notifications: save / forget this phone, send a test. push_subscriptions is server only, so
// every action first finds the signed-in owner's shop, then writes with the service client.

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { pushConfigured, sendPushToBusiness } from '@/lib/push'
import { TEST_PAYLOAD } from '@/lib/barbershop-push'

const Subscription = z.object({
  endpoint: z.string().url().startsWith('https://').max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
})

async function ownShop(): Promise<{ userId: string; businessId: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: business } = await supabase
    .from('businesses').select('id').eq('owner_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  return business ? { userId: user.id, businessId: business.id } : null
}

/** Remember this phone. Called after the person said yes, and again on each visit (heals a lost row). */
export async function savePushSubscription(sub: unknown, userAgent: string): Promise<{ ok: boolean }> {
  const parsed = Subscription.safeParse(sub)
  if (!parsed.success) return { ok: false }
  const shop = await ownShop()
  if (!shop) return { ok: false }
  const { error } = await createServiceClient().from('push_subscriptions').upsert({
    business_id: shop.businessId,
    user_id: shop.userId,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: userAgent.slice(0, 300),
  }, { onConflict: 'endpoint' })
  if (error) console.error('[push] save subscription:', error.message)
  return { ok: !error }
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const shop = await ownShop()
  if (!shop) return { ok: false }
  const { error } = await createServiceClient().from('push_subscriptions').delete()
    .eq('business_id', shop.businessId).eq('endpoint', endpoint)
  return { ok: !error }
}

/** Sends the test notification to this phone only. */
export async function sendTestPush(endpoint: string): Promise<{ ok: boolean; reason?: 'not_configured' | 'not_saved' | 'failed' }> {
  if (!pushConfigured()) return { ok: false, reason: 'not_configured' }
  const shop = await ownShop()
  if (!shop) return { ok: false, reason: 'failed' }
  const res = await sendPushToBusiness(shop.businessId, TEST_PAYLOAD, { endpoint })
  if (res.sent > 0) return { ok: true }
  return { ok: false, reason: res.removed > 0 || res.failed === 0 ? 'not_saved' : 'failed' }
}
