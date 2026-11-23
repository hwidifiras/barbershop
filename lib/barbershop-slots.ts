// Pure slot logic for the barbershop public booking page.
// Kept free of React/Supabase so it can be unit-tested (tests/unit/barbershop-slots.spec.ts).

import type { DayHours } from '@/lib/booking-availability'

export interface BookedRange { starts_at: string; ends_at: string }

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Minutes since midnight of an ISO instant, in the business timezone. */
export function minutesInTimezone(iso: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso))
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return (h % 24) * 60 + m
}

/** Grid step: 30 min, or 15 min when the service length is not a multiple of 30. */
export function slotStepFor(durationMin: number): number {
  return durationMin % 30 === 0 ? 30 : 15
}

export interface DaySlotsInput {
  dayHours: DayHours | undefined
  durationMin: number
  /** Bookings of ONE barber on that day (already filtered by the caller). */
  booked: BookedRange[]
  timezone: string
  /** Set when the chosen date is today: minutes since midnight now (business tz). */
  nowMinutes?: number
  /** Minimum notice for same-day bookings. */
  leadMinutes?: number
}

/** Free start times ("HH:MM") for one barber on one day. */
export function computeBarberSlots(input: DaySlotsInput): string[] {
  const { dayHours, durationMin, booked, timezone, nowMinutes, leadMinutes = 30 } = input
  if (!dayHours || !dayHours.is_open || !dayHours.open_time || !dayHours.close_time) return []

  const open = toMin(dayHours.open_time)
  const close = toMin(dayHours.close_time)
  const step = slotStepFor(durationMin)
  const breakStart = dayHours.break_start ? toMin(dayHours.break_start) : null
  const breakEnd = dayHours.break_end ? toMin(dayHours.break_end) : null
  const busy = booked.map((b) => [minutesInTimezone(b.starts_at, timezone), minutesInTimezone(b.ends_at, timezone)] as const)

  const out: string[] = []
  for (let start = open; start + durationMin <= close; start += step) {
    const end = start + durationMin
    if (breakStart !== null && breakEnd !== null && start < breakEnd && end > breakStart) continue
    if (nowMinutes !== undefined && start <= nowMinutes + leadMinutes) continue
    if (busy.some(([bs, be]) => start < be && end > bs)) continue
    out.push(fmt(start))
  }
  return out
}

/** "Any barber": a time is offered when at least one barber is free. */
export function unionSlots(perBarber: string[][]): string[] {
  return Array.from(new Set(perBarber.flat())).sort()
}

export type DayPart = 'morning' | 'afternoon' | 'evening'

export function dayPartOf(hhmm: string): DayPart {
  const h = parseInt(hhmm.split(':')[0], 10)
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export function groupByDayPart(slots: string[]): Record<DayPart, string[]> {
  const g: Record<DayPart, string[]> = { morning: [], afternoon: [], evening: [] }
  slots.forEach((s) => g[dayPartOf(s)].push(s))
  return g
}
