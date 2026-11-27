'use server'

// The app's signed-in users have no access to notification_log (only the server does), so reminder
// marks are written here, after checking that the appointment belongs to the caller's shop.

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { REMINDER_CHANNEL, REMINDER_TYPE, reminderRef } from '@/lib/barbershop-reminders'

async function ownAppointment(appointmentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: business } = await supabase
    .from('businesses').select('id').eq('owner_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!business) return null
  const { data } = await supabase
    .from('appointments').select('id, starts_at').eq('id', appointmentId).eq('business_id', business.id).maybeSingle()
  return data ? { businessId: business.id, id: data.id, startsAt: data.starts_at } : null
}

/** Remember that the reminder for this appointment (at its current time) was opened in WhatsApp. */
export async function markReminded(appointmentId: string): Promise<{ ok: boolean }> {
  const appt = await ownAppointment(appointmentId)
  if (!appt) return { ok: false }
  const { error } = await createServiceClient().from('notification_log').insert({
    business_id: appt.businessId,
    ref_id: reminderRef(appt.id, appt.startsAt),
    type: REMINDER_TYPE,
    channel: REMINDER_CHANNEL,
  })
  // 23505: already marked.
  return { ok: !error || error.code === '23505' }
}

/** After a move: forget the automatic reminders already logged, so the new time gets its own. */
export async function clearSentReminders(appointmentId: string): Promise<void> {
  const appt = await ownAppointment(appointmentId)
  if (!appt) return
  await createServiceClient().from('notification_log').delete()
    .eq('business_id', appt.businessId).eq('ref_id', appt.id).in('type', ['reminder_24h', 'reminder_1h'])
}
