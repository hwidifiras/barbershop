import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { formatCurrency, formatInBusinessTimezone } from '@/lib/utils'
import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { HistoryFilters } from './history-filters'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { isBarbershopMode } from '@/lib/vertical'
import { fr } from '@/lib/barbershop-fr'

export default async function TransactionHistoryPage(
  props: {
    searchParams: Promise<{ method?: string; from?: string; to?: string; client?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient()
  const t = await getTranslations('transactions')
  const locale = await getLocale()
  const user = await getAuthUser()

  const business = await getBusinessForOwner(user!.id)
  if (!business) redirect('/onboarding')
  const barbershop = isBarbershopMode(business)

  let query = supabase
    .from('transactions')
    .select('id, receipt_number, amount, payment_method, status, items, created_at, clients(id, name), employees(name)')
    .eq('business_id', business.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(100)

  if (searchParams.method) query = query.eq('payment_method', searchParams.method)
  if (searchParams.from) query = query.gte('created_at', searchParams.from)
  if (searchParams.to) {
    const toDate = new Date(searchParams.to)
    toDate.setDate(toDate.getDate() + 1)
    query = query.lt('created_at', toDate.toISOString().slice(0, 10))
  }

  // ── Client name filter ──────────────────────────────────────────────────────
  if (searchParams.client?.trim()) {
    const q = searchParams.client.trim()

    // Find clients whose name matches the query
    const { data: matched } = await supabase
      .from('clients')
      .select('id')
      .eq('business_id', business.id)
      .ilike('name', `%${q}%`)

    const ids = matched?.map((c) => c.id) ?? []
    const walkInMatch = 'walk-in'.includes(q.toLowerCase()) || q.toLowerCase().includes('walk')

    if (ids.length > 0 && walkInMatch) {
      // Matching clients OR walk-ins
      query = query.or(`client_id.in.(${ids.join(',')}),client_id.is.null`)
    } else if (ids.length > 0) {
      // Only matching named clients — exclude walk-ins
      query = query.in('client_id', ids)
    } else if (walkInMatch) {
      // Only walk-ins
      query = query.is('client_id', null)
    } else {
      // No matches at all
      query = query.eq('id', '00000000-0000-0000-0000-000000000000')
    }
  }

  const { data: transactions } = await query

  const total = transactions?.reduce((sum, tx) => sum + tx.amount, 0) ?? 0

  const methods = [
    { value: '', label: t('filters.allMethods') },
    { value: 'cash', label: t('filters.cash') },
    { value: 'card', label: t('filters.card') },
    { value: 'transfer', label: t('filters.transfer') },
  ]

  return (
    <>
      <Header title={t('title')} />
      <main className={barbershop ? 'p-4 md:p-6 space-y-4' : 'p-6 space-y-4'}>
        {/* Filters. Barbershop mode folds them away unless one is in use (SPEC 4.4). */}
        {(() => {
          const filters = (
            <HistoryFilters
              from={searchParams.from ?? ''}
              to={searchParams.to ?? ''}
              method={searchParams.method ?? ''}
              client={searchParams.client ?? ''}
              methods={methods}
            />
          )
          if (!barbershop) return filters
          return (
            <details open={!!(searchParams.from || searchParams.to || searchParams.method || searchParams.client)}>
              <summary className="min-h-[48px] flex items-center cursor-pointer text-sm font-semibold text-gray-800">{fr.caisse.filters}</summary>
              {filters}
            </details>
          )
        })()}

        {/* Total */}
        {transactions && transactions.length > 0 && (
          <div className="flex justify-end">
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm font-semibold text-green-700">
              {t('total')} {formatCurrency(total, business.currency, locale)}
            </div>
          </div>
        )}

        {barbershop && !!transactions?.length && (
          <ul className="md:hidden space-y-2">
            {transactions.map((tx) => {
              const items = (Array.isArray(tx.items) ? tx.items : []) as { name?: string }[]
              const client = tx.clients as { id: string; name: string } | null
              const employee = tx.employees as { name: string } | null
              return (
                <li key={tx.id} className="rounded-xl bg-white border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-gray-900 truncate">{client?.name ?? t('walkIn')}</span>
                    <span className="shrink-0 font-bold tabular-nums text-gray-900">{formatCurrency(tx.amount, business.currency, 'fr-FR')}</span>
                  </div>
                  <div className="text-sm text-gray-600 truncate">{items.map((i) => i.name).filter(Boolean).join(' + ') || '—'}</div>
                  <div className="text-xs text-gray-500">
                    {formatInBusinessTimezone(tx.created_at, business.timezone, 'date', 'fr')} · {formatInBusinessTimezone(tx.created_at, business.timezone, 'time', 'fr')}
                    {employee?.name ? ` · ${employee.name}` : ''}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* Table */}
        <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden${barbershop && transactions?.length ? ' hidden md:block' : ''}`}>
          {!transactions || transactions.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <div className="text-4xl mb-3">🧾</div>
              <div className="font-medium">{t('empty')}</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="text-left px-4 py-3 font-medium">{t('table.receipt')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('table.client')}</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">{t('table.employee')}</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">{t('table.items')}</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">{t('table.method')}</th>
                  <th className="text-right px-4 py-3 font-medium">{t('table.amount')}</th>
                  <th className="text-right px-4 py-3 font-medium hidden md:table-cell">{t('table.date')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const items = (Array.isArray(tx.items) ? tx.items : []) as any[]
                  const firstName: string = items[0]?.name ?? ''
                  const extraCount = items.length - 1
                  const client = tx.clients as { id: string; name: string } | null
                  const employee = tx.employees as { name: string } | null

                  return (
                    <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{tx.receipt_number}</td>
                      <td className="px-4 py-3">
                        {client
                          ? <Link href={`/crm/${client.id}`} className="font-medium text-gray-900 hover:text-blue-600">{client.name}</Link>
                          : <span className="text-gray-400">{t('walkIn')}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                        {employee?.name ?? t('unassigned')}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {firstName
                          ? <span className="text-gray-900">{firstName}{extraCount > 0 && <span className="text-gray-400 ml-1">{t('moreItems', { count: extraCount })}</span>}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="capitalize text-gray-600">{tx.payment_method}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(tx.amount, business.currency, locale)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">
                        <div>{formatInBusinessTimezone(tx.created_at, business.timezone, 'date', locale)}</div>
                        <div className="text-xs">{formatInBusinessTimezone(tx.created_at, business.timezone, 'time', locale)}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  )
}
