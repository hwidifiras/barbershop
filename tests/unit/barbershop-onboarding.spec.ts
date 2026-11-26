import { describe, it, expect } from 'vitest'
import { barbershopHourRows, barbershopModules, starterServiceRows } from '@/lib/barbershop-onboarding'

describe('barbershopModules', () => {
  it('leaves Products off unless the shop sells them', () => {
    expect(barbershopModules(false)).toEqual(['bookings', 'crm', 'pos', 'notifications'])
    expect(barbershopModules(true)).toContain('inventory')
  })
})

describe('barbershopHourRows', () => {
  it('opens Tuesday to Saturday only', () => {
    const rows = barbershopHourRows('b1')
    expect(rows).toHaveLength(7)
    expect(rows.filter((r) => r.is_open).map((r) => r.day_of_week)).toEqual([2, 3, 4, 5, 6])
  })
})

describe('starterServiceRows', () => {
  it('takes names from the list, not from the browser', () => {
    expect(starterServiceRows('b1', [{ key: 'cut', price: 18, duration: 30 }])).toEqual([
      { business_id: 'b1', name: 'Coupe', price: 18, duration_min: 30, kind: 'main' },
    ])
  })
  it('drops unknown keys and invalid values', () => {
    expect(starterServiceRows('b1', [
      { key: 'nope', price: 10, duration: 20 },
      { key: 'cut', price: 0, duration: 30 },
      { key: 'beard', price: 10, duration: 2 },
      { key: 'shave', price: Number.NaN, duration: 30 },
    ])).toEqual([])
  })
  it('creates nothing when the step is skipped', () => {
    expect(starterServiceRows('b1', [])).toEqual([])
  })
})
