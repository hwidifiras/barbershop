'use client'

// "Nouveau RDV" from the phone Agenda: the barber books a client for the day shown. Service (+ supplements),
// barber, a free time (same slot rules as the public page), and the client by phone number: an existing
// number brings back the existing client (docs/barbershop-mode/SPEC.md 4.5). Reuses the existing tables.

import { useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { findClientByPhone } from '@/lib/client-identity'
import { lookupKey, normalizePhone } from '@/lib/phone'
import { formatCurrency } from '@/lib/utils'
import { computeEffectiveHours, type DayHours } from '@/lib/booking-availability'
import { computeBarberSlots, minutesInTimezone, unionSlots } from '@/lib/barbershop-slots'
import { previewSelection, toggleAddOn, type CartService } from '@/lib/barbershop-cart'
import { zonedDateTime } from '@/lib/barbershop-today'
import { fr, fmt } from '@/lib/barbershop-fr'

const C = fr.agenda.create

export interface NewApptService {
  id: string; name: string; price: number; duration_min: number
  kind: string | null; bookable_alone: boolean | null; includes: string[]; exclusive_group: string | null
}
interface Barber { id: string; name: string }
interface Busy { starts_at: string; ends_at: string; status: string; employee_id: string | null }

interface Props {
  business: { id: string; currency: string; timezone: string }
  ymd: string
  today: string
  barbers: Barber[]
  services: NewApptService[]
  hours: DayHours[]
  /** The appointments already on this day (all barbers). */
  dayAppts: Busy[]
  defaultBarberId: string
  dayLabel: string
  onClose: () => void
  onCreated: () => void
}

export function NewAppointmentSheet({ business, ymd, today, barbers, services, hours, dayAppts, defaultBarberId, dayLabel, onClose, onCreated }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const tz = business.timezone
  const money = (n: number) => formatCurrency(n, business.currency, 'fr-FR')

  const cart: CartService[] = useMemo(() => services.map((s) => ({
    id: s.id, name: s.name, price: Number(s.price), duration_min: s.duration_min,
    kind: s.kind === 'supplement' ? 'supplement' : 'main', bookable_alone: !!s.bookable_alone,
    bookable_online: true, is_active: true, includes: s.includes ?? [], exclusive_group: s.exclusive_group ?? null,
  })), [services])
  const mains = useMemo(() => {
    const own = cart.filter((s) => s.kind === 'main' || s.bookable_alone)
    return own.length ? own : cart
  }, [cart])

  const [serviceId, setServiceId] = useState('')
  const [extras, setExtras] = useState<string[]>([])
  const [barberId, setBarberId] = useState(defaultBarberId || (barbers.length === 1 ? barbers[0].id : ''))
  const [time, setTime] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [found, setFound] = useState<{ key: string; id: string; name: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const svc = cart.find((s) => s.id === serviceId) ?? null
  const blocked = useMemo(() => new Set(svc?.includes ?? []), [svc])
  const supplementChoices = svc && svc.kind === 'main' ? cart.filter((s) => s.kind === 'supplement') : []
  const totals = previewSelection({
    service: svc, offer: null, services: cart,
    extras: extras.map((id) => cart.find((s) => s.id === id)).filter((s): s is CartService => !!s),
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Free times: one barber, or (when none chosen yet) never shown. Past times are hidden for today.
  const dayHours = useMemo(() => {
    const [y, m, d] = ymd.split('-').map(Number)
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    return computeEffectiveHours(hours).find((h) => h.day_of_week === dow)
  }, [hours, ymd])
  const dayClosed = !dayHours || !dayHours.is_open

  const slots = useMemo(() => {
    if (!svc || totals.totalDuration <= 0 || !barberId) return []
    const nowMinutes = ymd === today ? minutesInTimezone(new Date().toISOString(), tz) : ymd < today ? 24 * 60 : undefined
    const booked = dayAppts.filter((a) => !['cancelled', 'no_show'].includes(a.status) && a.employee_id === barberId)
    return unionSlots([computeBarberSlots({ dayHours, durationMin: totals.totalDuration, booked, timezone: tz, nowMinutes, leadMinutes: 0 })])
  }, [svc, totals.totalDuration, barberId, dayAppts, dayHours, tz, ymd, today])

  // A chosen time that is no longer free (service or barber changed) is dropped.
  const timeOk = slots.includes(time) ? time : ''

  // Typing a known number brings back the client (name stays editable by the barber on his page).
  const phoneKey = lookupKey(phone)
  useEffect(() => {
    if (!phoneKey) return
    let cancelled = false
    findClientByPhone(supabase, business.id, phoneKey).then((c) => {
      if (cancelled) return
      setFound(c ? { key: phoneKey, id: c.id, name: c.name } : null)
    })
    return () => { cancelled = true }
  }, [phoneKey, supabase, business.id])
  // Only a result for the number currently typed counts.
  const known = found && found.key === phoneKey ? { id: found.id, name: found.name } : null

  const canSave = !!svc && !!barberId && !!timeOk && !saving && !dayClosed

  async function save() {
    if (!svc || !timeOk) return
    setSaving(true); setError(null)
    let createdId: string | null = null
    try {
      let clientId: string | null = known?.id ?? null
      const nm = name.trim()
      if (!clientId && nm) {
        const found = phone.trim() ? await findClientByPhone(supabase, business.id, phone) : null
        if (found) clientId = found.id
        else {
          const { data: created, error: cErr } = await supabase.from('clients')
            .insert({ business_id: business.id, name: nm, phone: normalizePhone(phone) ?? (phone.trim() || null) }).select('id').single()
          if (cErr || !created) throw new Error('client')
          clientId = created.id
        }
      }
      const [hh, mm] = timeOk.split(':').map(Number)
      const startsAt = zonedDateTime(ymd, hh * 60 + mm, tz)
      const endsAt = new Date(startsAt.getTime() + totals.totalDuration * 60_000)
      const withExtras = totals.lines.length > 1
      const { data, error: aErr } = await supabase.from('appointments').insert({
        business_id: business.id, client_id: clientId, employee_id: barberId, service_id: svc.id,
        starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
        status: 'confirmed', source: 'manual', price: totals.totalPrice,
        ...(withExtras ? { items_summary: totals.summary } : {}),
      }).select('id').single()
      if (aErr || !data) { setError(aErr?.message?.includes('slot_already_booked') ? C.errorTaken : C.errorGeneric); return }
      createdId = data.id
      if (withExtras) {
        const { error: iErr } = await supabase.from('appointment_items').insert(
          totals.lines.map((l, i) => ({
            appointment_id: data.id, business_id: business.id, service_id: l.service_id,
            name: l.name, price: l.price, duration_min: l.duration_min, position: i,
          })),
        )
        if (iErr) {
          await supabase.from('appointments').delete().eq('id', data.id)
          createdId = null
          setError(C.errorGeneric); return
        }
      }
      createdId = null
      onCreated()
    } catch {
      if (createdId) await supabase.from('appointments').delete().eq('id', createdId)
      setError(C.errorGeneric)
    } finally {
      setSaving(false)
    }
  }

  const supplementBlocks: { group: string | null; items: CartService[] }[] = []
  const independent = supplementChoices.filter((s) => !s.exclusive_group)
  if (independent.length) supplementBlocks.push({ group: null, items: independent })
  for (const g of Array.from(new Set(supplementChoices.map((s) => s.exclusive_group).filter((g): g is string => !!g)))) {
    supplementBlocks.push({ group: g, items: supplementChoices.filter((s) => s.exclusive_group === g) })
  }
  const chip = (on: boolean) => `min-h-[44px] rounded-full border px-4 text-sm font-medium ${on ? 'bg-[#0e0e0f] text-white border-[#0e0e0f]' : 'bg-white text-gray-700 border-gray-300'}`

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={C.title} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-white rounded-t-2xl p-4"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900">{C.title}</h2>
            <div className="text-sm text-gray-500 capitalize">{fmt(C.for, { day: dayLabel })}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={fr.agenda.close} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500"><X className="w-6 h-6" /></button>
        </div>

        {dayClosed ? (
          <p className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700">{C.closedDay}</p>
        ) : mains.length === 0 ? (
          <p className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700">{C.noServices}</p>
        ) : (
          <>
            <div className="mt-4 text-xs font-medium text-gray-500">{C.service}</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {mains.map((s) => (
                <button key={s.id} type="button" aria-pressed={serviceId === s.id} onClick={() => { setServiceId(s.id); setExtras([]) }} className={chip(serviceId === s.id)}>
                  {s.name} · {s.duration_min} min
                </button>
              ))}
            </div>

            {supplementBlocks.length > 0 && (
              <>
                <div className="mt-4 text-xs font-medium text-gray-500">{C.extras}</div>
                {supplementBlocks.map((blk) => (
                  <div key={blk.group ?? '_'} className="mt-1">
                    {blk.group && <div className="text-[11px] text-gray-400 mt-1">{fmt(C.group, { group: blk.group })}</div>}
                    <div className="mt-1 flex flex-wrap gap-2">
                      {blk.items.map((s) => {
                        const inc = blocked.has(s.id)
                        const on = extras.includes(s.id)
                        return (
                          <button key={s.id} type="button" aria-pressed={on || inc} disabled={inc}
                            onClick={() => setExtras((cur) => toggleAddOn(cur, s.id, cart, blocked))}
                            className={`min-h-[44px] rounded-full border px-4 text-sm font-medium ${inc ? 'bg-gray-100 text-gray-400 border-gray-200' : on ? 'bg-[#0e0e0f] text-white border-[#0e0e0f]' : 'bg-white text-gray-700 border-gray-300'}`}>
                            {inc ? `✓ ${s.name} · ${C.included}` : `${s.name} · +${money(s.price)}`}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}

            {barbers.length > 1 && (
              <>
                <div className="mt-4 text-xs font-medium text-gray-500">{C.barber}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {barbers.map((b) => (
                    <button key={b.id} type="button" aria-pressed={barberId === b.id} onClick={() => setBarberId(b.id)} className={chip(barberId === b.id)}>{b.name}</button>
                  ))}
                </div>
              </>
            )}

            <div className="mt-4 text-xs font-medium text-gray-500">{C.time}</div>
            {!svc ? (
              <p className="mt-1 text-sm text-gray-500">{C.pickService}</p>
            ) : !barberId ? (
              <p className="mt-1 text-sm text-gray-500">{C.pickBarber}</p>
            ) : slots.length === 0 ? (
              <p className="mt-1 text-sm text-gray-700 rounded-xl bg-gray-50 border border-gray-200 p-3">{C.noSlot}</p>
            ) : (
              <div className="mt-1 grid grid-cols-4 gap-2" aria-live="polite">
                {slots.map((t) => (
                  <button key={t} type="button" aria-pressed={timeOk === t} onClick={() => setTime(t)}
                    className={`min-h-[44px] rounded-lg border text-sm font-semibold tabular-nums ${timeOk === t ? 'bg-[#0e0e0f] text-white border-[#0e0e0f]' : 'bg-white text-gray-800 border-gray-300'}`}>{t}</button>
                ))}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-500">{C.phone}</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="off"
                  className="mt-1 w-full min-h-[48px] rounded-lg border border-gray-300 px-3 text-base" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-500">{C.name}</span>
                <input value={known ? known.name : name} onChange={(e) => setName(e.target.value)} readOnly={!!known} autoComplete="off"
                  className={`mt-1 w-full min-h-[48px] rounded-lg border border-gray-300 px-3 text-base ${known ? 'bg-gray-50 text-gray-700' : ''}`} />
              </label>
            </div>
            <p className="mt-1 text-xs text-gray-500">{known ? `✓ ${C.knownClient}` : C.nameHint}</p>

            {svc && (
              <div className="mt-4 flex items-center justify-between text-sm text-gray-700">
                <span className="truncate pr-2">{totals.summary}</span>
                <b className="tabular-nums shrink-0">{fmt(C.total, { price: money(totals.totalPrice), n: totals.totalDuration })}</b>
              </div>
            )}
            {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}

            <button type="button" disabled={!canSave} onClick={() => void save()}
              className="mt-4 w-full min-h-[56px] rounded-xl bg-[#0e0e0f] text-white text-base font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> {C.adding}</> : C.add}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
