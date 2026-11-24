// Pure helpers for the barbershop "Today" screen (docs/barbershop-mode/SPEC.md 4.2):
// the shop's local day, which appointment is next, done/remaining counts, and the next free time
// for a walk-in. No React or Supabase here so everything is unit-tested
// (tests/unit/barbershop-today.spec.ts).

import type { DayHours } from '@/lib/booking-availability'

export interface TodayAppt {
  id: string
  starts_at: string
  ends_at: string
  status: string
  employee_id: string | null
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Today's date (YYYY-MM-DD) in the business timezone. */
export function localYmd(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Wall-clock date + minutes-since-midnight in a named timezone, as a UTC Date. */
export function zonedDateTime(ymd: string, minutes: number, timezone: string): Date {
  const [year, month, day] = ymd.split('-').map(Number)
  // Offset measured at noon UTC of that date: avoids DST edge cases near midnight.
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(noonUtc)
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0')
  const localNoonMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  const offsetMs = localNoonMs - noonUtc.getTime()
  return new Date(Date.UTC(year, month - 1, day, 0, minutes) - offsetMs)
}

/** [start, end) of the business-local day as ISO strings, for database queries. */
export function dayRangeIso(ymd: string, timezone: string): { from: string; to: string } {
  return {
    from: zonedDateTime(ymd, 0, timezone).toISOString(),
    to: zonedDateTime(ymd, 24 * 60, timezone).toISOString(),
  }
}

export type TodayState = 'upcoming' | 'current' | 'done' | 'closed'

const OPEN_STATUSES = ['pending', 'confirmed']
const DONE_STATUSES = ['completed', 'paid']

/** Next appointment still to do (optionally for one barber), and whether it is happening now. */
export function pickNextAppointment<T extends TodayAppt>(
  appts: T[], nowMs: number, barberId?: string,
): { appt: T; current: boolean } | null {
  const open = appts
    .filter((a) => OPEN_STATUSES.includes(a.status) && (!barberId || a.employee_id === barberId) && new Date(a.ends_at).getTime() > nowMs)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
  const appt = open[0]
  if (!appt) return null
  return { appt, current: new Date(appt.starts_at).getTime() <= nowMs }
}

/** An unfinished booking whose end time has already passed: it needs closing (Terminé or Absent). */
export function isOverdue(a: TodayAppt, nowMs: number): boolean {
  return OPEN_STATUSES.includes(a.status) && new Date(a.ends_at).getTime() <= nowMs
}

/**
 * Counts for the strip: done (completed or paid), remaining (pending or confirmed and not over yet)
 * and overdue (pending or confirmed but already past, still to be closed). Without `nowMs`
 * nothing counts as overdue.
 */
export function countDoneRemaining(
  appts: TodayAppt[], barberId?: string, nowMs?: number,
): { done: number; remaining: number; overdue: number } {
  const mine = barberId ? appts.filter((a) => a.employee_id === barberId) : appts
  const open = mine.filter((a) => OPEN_STATUSES.includes(a.status))
  const overdue = nowMs === undefined ? 0 : open.filter((a) => isOverdue(a, nowMs)).length
  return {
    done: mine.filter((a) => DONE_STATUSES.includes(a.status)).length,
    remaining: open.length - overdue,
    overdue,
  }
}

export interface MinuteRange { start: number; end: number }

/**
 * First start time (minutes since midnight) at which `durationMin` fits today for one barber:
 * not before now, inside opening hours, outside the break, not overlapping another booking.
 * Returns null when nothing fits any more today.
 */
export function nextFreeStart(input: {
  dayHours: DayHours | undefined
  durationMin: number
  busy: MinuteRange[]
  nowMinutes: number
  stepMin?: number
}): number | null {
  const { dayHours, durationMin, busy, nowMinutes, stepMin = 5 } = input
  if (!dayHours?.is_open || !dayHours.open_time || !dayHours.close_time || durationMin <= 0) return null
  const open = toMin(dayHours.open_time)
  const close = toMin(dayHours.close_time)
  const breakStart = dayHours.break_start ? toMin(dayHours.break_start) : null
  const breakEnd = dayHours.break_end ? toMin(dayHours.break_end) : null

  const from = Math.max(open, Math.ceil(nowMinutes / stepMin) * stepMin)
  for (let start = from; start + durationMin <= close; start += stepMin) {
    const end = start + durationMin
    if (breakStart !== null && breakEnd !== null && start < breakEnd && end > breakStart) continue
    if (busy.some((b) => start < b.end && end > b.start)) continue
    return start
  }
  return null
}

export const formatMinutes = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** True for a real calendar date written YYYY-MM-DD. */
export function isYmd(v: string | null | undefined): v is string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** The date `n` days after (or before, if negative) a YYYY-MM-DD date. */
export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** The Monday of the week (Monday to Sunday) that contains a YYYY-MM-DD date. */
export function weekStartYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  return addDaysYmd(ymd, -((dow + 6) % 7))
}
