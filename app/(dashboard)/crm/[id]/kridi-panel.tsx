'use client'

// Kridi on a client's page (docs/barbershop-mode/SPEC.md 4.13): balance, history, "Encaisser un paiement"
// (partial allowed, not tied to a haircut) and "Effacer la dette" (with a confirmation).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatInBusinessTimezone } from '@/lib/utils'
import { balanceOf, splitPayment } from '@/lib/kridi'
import { fr, fmt } from '@/lib/barbershop-fr'

const K = fr.kridi

export interface LedgerRow { id: string; kind: string; amount: number | string; created_at: string }

export function KridiPanel({ businessId, clientId, eligible, currency, timezone, entries }: {
  businessId: string; clientId: string; eligible: boolean; currency: string; timezone: string; entries: LedgerRow[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const money = (n: number) => formatCurrency(n, currency, 'fr-FR')
  const balance = balanceOf(entries)
  const [mode, setMode] = useState<'idle' | 'pay' | 'forgive'>('idle')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!eligible && entries.length === 0) return <p className="text-xs text-gray-500">{K.needPhone}</p>

  async function add(kind: 'payment' | 'writeoff', value: number) {
    if (value <= 0) return
    setBusy(true); setError('')
    const { error: err } = await supabase.from('client_ledger').insert({ business_id: businessId, client_id: clientId, kind, amount: value })
    setBusy(false)
    if (err) { setError(K.error); return }
    setMode('idle'); setAmount('')
    router.refresh()
  }

  const pay = splitPayment(balance, amount).received
  const label = (k: string) => (k === 'credit' ? K.entryCredit : k === 'payment' ? K.entryPayment : K.entryWriteoff)
  const recent = [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8)

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3" aria-label={K.title}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{K.title}</h2>
        <span className={`text-xl font-bold tabular-nums ${balance > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{balance > 0 ? money(balance) : K.clear}</span>
      </div>

      {balance > 0 && mode === 'idle' && (
        <div className="grid gap-2">
          <button type="button" onClick={() => { setMode('pay'); setAmount(String(balance)) }}
            className="min-h-[48px] rounded-xl text-white font-bold" style={{ background: '#0e0e0f' }}>{K.pay}</button>
          <button type="button" onClick={() => setMode('forgive')}
            className="min-h-[44px] rounded-xl border border-gray-300 text-sm font-semibold text-gray-700">{K.forgive}</button>
        </div>
      )}

      {mode === 'pay' && (
        <div className="space-y-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-500 uppercase">{K.payAmount}</span>
            <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
              className="mt-1 w-full min-h-[48px] rounded-lg border border-gray-300 px-3 text-base" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode('idle')} className="min-h-[48px] rounded-xl bg-gray-100 text-sm font-semibold text-gray-700">{K.cancel}</button>
            <button type="button" disabled={busy || pay <= 0} onClick={() => void add('payment', pay)}
              className="min-h-[48px] rounded-xl text-white font-bold disabled:opacity-40" style={{ background: '#0e0e0f' }}>{K.payConfirm} {pay > 0 ? money(pay) : ''}</button>
          </div>
        </div>
      )}

      {mode === 'forgive' && (
        <div className="space-y-2 rounded-xl bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-800">{fmt(K.forgiveAsk, { amount: money(balance) })}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode('idle')} className="min-h-[48px] rounded-xl bg-white border border-gray-300 text-sm font-semibold text-gray-700">{K.cancel}</button>
            <button type="button" disabled={busy} onClick={() => void add('writeoff', balance)} className="min-h-[48px] rounded-xl bg-red-600 text-white font-bold disabled:opacity-40">{K.forgiveYes}</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {recent.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">{K.history}</div>
          <ul className="divide-y divide-gray-100 text-sm">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-1.5">
                <span className="text-gray-700">{label(e.kind)} <span className="text-xs text-gray-400">{formatInBusinessTimezone(e.created_at, timezone, 'date', 'fr')}</span></span>
                <span className={`tabular-nums font-medium ${e.kind === 'credit' ? 'text-orange-600' : 'text-green-700'}`}>{e.kind === 'credit' ? '+' : '−'}{money(Number(e.amount))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
