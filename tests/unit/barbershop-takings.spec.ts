import { describe, it, expect } from 'vitest'
import { parsePeriod, periodRange, summarize } from '@/lib/barbershop-takings'

const TZ = 'Africa/Tunis' // UTC+1

describe('periodRange', () => {
  it('day: the local day, midnight to midnight in the shop', () => {
    expect(periodRange('day', '2026-11-28', TZ)).toEqual({
      first: '2026-11-28', last: '2026-11-28', from: '2026-11-27T23:00:00.000Z', to: '2026-11-28T23:00:00.000Z',
    })
  })
  it('week: Monday to Sunday', () => {
    const r = periodRange('week', '2026-11-28', TZ) // Saturday
    expect([r.first, r.last]).toEqual(['2026-11-23', '2026-11-29'])
  })
  it('month: first to last day, including December', () => {
    expect(periodRange('month', '2026-11-28', TZ).last).toBe('2026-11-30')
    const dec = periodRange('month', '2026-12-05', TZ)
    expect([dec.first, dec.last, dec.to]).toEqual(['2026-12-01', '2026-12-31', '2026-12-31T23:00:00.000Z'])
  })
  it('unknown period falls back to the day', () => {
    expect(parsePeriod(undefined)).toBe('day')
    expect(parsePeriod('week')).toBe('week')
    expect(parsePeriod('year')).toBe('day')
  })
})

describe('summarize', () => {
  const sales = [
    { id: 's1', amount: 15, employee_id: 'firas', items: [{ name: 'Coupe', qty: 1 }, { name: 'Barbe', qty: 1 }] },
    { id: 's2', amount: 10, employee_id: 'firas', items: [{ name: 'Coupe', qty: 1 }] },
    { id: 's3', amount: '20', employee_id: 'karim', items: [{ name: 'Coupe', qty: 1 }] },
  ]
  // s1 cost 25: paid 15, 10 in kridi. Another client paid back 5 of an older debt.
  const ledger = [
    { kind: 'credit', amount: 10, transaction_id: 's1' },
    { kind: 'payment', amount: '5', transaction_id: null },
  ]

  it('counts money really received, including kridi repayments', () => {
    const t = summarize(sales, ledger)
    expect(t.received).toBe(50) // 15 + 10 + 20 + 5
    expect(t.repaid).toBe(5)
    expect(t.kridiGiven).toBe(10)
    expect(t.sales).toBe(3)
  })
  it('averages the full price of a sale (paid + kridi)', () => {
    expect(summarize(sales, ledger).average).toBe(18.333) // (25 + 10 + 20) / 3
  })
  it('splits by barber, biggest first', () => {
    expect(summarize(sales, ledger).byBarber).toEqual([
      { employeeId: 'firas', received: 25, sales: 2 },
      { employeeId: 'karim', received: 20, sales: 1 },
    ])
  })
  it('ranks services by how often they were sold', () => {
    expect(summarize(sales, ledger).topServices).toEqual([{ name: 'Coupe', count: 3 }, { name: 'Barbe', count: 1 }])
  })
  it('is all zeros with no sales', () => {
    const t = summarize([], [])
    expect([t.received, t.sales, t.average, t.byBarber.length, t.topServices.length]).toEqual([0, 0, 0, 0, 0])
  })
  it('ignores malformed sale lines', () => {
    expect(summarize([{ id: 'x', amount: 5, employee_id: null, items: [{}, { name: ' ' }, null] }], []).topServices).toEqual([])
  })
})
