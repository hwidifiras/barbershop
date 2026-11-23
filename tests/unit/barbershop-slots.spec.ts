import { describe, it, expect } from 'vitest'
import { isBarbershopMode } from '@/lib/vertical'
import {
  computeBarberSlots, slotStepFor, unionSlots, groupByDayPart, minutesInTimezone,
} from '@/lib/barbershop-slots'
import type { DayHours } from '@/lib/booking-availability'

const day = (over: Partial<DayHours> = {}): DayHours => ({
  day_of_week: 2, is_open: true, open_time: '09:00', close_time: '12:00', break_start: null, break_end: null, ...over,
})
const TZ = 'Africa/Tunis' // UTC+1, no DST
// 2026-11-24 10:00 Tunis = 09:00Z
const booking = (startUtc: string, endUtc: string) => ({ starts_at: startUtc, ends_at: endUtc })

describe('isBarbershopMode', () => {
  it('follows type by default', () => {
    expect(isBarbershopMode({ type: 'barbershop' })).toBe(true)
    expect(isBarbershopMode({ type: 'salon' })).toBe(false)
    expect(isBarbershopMode({ type: null })).toBe(false)
    expect(isBarbershopMode(null)).toBe(false)
  })
  it('explicit override wins both ways', () => {
    expect(isBarbershopMode({ type: 'barbershop', barbershop_mode: false })).toBe(false)
    expect(isBarbershopMode({ type: 'salon', barbershop_mode: true })).toBe(true)
    expect(isBarbershopMode({ type: 'barbershop', barbershop_mode: null })).toBe(true)
  })
  it('never turns on for other types', () => {
    for (const t of ['salon', 'auto_repair', 'cafe', 'dental', 'fitness', 'massage', 'other']) {
      expect(isBarbershopMode({ type: t })).toBe(false)
      expect(isBarbershopMode({ type: t, barbershop_mode: null })).toBe(false)
    }
  })
})

describe('slotStepFor', () => {
  it('uses 30 min unless the service length is not a multiple of 30', () => {
    expect(slotStepFor(30)).toBe(30)
    expect(slotStepFor(60)).toBe(30)
    expect(slotStepFor(45)).toBe(15)
    expect(slotStepFor(15)).toBe(15)
  })
})

describe('computeBarberSlots', () => {
  it('lists every start that fits before closing', () => {
    expect(computeBarberSlots({ dayHours: day(), durationMin: 30, booked: [], timezone: TZ }))
      .toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'])
    expect(computeBarberSlots({ dayHours: day(), durationMin: 60, booked: [], timezone: TZ }))
      .toEqual(['09:00', '09:30', '10:00', '10:30', '11:00'])
  })
  it('returns nothing for a closed or missing day', () => {
    expect(computeBarberSlots({ dayHours: day({ is_open: false }), durationMin: 30, booked: [], timezone: TZ })).toEqual([])
    expect(computeBarberSlots({ dayHours: undefined, durationMin: 30, booked: [], timezone: TZ })).toEqual([])
  })
  it('accepts DB time values with seconds', () => {
    expect(computeBarberSlots({ dayHours: day({ open_time: '09:00:00', close_time: '10:00:00' }), durationMin: 30, booked: [], timezone: TZ }))
      .toEqual(['09:00', '09:30'])
  })
  it('removes slots that overlap the break', () => {
    const slots = computeBarberSlots({ dayHours: day({ close_time: '14:00', break_start: '12:00', break_end: '13:00' }), durationMin: 60, booked: [], timezone: TZ })
    expect(slots).toContain('11:00')
    expect(slots).not.toContain('11:30')
    expect(slots).not.toContain('12:00')
    expect(slots).not.toContain('12:30')
    expect(slots).toContain('13:00')
  })
  it('removes slots overlapping an existing booking in the business timezone', () => {
    // Booked 10:00-10:30 Tunis (09:00Z-09:30Z)
    const slots = computeBarberSlots({ dayHours: day(), durationMin: 30, booked: [booking('2026-11-24T09:00:00Z', '2026-11-24T09:30:00Z')], timezone: TZ })
    expect(slots).not.toContain('10:00')
    expect(slots).toContain('09:30')
    expect(slots).toContain('10:30')
  })
  it('a long service cannot start in the gap before a booking', () => {
    const slots = computeBarberSlots({ dayHours: day(), durationMin: 60, booked: [booking('2026-11-24T09:00:00Z', '2026-11-24T09:30:00Z')], timezone: TZ })
    expect(slots).toContain('09:00')     // 09:00-10:00 ends exactly when the booking starts
    expect(slots).not.toContain('09:30') // 09:30-10:30 overlaps 10:00-10:30
    expect(slots).not.toContain('10:00')
    expect(slots).toContain('10:30')     // starts when the booking ends
  })
  it('applies same-day lead time', () => {
    const slots = computeBarberSlots({ dayHours: day(), durationMin: 30, booked: [], timezone: TZ, nowMinutes: 9 * 60 + 10, leadMinutes: 30 })
    expect(slots[0]).toBe('10:00') // 09:00 and 09:30 are within 30 min of 09:10
  })
})

describe('unionSlots / groupByDayPart', () => {
  it('"any barber" offers a time when at least one barber is free', () => {
    expect(unionSlots([['09:00', '10:00'], ['10:00', '11:00']])).toEqual(['09:00', '10:00', '11:00'])
    expect(unionSlots([[], []])).toEqual([])
  })
  it('groups into morning / afternoon / evening', () => {
    expect(groupByDayPart(['09:00', '11:30', '12:00', '16:30', '17:00', '19:30'])).toEqual({
      morning: ['09:00', '11:30'], afternoon: ['12:00', '16:30'], evening: ['17:00', '19:30'],
    })
  })
})

describe('minutesInTimezone', () => {
  it('converts an instant to business-local minutes', () => {
    expect(minutesInTimezone('2026-11-24T09:00:00Z', 'Africa/Tunis')).toBe(10 * 60)
    expect(minutesInTimezone('2026-11-24T00:30:00Z', 'UTC')).toBe(30)
  })
})

import { accentFor, BRASS } from '@/lib/barbershop-theme'
import { fmt, fr } from '@/lib/barbershop-fr'

describe('accentFor', () => {
  it('falls back to brass for the platform default and other dark colours', () => {
    expect(accentFor('#2D2926')).toBe(BRASS)
    expect(accentFor('#000000')).toBe(BRASS)
    expect(accentFor(null)).toBe(BRASS)
    expect(accentFor('not-a-colour')).toBe(BRASS)
  })
  it('keeps a readable brand colour', () => {
    expect(accentFor('#16a34a')).toBe('#16a34a')
    expect(accentFor('#E0B84C')).toBe('#E0B84C')
  })
})

describe('fmt', () => {
  it('fills placeholders', () => {
    expect(fmt(fr.booking.minutes, { n: 45 })).toBe('45 min')
    expect(fmt('Bonjour {name}, {n} min', { name: 'Sami', n: 30 })).toBe('Bonjour Sami, 30 min')
    expect(fmt('{missing}!')).toBe('!')
  })
})
