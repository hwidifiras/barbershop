import { describe, it, expect } from 'vitest'
import { remindable, reminderRef, reminderUrl, type ReminderAppt } from '@/lib/barbershop-reminders'

const appt = (id: string, starts_at: string, status = 'confirmed', client = true): ReminderAppt => ({
  id, starts_at, status, employee_id: null, items_summary: null, services: null,
  clients: client ? { name: 'Sami', phone: '50300200' } : null,
})

describe('reminderRef', () => {
  it('is the same for one time written two ways', () => {
    expect(reminderRef('a', '2026-11-28T09:00:00Z')).toBe(reminderRef('a', '2026-11-28T10:00:00+01:00'))
  })
  it('changes when the appointment is moved', () => {
    expect(reminderRef('a', '2026-11-28T09:00:00Z')).not.toBe(reminderRef('a', '2026-11-28T09:30:00Z'))
  })
})

describe('reminderUrl', () => {
  it('adds the Tunisian country code and encodes the message', () => {
    expect(reminderUrl('50 300 200', 'à demain !')).toBe('https://wa.me/21650300200?text=%C3%A0%20demain%20!')
  })
  it('is null without a usable number', () => {
    expect(reminderUrl(null, 'x')).toBeNull()
    expect(reminderUrl('12', 'x')).toBeNull()
  })
})

describe('remindable', () => {
  it('keeps upcoming bookings of known clients, earliest first', () => {
    const list = [
      appt('late', '2026-11-28T15:00:00Z'),
      appt('cancelled', '2026-11-28T08:00:00Z', 'cancelled'),
      appt('walkin', '2026-11-28T08:30:00Z', 'confirmed', false),
      appt('early', '2026-11-28T09:00:00Z', 'pending'),
    ]
    expect(remindable(list).map((a) => a.id)).toEqual(['early', 'late'])
  })
})
