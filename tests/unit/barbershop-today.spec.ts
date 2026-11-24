import { describe, it, expect } from 'vitest'
import {
  localYmd, zonedDateTime, dayRangeIso, pickNextAppointment, countDoneRemaining, isOverdue, nextFreeStart, formatMinutes, isYmd, addDaysYmd,
  type TodayAppt,
} from '@/lib/barbershop-today'
import type { DayHours } from '@/lib/booking-availability'

const TZ = 'Africa/Tunis' // UTC+1, no DST
const hours = (o: Partial<DayHours> = {}): DayHours => ({
  day_of_week: 2, is_open: true, open_time: '09:00', close_time: '19:00', break_start: null, break_end: null, ...o,
})
const appt = (id: string, startUtc: string, endUtc: string, status = 'confirmed', employee_id: string | null = 'b1'): TodayAppt =>
  ({ id, starts_at: startUtc, ends_at: endUtc, status, employee_id })

describe('local day in the business timezone', () => {
  it('localYmd uses the shop timezone, not UTC', () => {
    expect(localYmd(new Date('2026-11-23T23:30:00Z'), 'Africa/Tunis')).toBe('2026-11-24') // 00:30 next day in Tunis
    expect(localYmd(new Date('2026-11-23T23:30:00Z'), 'UTC')).toBe('2026-11-23')
  })
  it('zonedDateTime converts wall-clock minutes to UTC', () => {
    expect(zonedDateTime('2026-11-24', 10 * 60, TZ).toISOString()).toBe('2026-11-24T09:00:00.000Z')
    expect(zonedDateTime('2026-11-24', 0, 'UTC').toISOString()).toBe('2026-11-24T00:00:00.000Z')
  })
  it('dayRangeIso covers exactly the local day', () => {
    expect(dayRangeIso('2026-11-24', TZ)).toEqual({ from: '2026-11-23T23:00:00.000Z', to: '2026-11-24T23:00:00.000Z' })
  })
  it('handles a timezone with daylight saving', () => {
    // Europe/Paris: UTC+1 in winter, UTC+2 in summer
    expect(dayRangeIso('2026-07-15', 'Europe/Paris').from).toBe('2026-07-14T22:00:00.000Z')
    expect(dayRangeIso('2026-12-15', 'Europe/Paris').from).toBe('2026-12-14T23:00:00.000Z')
  })
})

describe('pickNextAppointment', () => {
  const now = new Date('2026-11-24T10:10:00Z').getTime() // 11:10 Tunis
  const list = [
    appt('past', '2026-11-24T08:00:00Z', '2026-11-24T08:30:00Z'),
    appt('now', '2026-11-24T10:00:00Z', '2026-11-24T10:30:00Z'),
    appt('later', '2026-11-24T11:00:00Z', '2026-11-24T11:30:00Z'),
    appt('doneOne', '2026-11-24T09:00:00Z', '2026-11-24T09:30:00Z', 'completed'),
    appt('noshow', '2026-11-24T10:05:00Z', '2026-11-24T10:35:00Z', 'no_show'),
    appt('other', '2026-11-24T10:15:00Z', '2026-11-24T10:45:00Z', 'confirmed', 'b2'),
  ]
  it('returns the one in progress first and flags it current', () => {
    expect(pickNextAppointment(list, now)).toMatchObject({ appt: { id: 'now' }, current: true })
  })
  it('skips finished, done, cancelled and no-show', () => {
    const r = pickNextAppointment(list.filter((a) => a.id !== 'now' && a.id !== 'other'), now)
    expect(r).toMatchObject({ appt: { id: 'later' }, current: false })
  })
  it('can be limited to one barber', () => {
    expect(pickNextAppointment(list, now, 'b2')).toMatchObject({ appt: { id: 'other' }, current: false })
  })
  it('returns null when nothing is left', () => {
    expect(pickNextAppointment([list[0], list[3]], now)).toBeNull()
  })
})

