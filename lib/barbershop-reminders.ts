// One-tap WhatsApp reminders for barbershop mode: the Today screen lists tomorrow's bookings and the
// barber opens WhatsApp with the message already written. Nothing is sent automatically.
// Pure helpers only (tests/unit/barbershop-reminders.spec.ts).

import { whatsappNumber } from '@/lib/phone'

export const REMINDER_TYPE = 'reminder_manual'
export const REMINDER_CHANNEL = 'whatsapp'

/**
 * What a "reminder opened" mark is stored under in notification_log. The start time is part of it,
 * so moving an appointment makes it show as not reminded again.
 */
export function reminderRef(appointmentId: string, startsAt: string): string {
  return `${appointmentId}@${new Date(startsAt).getTime()}`
}

/** wa.me link with the message written, or null when the number cannot be used. */
export function reminderUrl(phone: string | null | undefined, message: string): string | null {
  const number = whatsappNumber(phone)
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null
}

export interface ReminderAppt {
  id: string
  starts_at: string
  status: string
  employee_id: string | null
  items_summary: string | null
  clients: { name: string; phone: string | null } | null
  services: { name: string } | null
}

/** Bookings still to come that belong to a known client, earliest first. */
export function remindable<T extends ReminderAppt>(appts: T[]): T[] {
  return appts
    .filter((a) => (a.status === 'pending' || a.status === 'confirmed') && a.clients)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
}
