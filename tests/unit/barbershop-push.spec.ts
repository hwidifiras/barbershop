import { describe, it, expect } from 'vitest'
import { isIOSDevice, newBookingPayload, pushDayLabel, pushSupport, urlBase64ToUint8Array } from '@/lib/barbershop-push'

const TZ = 'Africa/Tunis' // UTC+1, no daylight saving
const now = new Date('2026-11-27T15:00:00Z') // Friday 16:00 in Tunis

describe('pushDayLabel', () => {
  it('says aujourd’hui / demain in the shop time zone', () => {
    expect(pushDayLabel(new Date('2026-11-27T18:00:00Z'), now, TZ)).toBe("aujourd'hui")
    expect(pushDayLabel(new Date('2026-11-28T09:30:00Z'), now, TZ)).toBe('demain')
  })
  it('uses the shop day, not the UTC day, around midnight', () => {
    // 23:30 UTC on the 27th is already 00:30 on the 28th in Tunis.
    expect(pushDayLabel(new Date('2026-11-27T23:30:00Z'), now, TZ)).toBe('demain')
  })
  it('writes other days out in French', () => {
    expect(pushDayLabel(new Date('2026-12-01T09:00:00Z'), now, TZ)).toMatch(/^mardi 1 déc/)
  })
})

describe('newBookingPayload', () => {
  const base = {
    appointmentId: 'a1', clientName: 'Ahmed', summary: 'Coupe + Barbe',
    startsAt: new Date('2026-11-28T09:30:00Z'), timezone: TZ, barberName: 'Firas', now,
  }
  it('names the client, the services, the time and the barber', () => {
    const p = newBookingPayload(base)
    expect(p.title).toBe('Nouveau RDV')
    expect(p.body).toBe('Ahmed · Coupe + Barbe\nDemain à 10:30 avec Firas')
    expect(p.url).toBe('/booking?d=2026-11-28')
    expect(p.tag).toBe('appt-a1')
  })
  it('copes with a missing name, summary or barber', () => {
    const p = newBookingPayload({ ...base, clientName: ' ', summary: null, barberName: null })
    expect(p.body).toBe('Un client\nDemain à 10:30')
  })
})

describe('pushSupport', () => {
  const ok = { hasServiceWorker: true, hasPushManager: true, hasNotification: true, isIOS: false, isStandalone: false, permission: 'default' as const }
  it('Android Chrome in a normal tab is ready', () => {
    expect(pushSupport(ok)).toBe('ready')
  })
  it('iPhone in Safari must first add the app to the home screen', () => {
    expect(pushSupport({ ...ok, isIOS: true, hasPushManager: false })).toBe('ios-install')
  })
  it('iPhone from the home-screen app is ready', () => {
    expect(pushSupport({ ...ok, isIOS: true, isStandalone: true })).toBe('ready')
  })
  it('reports a refusal and missing support', () => {
    expect(pushSupport({ ...ok, permission: 'denied' })).toBe('denied')
    expect(pushSupport({ ...ok, hasPushManager: false })).toBe('unsupported')
  })
})

describe('isIOSDevice', () => {
  it('recognises iPhone and touch iPad, not a Mac or Android', () => {
    expect(isIOSDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true)
    expect(isIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
    expect(isIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
    expect(isIOSDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5)).toBe(false)
  })
})

describe('urlBase64ToUint8Array', () => {
  it('decodes base64url without padding', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID_-8'))).toEqual([1, 2, 3, 255, 239])
  })
})