describe('countDoneRemaining / isOverdue', () => {
  const list = [
    appt('a', 'x', 'y', 'confirmed'), appt('b', 'x', 'y', 'pending'), appt('c', 'x', 'y', 'completed'),
    appt('d', 'x', 'y', 'paid'), appt('e', 'x', 'y', 'cancelled'), appt('f', 'x', 'y', 'no_show'),
    appt('g', 'x', 'y', 'confirmed', 'b2'),
  ]
  it('counts everyone', () => expect(countDoneRemaining(list)).toEqual({ done: 2, remaining: 3, overdue: 0 }))
  it('counts one barber', () => expect(countDoneRemaining(list, 'b2')).toEqual({ done: 0, remaining: 1, overdue: 0 }))

  const now = new Date('2026-11-24T10:10:00Z').getTime()
  const timed = [
    appt('past', '2026-11-24T08:00:00Z', '2026-11-24T08:30:00Z', 'confirmed'),          // over, never closed
    appt('past2', '2026-11-24T09:00:00Z', '2026-11-24T09:30:00Z', 'pending', 'b2'),     // over, never closed
    appt('now', '2026-11-24T10:00:00Z', '2026-11-24T10:30:00Z', 'confirmed'),           // in progress
    appt('later', '2026-11-24T11:00:00Z', '2026-11-24T11:30:00Z', 'confirmed'),
    appt('doneOne', '2026-11-24T07:00:00Z', '2026-11-24T07:30:00Z', 'completed'),       // closed: not overdue
    appt('gone', '2026-11-24T07:30:00Z', '2026-11-24T08:00:00Z', 'no_show'),            // closed: not overdue
  ]
  it('separates overdue from remaining so the tile agrees with the next-client card', () => {
    expect(countDoneRemaining(timed, undefined, now)).toEqual({ done: 1, remaining: 2, overdue: 2 })
    expect(countDoneRemaining(timed, 'b2', now)).toEqual({ done: 0, remaining: 0, overdue: 1 })
  })
  it('isOverdue only flags unfinished bookings that have ended', () => {
    expect(isOverdue(timed[0], now)).toBe(true)
    expect(isOverdue(timed[2], now)).toBe(false)
    expect(isOverdue(timed[3], now)).toBe(false)
    expect(isOverdue(timed[4], now)).toBe(false)
    expect(isOverdue(timed[5], now)).toBe(false)
  })
})

describe('nextFreeStart (walk-ins)', () => {
  it('starts now (rounded up to 5 min) when the barber is free', () => {
    expect(nextFreeStart({ dayHours: hours(), durationMin: 30, busy: [], nowMinutes: 10 * 60 + 2 })).toBe(10 * 60 + 5)
  })
  it('never starts before opening', () => {
    expect(nextFreeStart({ dayHours: hours(), durationMin: 30, busy: [], nowMinutes: 6 * 60 })).toBe(9 * 60)
  })
  it('waits for the barber to finish the current client', () => {
    // busy 10:00-10:40, now 10:10 -> first free at 10:40
    expect(nextFreeStart({ dayHours: hours(), durationMin: 30, busy: [{ start: 600, end: 640 }], nowMinutes: 610 })).toBe(640)
  })
  it('a longer service skips a gap that is too short', () => {
    // free 10:00-10:20 only (next booking at 10:20) -> a 30 min cut must wait until after it
    const busy = [{ start: 620, end: 660 }]
    expect(nextFreeStart({ dayHours: hours(), durationMin: 30, busy, nowMinutes: 600 })).toBe(660)
    expect(nextFreeStart({ dayHours: hours(), durationMin: 15, busy, nowMinutes: 600 })).toBe(600)
  })
  it('skips the break', () => {
    const h = hours({ break_start: '12:00', break_end: '13:00' })
    expect(nextFreeStart({ dayHours: h, durationMin: 30, busy: [], nowMinutes: 11 * 60 + 45 })).toBe(13 * 60)
  })
  it('returns null when nothing fits before closing, or the shop is closed', () => {
    expect(nextFreeStart({ dayHours: hours(), durationMin: 30, busy: [], nowMinutes: 18 * 60 + 45 })).toBeNull()
    expect(nextFreeStart({ dayHours: hours({ is_open: false }), durationMin: 30, busy: [], nowMinutes: 600 })).toBeNull()
    expect(nextFreeStart({ dayHours: undefined, durationMin: 30, busy: [], nowMinutes: 600 })).toBeNull()
  })
  it('formatMinutes', () => expect(formatMinutes(13 * 60 + 5)).toBe('13:05'))
})

describe('isYmd / addDaysYmd', () => {
  it('accepts only real dates', () => {
    expect(isYmd('2026-11-24')).toBe(true)
    expect(isYmd('2026-02-30')).toBe(false)
    expect(isYmd('2026-1-5')).toBe(false)
    expect(isYmd('')).toBe(false)
    expect(isYmd(undefined)).toBe(false)
  })
  it('moves across month and year ends', () => {
    expect(addDaysYmd('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysYmd('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysYmd('2026-11-24', 0)).toBe('2026-11-24')
  })
})
