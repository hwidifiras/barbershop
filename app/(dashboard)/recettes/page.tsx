// "Recettes" (barbershop mode, docs/barbershop-mode/SPEC.md 4.15): the money tab. Takings for today, the
// week or the month, per barber, best-selling services, kridi owed, and the period's sales. Paying itself
// happens from a visit ("Encaisser" on Today or the Agenda); "Vente sans RDV" opens the same payment screen
// for a sale with no appointment. Standard businesses keep their sales history.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { isBarbershopMode } from '@/lib/vertical'
import { localYmd } from '@/lib/barbershop-today'
import { parsePeriod, periodRange, summarize } from '@/lib/barbershop-takings'
import { balanceOf } from '@/lib/kridi'
import { RecettesView } from './recettes-view'

export default async function RecettesPage(props: { searchParams: Promise<{ p?: string }> }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const business = await getBusinessForOwner(user.id)
  if (!business) redirect('/onboarding')
  if (!isBarbershopMode(business)) redirect('/pos/history')

  const period = parsePeriod((await props.searchParams).p)
  const tz = business.timezone ?? 'UTC'
  const range = periodRange(period, localYmd(new Date(), tz), tz)
  const supabase = await createClient()

  const [salesRes, ledgerRes, allLedgerRes, barbersRes] = await Promise.all([
    supabase.from('transactions')
      .select('id, amount, employee_id, items, created_at, clients(name), employees(name)')
      .eq('business_id', business.id).eq('status', 'completed')
      .gte('created_at', range.from).lt('created_at', range.to)
      .order('created_at', { ascending: false }),
    supabase.from('client_ledger')
      .select('kind, amount, transaction_id')
      .eq('business_id', business.id).in('kind', ['credit', 'payment'])
      .gte('created_at', range.from).lt('created_at', range.to),
    // Everything owed today, whatever the period: one small row per ledger entry.
    supabase.from('client_ledger').select('client_id, kind, amount').eq('business_id', business.id),
    supabase.from('employees').select('id, name').eq('business_id', business.id),
  ])

  const sales = salesRes.data ?? []
  const t = summarize(sales, ledgerRes.data ?? [])
  const perClient = new Map<string, { kind: string; amount: number }[]>()
  for (const l of allLedgerRes.data ?? []) {
    const list = perClient.get(l.client_id) ?? []
    list.push(l)
    perClient.set(l.client_id, list)
  }
  const owed = [...perClient.values()].reduce((sum, entries) => sum + balanceOf(entries), 0)
  return (
    <RecettesView
      period={period} first={range.first} last={range.last} takings={t} owed={owed}
      barbers={Object.fromEntries((barbersRes.data ?? []).map((b) => [b.id, b.name]))}
      sales={sales.slice(0, 30).map((tx) => ({
        id: tx.id, amount: Number(tx.amount), items: tx.items, created_at: tx.created_at,
        client: (tx.clients as unknown as { name: string } | null)?.name ?? null,
        barber: (tx.employees as unknown as { name: string } | null)?.name ?? null,
      }))}
      currency={business.currency} timezone={tz}
    />
  )
}
