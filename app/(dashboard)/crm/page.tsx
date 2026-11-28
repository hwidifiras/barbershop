import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CrmImportButton } from '@/components/clients/crm-import-button'
import { formatCurrency, formatInBusinessTimezone } from '@/lib/utils'
import { CalendarPlus, MessageCircle, Plus, Search, Phone, Mail } from 'lucide-react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { isBarbershopMode } from '@/lib/vertical'
import { fr, fmt } from '@/lib/barbershop-fr'
import { formatPhone, whatsappNumber } from '@/lib/phone'
import { balanceOf } from '@/lib/kridi'
import { FAB_POSITION } from '@/lib/barbershop-theme'

export default async function CRMPage(
  props: {
    searchParams: Promise<{ q?: string; tag?: string; view?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient()
  const t = await getTranslations('crm')
  const locale = await getLocale()
  const user = await getAuthUser()

  const business = await getBusinessForOwner(user!.id)

  if (!business) redirect('/onboarding')

  const barbershop = isBarbershopMode(business)

  // Barbershop: who owes what (kridi). One small read of the ledger, grouped per client.
  const owed = new Map<string, { amount: number; since: string }>()
  if (barbershop) {
    const { data: rows } = await supabase.from('client_ledger').select('client_id, kind, amount, created_at')
      .eq('business_id', business.id).order('created_at', { ascending: true })
    const byClient = new Map<string, { kind: string; amount: number; created_at: string }[]>()
    for (const r of rows ?? []) byClient.set(r.client_id, [...(byClient.get(r.client_id) ?? []), r])
    for (const [id, list] of byClient) {
      const amount = balanceOf(list)
      if (amount > 0) owed.set(id, { amount, since: list.find((e) => e.kind === 'credit')?.created_at ?? list[0].created_at })
    }
    if (searchParams.view === 'kridi') {
      const ids = Array.from(owed.keys())
      const { data: debtors } = ids.length
        ? await supabase.from('clients').select('id, name, phone').eq('business_id', business.id).in('id', ids)
        : { data: [] as { id: string; name: string; phone: string | null }[] }
      const list = (debtors ?? []).sort((a, b) => owed.get(b.id)!.amount - owed.get(a.id)!.amount || owed.get(a.id)!.since.localeCompare(owed.get(b.id)!.since))
      const total = list.reduce((t, c) => t + owed.get(c.id)!.amount, 0)
      const money = (n: number) => formatCurrency(n, business.currency, 'fr-FR')
      return (
        <>
          <Header title={t('title')} />
          <main className="p-4 md:p-6 max-w-lg space-y-3">
            <KridiTabs active="kridi" />
            <div className="text-sm font-semibold text-gray-900">{fmt(fr.kridi.totalOwed, { amount: money(total) })}</div>
            {list.length === 0 ? (
              <div className="rounded-xl bg-white border border-gray-200 p-6 text-center text-gray-700">{fr.kridi.nobody}</div>
            ) : (
              <ul className="space-y-2">
                {list.map((c) => {
                  const o = owed.get(c.id)!
                  const wa = whatsappNumber(c.phone)
                  return (
                    <li key={c.id} className="rounded-xl bg-white border border-gray-200 p-3">
                      <Link href={`/crm/${c.id}`} className="flex items-center justify-between gap-3 min-h-[44px]">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{c.name}</div>
                          <div className="text-xs text-gray-500">{c.phone ? formatPhone(c.phone) : ''} · {fmt(fr.kridi.since, { date: formatInBusinessTimezone(o.since, business.timezone, 'date', 'fr') })}</div>
                        </div>
                        <span className="shrink-0 text-lg font-bold tabular-nums text-orange-600">{money(o.amount)}</span>
                      </Link>
                      {c.phone && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="min-h-[44px] rounded-xl border border-gray-300 flex items-center justify-center gap-2 text-sm font-semibold text-gray-800"><Phone className="w-4 h-4" />{fr.kridi.call}</a>
                          {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="min-h-[44px] rounded-xl border border-gray-300 flex items-center justify-center text-sm font-semibold text-gray-800">{fr.kridi.whatsapp}</a>}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </main>
        </>
      )
    }
  }

  let query = supabase.from('clients')
    .select('id, name, phone, email, tags, created_at')
    .eq('business_id', business.id)
    .order('name')
    .limit(50)

  if (searchParams.q) {
    // Characters that are structural in a PostgREST filter string cannot be part of a search term.
    const q = searchParams.q.replace(/[,()%*\\]/g, ' ').trim()
    // Barbershop mode: a number is found whatever its spelling ("50 300", "+216 50300200", "300200").
    const digits = barbershop ? q.replace(/\D/g, '') : ''
    if (q && digits.length >= 3) {
      query = query.or(`name.ilike.%${q}%,phone_key.ilike.%${digits}%`)
    } else if (q) {
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
    }
  }
  if (searchParams.tag) {
    query = query.contains('tags', [searchParams.tag])
  }

  const { data: clients } = await query

  // Compute visits, spent, last visit, and last service name live from transactions
  const clientIds = (clients ?? []).map((c) => c.id)
  const statsMap: Record<string, { total_visits: number; total_spent: number; last_visit_at: string | null; lastService: string | null }> = {}
  if (clientIds.length > 0) {
    const { data: txs } = await supabase
      .from('transactions')
      .select('client_id, amount, created_at, items')
      .eq('business_id', business.id)
      .eq('status', 'completed')
      .in('client_id', clientIds)
      .order('created_at', { ascending: false })
      .limit(500)
    for (const tx of txs ?? []) {
      if (!tx.client_id) continue
      if (!statsMap[tx.client_id]) {
        statsMap[tx.client_id] = { total_visits: 0, total_spent: 0, last_visit_at: null, lastService: null }
      }
      statsMap[tx.client_id].total_visits++
      statsMap[tx.client_id].total_spent += tx.amount
      if (!statsMap[tx.client_id].last_visit_at) statsMap[tx.client_id].last_visit_at = tx.created_at
      if (!statsMap[tx.client_id].lastService) {
        const items = Array.isArray(tx.items) ? tx.items : []
        const name = (items[0] as any)?.name
        if (name) statsMap[tx.client_id].lastService = name
      }
    }
  }

  return (
    <>
      <Header
        title={t('title')}
        actions={
          // Barbershop phone: the header keeps only the title, like the other screens; adding a client is the
          // floating button below and importing is a computer task (SPEC 4.5). Computers keep this row.
          <div className={barbershop ? 'hidden md:flex gap-2' : 'flex gap-2'}>
            <CrmImportButton />
            <Link href="/crm/new">
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> {t('addClient')}</Button>
            </Link>
          </div>
        }
      />
      {barbershop && (
        // Same place as "Nouveau RDV" (Agenda) and "Client sans RDV" (Today): above the tab bar, never over it.
        <Link href="/crm/new"
          className={`${FAB_POSITION} md:hidden min-h-[56px] px-5 rounded-full bg-[#0e0e0f] text-white text-base font-bold shadow-xl inline-flex items-center gap-2`}>
          <Plus className="w-5 h-5" /> {fr.clients.newClient}
        </Link>
      )}
      <main className={barbershop ? 'p-4 pb-28 md:p-6' : 'p-6'}>
        {barbershop && <div className="mb-3 max-w-sm"><KridiTabs active="all" /></div>}
        <div className="mb-4 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <form>
            <input name="q" defaultValue={searchParams.q} type="search"
              placeholder={barbershop ? fr.clients.searchPlaceholder : t('searchPlaceholder')}
              className={`w-full max-w-sm pl-9 pr-4 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${barbershop ? 'min-h-[48px] text-base' : 'py-2 text-sm'}`} />
          </form>
        </div>

        {barbershop && !!clients?.length && (
          <ul className="md:hidden space-y-2">
            {clients.map((c) => {
              const wa = whatsappNumber(c.phone)
              const stats = statsMap[c.id]
              const action = 'min-h-[48px] rounded-xl border border-gray-300 flex items-center justify-center gap-2 text-sm font-semibold text-gray-800'
              return (
                <li key={c.id} className="rounded-xl bg-white border border-gray-200 p-3">
                  <Link href={`/crm/${c.id}`} className="block min-h-[44px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-gray-900 truncate">{c.name}</span>
                      {owed.has(c.id) && <span className="shrink-0 text-xs font-semibold text-orange-600">{fmt(fr.kridi.owes, { amount: formatCurrency(owed.get(c.id)!.amount, business.currency, 'fr-FR') })}</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {[
                        c.phone ? formatPhone(c.phone) : null,
                        stats?.last_visit_at ? fmt(fr.clients.lastVisit, { date: formatInBusinessTimezone(stats.last_visit_at, business.timezone, 'date', 'fr') }) : null,
                        stats?.lastService ?? null,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </Link>
                  <div className="mt-2 flex gap-2">
                    {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className={`flex-1 ${action}`}><Phone className="w-4 h-4" />{fr.kridi.call}</a>}
                    {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className={`flex-1 ${action}`}><MessageCircle className="w-4 h-4" />{fr.kridi.whatsapp}</a>}
                    <Link href={`/booking?client=${c.id}`} className={`flex-1 ${action}`}><CalendarPlus className="w-4 h-4" />{fr.clients.book}</Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden${barbershop && clients?.length ? ' hidden md:block' : ''}`}>
          {clients?.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <div className="text-4xl mb-3">{t('empty.icon')}</div>
              <div className="font-medium">{t('empty.heading')}</div>
              <div className="text-sm mt-1">
                <Link href="/crm/new" className="text-blue-600 hover:underline">{t('empty.action')}</Link>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="text-left px-4 py-3 font-medium">{t('table.name')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('table.contact')}</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">{t('table.tags')}</th>
                  <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">{t('table.lastService')}</th>
                  <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">{t('table.visits')}</th>
                  <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">{t('table.spent')}</th>
                  <th className="text-right px-4 py-3 font-medium hidden md:table-cell">{t('table.lastVisit')}</th>
                </tr>
              </thead>
              <tbody>
                {clients?.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/crm/${c.id}`} className="font-medium text-gray-900 hover:text-blue-600">{c.name}</Link>
                      {barbershop && owed.has(c.id) && <span className="ml-2 text-xs font-semibold text-orange-600">{fmt(fr.kridi.owes, { amount: formatCurrency(owed.get(c.id)!.amount, business.currency, 'fr-FR') })}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      <div className="flex flex-col gap-0.5">
                        {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {barbershop ? formatPhone(c.phone) : c.phone}</span>}
                        {c.email && <span className="flex items-center gap-1 text-xs"><Mail className="w-3 h-3" /> {c.email}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-gray-600 text-sm">
                      {statsMap[c.id]?.lastService ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell text-gray-700">{statsMap[c.id]?.total_visits ?? 0}</td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell font-medium text-gray-900">
                      {formatCurrency(statsMap[c.id]?.total_spent ?? 0, business.currency, locale)}
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell text-gray-500">
                      {statsMap[c.id]?.last_visit_at ? formatInBusinessTimezone(statsMap[c.id]!.last_visit_at!, business.timezone, 'date', locale) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  )
}

function KridiTabs({ active }: { active: 'all' | 'kridi' }) {
  const cls = (on: boolean) => `min-h-[44px] rounded-lg text-sm font-semibold flex items-center justify-center ${on ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`
  return (
    <div className="grid grid-cols-2 rounded-xl bg-gray-100 p-1">
      <Link href="/crm" className={cls(active === 'all')}>{fr.kridi.all}</Link>
      <Link href="/crm?view=kridi" className={cls(active === 'kridi')}>{fr.kridi.list}</Link>
    </div>
  )
}
