// Browser notifications for barbershop mode (docs/barbershop-mode/SPEC.md 4.14). Pure helpers only,
// shared by the server (what to send) and the settings card (what this phone can do).
// Tests: tests/unit/barbershop-push.spec.ts

import { localYmd } from '@/lib/barbershop-today'

export interface PushPayload {
  title: string
  body: string
  /** Page opened when the notification is tapped. */
  url: string
  /** Same tag = the newer notification replaces the older one instead of stacking. */
  tag: string
}

/** "aujourd'hui", "demain" or "samedi 30 nov.", in the shop's time zone. */
export function pushDayLabel(startsAt: Date, now: Date, timezone: string): string {
  const day = localYmd(startsAt, timezone)
  if (day === localYmd(now, timezone)) return "aujourd'hui"
  if (day === localYmd(new Date(now.getTime() + 24 * 3600_000), timezone)) return 'demain'
  return new Intl.DateTimeFormat('fr-FR', { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'short' }).format(startsAt)
}

/** "Nouveau RDV" — Ahmed · Coupe + Barbe / demain à 10:30 avec Firas. */
export function newBookingPayload(b: {
  appointmentId: string
  clientName: string | null
  summary: string | null
  startsAt: Date
  timezone: string
  barberName: string | null
  now?: Date
}): PushPayload {
  const now = b.now ?? new Date()
  const time = new Intl.DateTimeFormat('fr-FR', { timeZone: b.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(b.startsAt)
  const who = [b.clientName?.trim() || 'Un client', b.summary?.trim()].filter(Boolean).join(' · ')
  const when = `${pushDayLabel(b.startsAt, now, b.timezone)} à ${time}`
  const withWho = b.barberName ? ` avec ${b.barberName}` : ''
  const when1 = when.charAt(0).toUpperCase() + when.slice(1)
  return {
    title: 'Nouveau RDV',
    body: `${who}\n${when1}${withWho}`,
    url: `/booking?d=${localYmd(b.startsAt, b.timezone)}`,
    tag: `appt-${b.appointmentId}`,
  }
}

export const TEST_PAYLOAD: PushPayload = {
  title: 'Notifications activées',
  body: 'Vous serez prévenu ici à chaque nouvelle réservation en ligne.',
  url: '/dashboard',
  tag: 'test',
}

export type PushSupport =
  /** This browser cannot receive notifications at all. */
  | 'unsupported'
  /** iPhone/iPad in Safari: works only once the site is added to the home screen and opened from there. */
  | 'ios-install'
  /** The person refused; only the phone's settings can undo it. */
  | 'denied'
  | 'ready'

export function pushSupport(env: {
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  isIOS: boolean
  isStandalone: boolean
  permission: NotificationPermission | null
}): PushSupport {
  // On iOS, Safari only exposes PushManager to a site opened from its home-screen icon.
  if (env.isIOS && !env.isStandalone) return 'ios-install'
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'unsupported'
  if (env.permission === 'denied') return 'denied'
  return 'ready'
}

/** iPhone, iPad (including iPadOS that reports itself as a Mac with touch). */
export function isIOSDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}

/** VAPID public key (base64url) to the bytes PushManager.subscribe() expects. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
