'use client'

// "Rappels pour demain" on the Today screen: one WhatsApp button per booking of tomorrow.

import { useState } from 'react'
import { Check, ChevronDown, MessageCircle } from 'lucide-react'
import { fr, fmt } from '@/lib/barbershop-fr'
import { reminderUrl, type ReminderAppt } from '@/lib/barbershop-reminders'
import { formatInBusinessTimezone } from '@/lib/utils'
import { markReminded } from './reminder-actions'

const R = fr.today.reminders

export function RemindersCard({ appts, remindedIds, day, shopName, timezone }: {
  appts: ReminderAppt[]
  /** Appointments already reminded for their current time. */
  remindedIds: string[]
  /** Tomorrow, written out ("samedi 28 novembre"). */
  day: string
  shopName: string
  timezone: string
}) {
  const [open, setOpen] = useState(false)
  const [tapped, setTapped] = useState<string[]>([])
  const [error, setError] = useState(false)
  if (appts.length === 0) return null

  const done = (id: string) => remindedIds.includes(id) || tapped.includes(id)
  const left = appts.filter((a) => !done(a.id) && reminderUrl(a.clients?.phone, '')).length

  async function mark(id: string) {
    setError(false)
    setTapped((l) => [...l, id])
    const res = await markReminded(id).catch(() => ({ ok: false }))
    if (!res.ok) { setTapped((l) => l.filter((x) => x !== id)); setError(true) }
  }

  return (
    <section className="rounded-xl bg-white border border-gray-200">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="w-full flex items-center gap-3 p-4 text-left min-h-[60px]">
        <MessageCircle className="w-5 h-5 shrink-0 text-green-700" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-gray-900">{R.title}</h2>
          <p className="text-xs text-gray-500">{left > 0 ? fmt(R.left, { n: left }) : R.allDone}</p>
        </div>
        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <p className="text-xs text-gray-500">{R.hint}</p>
          {error && <p role="alert" className="mt-2 text-sm text-red-600">{R.error}</p>}
          <ul className="mt-2 divide-y divide-gray-100">
            {appts.map((a) => {
              const time = formatInBusinessTimezone(a.starts_at, timezone, 'time', 'fr')
              const name = a.clients?.name ?? ''
              const url = reminderUrl(a.clients?.phone, fmt(R.message, { name, day, time, shop: shopName }))
              return (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <div className="w-14 shrink-0 text-base font-bold text-gray-900 tabular-nums">{time}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 truncate">{name}</div>
                    <div className="text-xs text-gray-500 truncate">{a.items_summary ?? a.services?.name ?? ''}</div>
                  </div>
                  {!url ? (
                    <span className="shrink-0 text-xs text-gray-500">{R.noPhone}</span>
                  ) : done(a.id) ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={fmt(R.againFor, { name })}
                      className="shrink-0 inline-flex items-center gap-1 min-h-[44px] px-3 text-sm text-green-700">
                      <Check className="w-4 h-4" /> {R.done}
                    </a>
                  ) : (
                    <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => void mark(a.id)} aria-label={fmt(R.sendFor, { name })}
                      className="shrink-0 inline-flex items-center min-h-[44px] rounded-lg bg-[#0e0e0f] text-white px-4 text-sm font-semibold">
                      {R.send}
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
