'use client'

// "Reporter" from the phone Agenda: move an existing appointment to a free time (same day or another day,
// same or another barber). The appointment keeps its client, services, price and length; only the start,
// end and barber change. The database's slot check still prevents double booking.

import { useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { computeEffectiveHours, type DayHours } from '@/lib/booking-availability'
import { computeBarberSlots, minutesInTimezone } from '@/lib/barbershop-slots'
import { addDaysYmd, dayRangeIso, zonedDateTime } from '@/lib/barbershop-today'
import { fr, fmt } from '@/lib/barbershop-fr'
import { whatsappNumber } from '@/lib/phone'

const P = fr.agenda.postpone

interface Barber { id: string; name: string }
export interface PostponeTarget {
  id: string; starts_at: string; ends_at: string; employee_id: string | null; clientName: string
  clientPhone?: string | null
}
interface Busy { id: string; starts_at: string; ends_at: string; status: string; employee_id: string | null }

export function PostponeSheet({ appt, ymdNow, timezone, hours, barbers, onClose, onDone }: {
  appt: PostponeTarget
  ymdNow: string
  timezone: string
  hours: DayHours[]
  barbers: Barber[]
  onClose: () => void
  onDone: (newYmd: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const tz = timezone
  const durationMin = Math.max(5, Math.round((new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60_000))
  const originalYmd = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(appt.starts_at)), [appt.starts_at, tz])

  const [ymd, setYmd] = useState(originalYmd < ymdNow ? ymdNow : originalYmd)
  const [barberId, setBarberId] = useState(appt.employee_id ?? (barbers.length === 1 ? barbers[0].id : ''))
  const [time, setTime] = useState('')
  const [loaded, setLoaded] = useState<{ ymd: string; rows: Busy[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set once moved, when the client has a number to tell them on.
  const [moved, setMoved] = useState<{ ymd: string; url: string } | null>(null)
  // Closing after a move still has to refresh the screen behind.
  const close = () => (moved ? onDone(moved.ymd) : onClose())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // The day's other appointments, to know which times are free.
  useEffect(() => {
    let cancelled = false
    const { from, to } = dayRangeIso(ymd, tz)
    supabase.from('appointments').select('id, starts_at, ends_at, status, employee_id')
      .gte('starts_at', from).lt('starts_at', to)
      .then(({ data }) => { if (!cancelled) setLoaded({ ymd, rows: (data ?? []) as Busy[] }) })
    return () => { cancelled = true }
  }, [ymd, tz, supabase])

  const effective = useMemo(() => computeEffectiveHours(hours), [hours])
  const hoursOf = (day: string) => effective.find((h) => h.day_of_week === new Date(`${day}T12:00:00Z`).getUTCDay())
  const dayHours = hoursOf(ymd)
  const ready = loaded?.ymd === ymd

  const slots = useMemo(() => {
    if (!ready || !barberId || !dayHours?.is_open) return []
    const booked = (loaded?.rows ?? []).filter((a) => a.id !== appt.id && !['cancelled', 'no_show'].includes(a.status) && a.employee_id === barberId)
    const nowMinutes = ymd === ymdNow ? minutesInTimezone(new Date().toISOString(), tz) : undefined
    return computeBarberSlots({ dayHours, durationMin, booked, timezone: tz, nowMinutes, leadMinutes: 0 })
  }, [ready, loaded, barberId, dayHours, appt.id, durationMin, tz, ymd, ymdNow])
  const timeOk = slots.includes(time) ? time : ''

  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => addDaysYmd(ymdNow, i)), [ymdNow])
  const fmtDay = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...o, timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))
  const when = `${fmtDay(originalYmd, { weekday: 'short', day: 'numeric', month: 'short' })} ${new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(appt.starts_at))}`

  async function save() {
    if (!timeOk || !barberId) return
    setSaving(true); setError(null)
    const [hh, mm] = timeOk.split(':').map(Number)
    const startsAt = zonedDateTime(ymd, hh * 60 + mm, tz)
    const endsAt = new Date(startsAt.getTime() + durationMin * 60_000)
    const { error: err } = await supabase.from('appointments')
      .update({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), employee_id: barberId })
      .eq('id', appt.id)
    if (err) {
      setSaving(false)
      setError(err.message?.includes('slot_already_booked') ? P.errorTaken : P.errorGeneric)
      return
    }
    // Reminders are sent once per appointment; clear them so the new time gets its own reminders.
    await supabase.from('notification_log').delete().eq('ref_id', appt.id).in('type', ['reminder_24h', 'reminder_1h'])
    setSaving(false)
    // Nothing is sent automatically: the barber taps to open WhatsApp with the message written.
    const wa = whatsappNumber(appt.clientPhone)
    if (!wa) { onDone(ymd); return }
    const text = fmt(P.message, { name: appt.clientName, day: fmtDay(ymd, { weekday: 'long', day: 'numeric', month: 'long' }), time: timeOk })
    setMoved({ ymd, url: `https://wa.me/${wa}?text=${encodeURIComponent(text)}` })
  }

  const chip = (on: boolean) => `shrink-0 min-h-[44px] rounded-full border px-4 text-sm font-medium ${on ? 'bg-[#0e0e0f] text-white border-[#0e0e0f]' : 'bg-white text-gray-700 border-gray-300'}`

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={close}>
      <div role="dialog" aria-modal="true" aria-label={P.title} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-white rounded-t-2xl p-4"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900">{P.title}</h2>
            <div className="text-sm text-gray-500 truncate">{appt.clientName} · {fmt(P.current, { when })}</div>
          </div>
          <button type="button" onClick={close} aria-label={fr.agenda.close} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500"><X className="w-6 h-6" /></button>
        </div>

        {moved ? (
          <div className="mt-4 space-y-2">
            <p role="status" className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-900">{P.moved}</p>
            <a href={moved.url} target="_blank" rel="noopener noreferrer" className="w-full min-h-[56px] rounded-xl bg-[#0e0e0f] text-white text-base font-bold inline-flex items-center justify-center">{fmt(P.tell, { name: appt.clientName })}</a>
            <button type="button" onClick={close} className="w-full min-h-[48px] rounded-xl border border-gray-300 text-sm font-semibold text-gray-800">{P.finished}</button>
          </div>
        ) : (<>
        <div className="mt-4 text-xs font-medium text-gray-500">{P.day}</div>
        <div className="mt-1 flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {days.map((d) => {
            const closedDay = !hoursOf(d)?.is_open
            return (
              <button key={d} type="button" aria-pressed={ymd === d} onClick={() => { setYmd(d); setTime('') }}
                className={`${chip(ymd === d)} ${closedDay && ymd !== d ? 'opacity-50' : ''} flex-col !px-3 leading-tight py-1.5`}>
                <span className="text-[11px] uppercase">{d === ymdNow ? 'Auj.' : fmtDay(d, { weekday: 'short' }).replace('.', '')}</span>
                <span className="text-base font-bold tabular-nums">{fmtDay(d, { day: 'numeric' })}</span>
              </button>
            )
          })}
        </div>

        {barbers.length > 1 && (
          <>
            <div className="mt-4 text-xs font-medium text-gray-500">{P.barber}</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {barbers.map((b) => (
                <button key={b.id} type="button" aria-pressed={barberId === b.id} onClick={() => { setBarberId(b.id); setTime('') }} className={chip(barberId === b.id)}>{b.name}</button>
              ))}
            </div>
          </>
        )}

        <div className="mt-4 text-xs font-medium text-gray-500">{P.time}</div>
        {!ready ? (
          <p className="mt-1 text-sm text-gray-500">{P.loading}</p>
        ) : !dayHours?.is_open ? (
          <p className="mt-1 text-sm text-gray-700 rounded-xl bg-gray-50 border border-gray-200 p-3">{P.closedDay}</p>
        ) : slots.length === 0 ? (
          <p className="mt-1 text-sm text-gray-700 rounded-xl bg-gray-50 border border-gray-200 p-3">{P.noSlot}</p>
        ) : (
          <div className="mt-1 grid grid-cols-4 gap-2" aria-live="polite">
            {slots.map((t) => (
              <button key={t} type="button" aria-pressed={timeOk === t} onClick={() => setTime(t)}
                className={`min-h-[44px] rounded-lg border text-sm font-semibold tabular-nums ${timeOk === t ? 'bg-[#0e0e0f] text-white border-[#0e0e0f]' : 'bg-white text-gray-800 border-gray-300'}`}>{t}</button>
            ))}
          </div>
        )}

        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        <button type="button" disabled={!timeOk || !barberId || saving} onClick={() => void save()}
          className="mt-4 w-full min-h-[56px] rounded-xl bg-[#0e0e0f] text-white text-base font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : timeOk
            ? (ymd === originalYmd ? fmt(P.confirm, { time: timeOk }) : fmt(P.confirmDay, { day: fmtDay(ymd, { weekday: 'long', day: 'numeric', month: 'long' }), time: timeOk }))
            : P.button}
        </button>
        </>)}
      </div>
    </div>
  )
}
