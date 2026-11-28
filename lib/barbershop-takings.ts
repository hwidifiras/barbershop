// "Recettes" (takings) for barbershop mode (docs/barbershop-mode/SPEC.md 4.15). Pure, unit-tested in
// tests/unit/barbershop-takings.spec.ts. Same money rules as Today and kridi (SPEC 4.13):
//   - a sale's `amount` is the money really received at the chair; the unpaid rest is a ledger `credit`
//     linked to the sale (`transaction_id`);
//   - a later repayment is a ledger `payment`, which is money received on the day it is handed over.

import { addDaysYmd, dayRangeIso, weekStartYmd } from '@/lib/barbershop-today'

export type Period = 'day' | 'week' | 'month'

export function parsePeriod(value: string | undefined): Period {
  return value === 'week' || value === 'month' ? value : 'day'
}

/** First and last local day (inclusive) of the period containing `ymd`, plus the ISO range for queries. */
export function periodRange(period: Period, ymd: string, timezone: string): { first: string; last: string; from: string; to: string } {
  let first = ymd
  let next = addDaysYmd(ymd, 1)
  if (period === 'week') {
    first = weekStartYmd(ymd)
    next = addDaysYmd(first, 7)
  } else if (period === 'month') {
    const [y, m] = ymd.split('-').map(Number)
    first = `${y}-${String(m).padStart(2, '0')}-01`
    next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  }
  return { first, last: addDaysYmd(next, -1), from: dayRangeIso(first, timezone).from, to: dayRangeIso(next, timezone).from }
}

export interface TakingsSale {
  id: string
  amount: number | string
  employee_id: string | null
  items: unknown
}

export interface TakingsLedger {
  kind: string
  amount: number | string
  transaction_id: string | null
}

export interface Takings {
  /** Money really received: sales (paid part) + kridi repayments. */
  received: number
  /** Kridi repayments included in `received`. */
  repaid: number
  /** Unpaid parts of sales in the period. */
  kridiGiven: number
  sales: number
  /** Average full price of a sale (paid + kridi). 0 when there is no sale. */
  average: number
  byBarber: { employeeId: string | null; received: number; sales: number }[]
  topServices: { name: string; count: number }[]
}

const n = (v: number | string | null | undefined) => Number(v) || 0
const round3 = (v: number) => Math.round(v * 1000) / 1000

export function summarize(sales: TakingsSale[], ledger: TakingsLedger[]): Takings {
  const creditBySale = new Map<string, number>()
  let kridiGiven = 0
  let repaid = 0
  for (const l of ledger) {
    if (l.kind === 'credit') {
      kridiGiven += n(l.amount)
      if (l.transaction_id) creditBySale.set(l.transaction_id, (creditBySale.get(l.transaction_id) ?? 0) + n(l.amount))
    } else if (l.kind === 'payment') {
      repaid += n(l.amount)
    }
  }

  let paid = 0
  let fullValue = 0
  const barbers = new Map<string | null, { received: number; sales: number }>()
  const services = new Map<string, number>()
  for (const s of sales) {
    const amount = n(s.amount)
    paid += amount
    fullValue += amount + (creditBySale.get(s.id) ?? 0)
    const b = barbers.get(s.employee_id) ?? { received: 0, sales: 0 }
    b.received += amount
    b.sales += 1
    barbers.set(s.employee_id, b)
    for (const item of Array.isArray(s.items) ? (s.items as { name?: unknown; qty?: unknown }[]) : []) {
      const name = typeof item?.name === 'string' ? item.name.trim() : ''
      if (!name) continue
      services.set(name, (services.get(name) ?? 0) + Math.max(1, Number(item.qty) || 1))
    }
  }

  return {
    received: round3(paid + repaid),
    repaid: round3(repaid),
    kridiGiven: round3(kridiGiven),
    sales: sales.length,
    average: sales.length ? round3(fullValue / sales.length) : 0,
    byBarber: [...barbers.entries()]
      .map(([employeeId, v]) => ({ employeeId, received: round3(v.received), sales: v.sales }))
      .sort((a, b) => b.received - a.received),
    topServices: [...services.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'))
      .slice(0, 5),
  }
}
