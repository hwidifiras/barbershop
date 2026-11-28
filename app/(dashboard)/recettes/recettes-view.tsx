// Display half of the Recettes page (SPEC 4.15): everything is computed by page.tsx and passed in.

import Link from 'next/link'
import { Plus, ChevronRight } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { fr, fmt } from '@/lib/barbershop-fr'
import { formatCurrency, formatInBusinessTimezone } from '@/lib/utils'
import type { Period, Takings } from '@/lib/barbershop-takings'
import { FAB_POSITION } from '@/lib/barbershop-theme'

const R = fr.recettes

export interface RecettesSale { id: string; amount: number; items: unknown; created_at: string; client: string | null; barber: string | null }

export function RecettesView({ period, first, last, takings: t, owed, barbers, sales, currency, timezone: tz }: {
  period: Period
  first: string
  last: string
  takings: Takings
  owed: number
  barbers: Record<string, string>
  sales: RecettesSale[]
  currency: string
  timezone: string
}) {
  const money = (v: number) => formatCurrency(v, currency, 'fr-FR')
  const day = (ymd: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...opts }).format(new Date(`${ymd}T12:00:00Z`))
  const rangeLabel = period === 'day'
    ? day(first, { weekday: 'long', day: 'numeric', month: 'long' })
    : fmt(R.rangeSpan, { first: day(first, { day: 'numeric', month: 'short' }), last: day(last, { day: 'numeric', month: 'short' }) })
  const maxBarber = Math.max(1, ...t.byBarber.map((b) => b.received))

  const tabs: { key: Period; label: string }[] = [{ key: 'day', label: R.day }, { key: 'week', label: R.week }, { key: 'month', label: R.month }]

  return (
    <>
      <Header title={R.title} />
      <main className="p-4 pb-28 md:p-6 max-w-2xl space-y-4">
        <nav aria-label={R.title} className="grid grid-cols-3 rounded-xl bg-gray-100 p-1">
          {tabs.map((tb) => (
            <Link key={tb.key} href={tb.key === 'day' ? '/recettes' : `/recettes?p=${tb.key}`} aria-current={period === tb.key ? 'page' : undefined}
              className={`min-h-[44px] rounded-lg text-sm font-semibold flex items-center justify-center ${period === tb.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              {tb.label}
            </Link>
          ))}
        </nav>

        {/* The headline: money that came in */}
        <section className="rounded-xl bg-[#0e0e0f] text-white p-5">
          <div className="text-sm text-white/60 first-letter:uppercase">{rangeLabel}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/60">{R.received}</div>
          <div className="text-4xl font-bold tabular-nums">{money(t.received)}</div>
          {t.repaid > 0 && <div className="mt-1 text-sm text-white/70">{fmt(R.repaidPart, { amount: money(t.repaid) })}</div>}
        </section>

        <div className="grid grid-cols-3 gap-2">
          <Stat label={R.sales} value={String(t.sales)} />
          <Stat label={R.average} value={money(t.average)} />
          <Stat label={R.kridiGiven} value={money(t.kridiGiven)} tone={t.kridiGiven > 0 ? 'warn' : undefined} />
        </div>

        {owed > 0 && (
          <Link href="/crm?view=kridi" className="flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 min-h-[56px]">
            <span className="font-semibold text-orange-900">{fmt(R.owed, { amount: money(owed) })}</span>
            <span className="flex items-center gap-1 text-sm text-orange-800">{R.owedHint}<ChevronRight className="w-4 h-4" aria-hidden /></span>
          </Link>
        )}

        {t.sales === 0 ? (
          <section className="rounded-xl bg-white border border-gray-200 p-6 text-center">
            <p className="font-medium text-gray-900">{R.empty}</p>
            <p className="mt-1 text-sm text-gray-500">{R.emptyHint}</p>
          </section>
        ) : (
          <>
            {t.byBarber.length > 1 && (
              <section className="rounded-xl bg-white border border-gray-200 p-4 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">{R.byBarber}</h2>
                <ul className="space-y-3">
                  {t.byBarber.map((b) => (
                    <li key={b.employeeId ?? 'none'}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-gray-900 truncate">{(b.employeeId && barbers[b.employeeId]) || R.noBarber}</span>
                        <span className="shrink-0 tabular-nums"><span className="font-semibold text-gray-900">{money(b.received)}</span> <span className="text-gray-500">· {fmt(R.salesCount, { n: b.sales })}</span></span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-[#c9a24b]" style={{ width: `${Math.round((b.received / maxBarber) * 100)}%` }} /></div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {t.topServices.length > 0 && (
              <section className="rounded-xl bg-white border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">{R.topServices}</h2>
                <ol className="divide-y divide-gray-100">
                  {t.topServices.map((s) => (
                    <li key={s.name} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="text-gray-800 truncate">{s.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-gray-900">× {s.count}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-900">{R.list}</h2>
              <ul className="space-y-2">
                {sales.map((tx) => {
                  const items = (Array.isArray(tx.items) ? tx.items : []) as { name?: string }[]
                  return (
                    <li key={tx.id} className="rounded-xl bg-white border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-gray-900 truncate">{tx.client ?? R.walkIn}</span>
                        <span className="shrink-0 font-bold tabular-nums text-gray-900">{money(tx.amount)}</span>
                      </div>
                      <div className="text-sm text-gray-600 truncate">{items.map((i) => i.name).filter(Boolean).join(' + ') || '—'}</div>
                      <div className="text-xs text-gray-500">
                        {period !== 'day' && `${formatInBusinessTimezone(tx.created_at, tz, 'date', 'fr')} · `}
                        {formatInBusinessTimezone(tx.created_at, tz, 'time', 'fr')}
                        {tx.barber ? ` · ${tx.barber}` : ''}
                      </div>
                    </li>
                  )
                })}
              </ul>
              <Link href="/pos/history" className="flex min-h-[48px] items-center justify-center gap-1 text-sm font-medium text-gray-600 underline">{R.allHistory}</Link>
            </section>
          </>
        )}
      </main>

      <Link href="/pos" className={`${FAB_POSITION} min-h-[56px] px-5 rounded-full bg-[#0e0e0f] text-white text-base font-bold shadow-xl inline-flex items-center gap-2`}>
        <Plus className="w-5 h-5" aria-hidden /> {R.quickSale}
      </Link>
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 p-3 min-w-0">
      <div className={`text-lg font-bold tabular-nums truncate ${tone === 'warn' ? 'text-orange-600' : 'text-gray-900'}`}>{value}</div>
      <div className="text-xs text-gray-500 leading-tight">{label}</div>
    </div>
  )
}
