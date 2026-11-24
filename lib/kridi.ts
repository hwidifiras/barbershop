// Kridi maths (docs/barbershop-mode/SPEC.md 4.13). Pure, unit-tested in tests/unit/kridi.spec.ts.
// Amounts are in the business currency; 3 decimals (DT millimes).

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** How much of a sale is paid now and how much goes to kridi. `input` is what the barber typed ('' = all paid). */
export function splitPayment(total: number, input: string): { received: number; kridi: number } {
  const t = round3(Math.max(0, total))
  const typed = input.trim() === '' ? t : Number(input.replace(',', '.'))
  const received = Number.isFinite(typed) ? round3(Math.min(t, Math.max(0, typed))) : t
  return { received, kridi: round3(t - received) }
}

export interface LedgerEntry { kind: string; amount: number | string }

/** What a client owes: credits minus payments and write-offs (never below 0). */
export function balanceOf(entries: LedgerEntry[]): number {
  let b = 0
  for (const e of entries) {
    const n = Number(e.amount) || 0
    b += e.kind === 'credit' ? n : e.kind === 'payment' || e.kind === 'writeoff' ? -n : 0
  }
  return Math.max(0, round3(b))
}
