'use client'

// "Today" screen for barbershop mode (docs/barbershop-mode/SPEC.md 4.2): the next client, the day's
// timeline, one-tap status buttons and a walk-in button. French only. Reuses the existing tables:
// status changes update `appointments`, and a walk-in is a normal appointment starting at the next
// free time (the database's slot allocation prevents double-booking).

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { findClientByPhone } from '@/lib/client-identity'
import { normalizePhone } from '@/lib/phone'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Copy, Loader2, Plus, X } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatInBusinessTimezone } from '@/lib/utils'
import { computeEffectiveHours, type DayHours } from '@/lib/booking-availability'
import { minutesInTimezone } from '@/lib/barbershop-slots'
import { previewSelection, toggleAddOn, type CartService } from '@/lib/barbershop-cart'
import {
  countDoneRemaining, formatMinutes, isOverdue, nextFreeStart, pickNextAppointment, zonedDateTime, type MinuteRange,
} from '@/lib/barbershop-today'
import { fr, fmt } from '@/lib/barbershop-fr'
import { PostponeSheet } from '../booking/postpone-sheet'
import { RemindersCard } from './reminders-card'
import { PushBanner } from '@/components/settings/push-card'
import type { ReminderAppt } from '@/lib/barbershop-reminders'

const T = fr.today

export interface TodayAppointment {
  id: string; starts_at: string; ends_at: string; status: string; price: number | null
  items_summary: string | null; notes: string | null; source: string | null
  employee_id: string | null; service_id: string | null; client_id: string | null
  clients: { id: string; name: string; phone: string | null } | null
  services: { id: string; name: string } | null
}
interface Barber { id: string; name: string; avatar_url: string | null }
interface ServiceLite {
  id: string; name: string; price: number; duration_min: number
  kind: string | null; bookable_alone: boolean | null; includes: string[]; exclusive_group: string | null
}

interface Props {
  business: { id: string; name: string; slug: string; currency: string; timezone: string }
  ymd: string
  nowMs: number
  accent: string
  barbers: Barber[]
  services: ServiceLite[]
  hours: DayHours[]
  hasHours: boolean
  initialAppts: TodayAppointment[]
  revenueToday: number
  kridiToday?: number
  lowStock: number
  reminders: ReminderAppt[]
  remindedIds: string[]
  tomorrowLabel: string
}

const APPT_SELECT =
  'id, starts_at, ends_at, status, price, items_summary, notes, source, employee_id, service_id, client_id, clients(id, name, phone), services(id, name)'

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-gray-200 text-gray-700',
  overdue: 'bg-orange-100 text-orange-800',
}

const REFRESH_EVERY_MS = 60_000

export function TodayView({
  business, ymd, nowMs, accent, barbers, services, hours, hasHours, initialAppts, revenueToday, kridiToday = 0, lowStock,
  reminders, remindedIds, tomorrowLabel,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const tz = business.timezone
  const money = (n: number) => formatCurrency(n, business.currency, 'fr-FR')
  const timeOf = (iso: string) => formatInBusinessTimezone(iso, tz, 'time', 'fr')

  const [appts, setAppts] = useState(initialAppts)
  const [now, setNow] = useState(nowMs)
  const [barberId, setBarberId] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const [linkShared, setLinkShared] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)
  const [postponeId, setPostponeId] = useState<string | null>(null)

  // ── keep the screen up to date ────────────────────────────────────────
  // The server re-sends the day's bookings after router.refresh(); copy them into state so an
  // online booking (or a change from another phone) shows without reloading the page.
  const firstSync = useRef(true)
  useEffect(() => {
    if (firstSync.current) { firstSync.current = false; return }
    setAppts(initialAppts)
  }, [initialAppts])

  const working = useRef(false) // do not refresh in the middle of one of our own saves
  const lastRefresh = useRef(0)

  useEffect(() => {
    setOrigin(window.location.origin)
    try {
      setLinkShared(localStorage.getItem('bb_link_shared') === '1')
      setDismissed(localStorage.getItem('bb_checklist_dismissed') === '1')
    } catch { /* storage unavailable */ }
    const tick = setInterval(() => setNow(Date.now()), 30_000)

    const refresh = () => {
      if (document.visibilityState !== 'visible' || working.current) return
      if (Date.now() - lastRefresh.current < 5_000) return
      lastRefresh.current = Date.now()
      setNow(Date.now())
      router.refresh()
    }
    const poll = setInterval(refresh, REFRESH_EVERY_MS)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(tick); clearInterval(poll)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [router])

  const barberName = (id: string | null) => barbers.find((b) => b.id === id)?.name ?? null
  const forBarber = useMemo(() => appts.filter((a) => !barberId || a.employee_id === barberId), [appts, barberId])
  const cancelledCount = forBarber.filter((a) => a.status === 'cancelled').length
  const visible = useMemo(
    () => forBarber.filter((a) => showCancelled || a.status !== 'cancelled').sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [forBarber, showCancelled],
  )
  const next = pickNextAppointment(appts, now, barberId || undefined)
  const counts = countDoneRemaining(appts, barberId || undefined, now)
  const overdue = forBarber.filter((a) => isOverdue(a, now)).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const summaryOf = (a: TodayAppointment) => a.items_summary ?? a.services?.name ?? ''
  const clientOf = (a: TodayAppointment) => a.clients?.name ?? T.walkInClient

  // ── status buttons ────────────────────────────────────────────────────
  async function setStatus(id: string, status: string) {
    const before = appts
    working.current = true
    setBusy(id); setError(null)
    setAppts((l) => l.map((a) => (a.id === id ? { ...a, status } : a)))
    const { error: err } = await supabase.from('appointments').update({ status }).eq('id', id)
    setBusy(null)
    working.current = false
    if (err) { setAppts(before); setError(T.errorGeneric); return }
    router.refresh()
  }

  function charge(a: TodayAppointment) {
    const p = new URLSearchParams({ bookingId: a.id })
    if (a.client_id) p.set('clientId', a.client_id)
    if (a.service_id) p.set('serviceId', a.service_id)
    if (a.employee_id) p.set('staffId', a.employee_id)
    router.push(`/pos?${p.toString()}`)
  }

  function showOverdue() {
    const first = overdue[0]
    if (!first) return
    setExpanded(first.id)
    setTimeout(() => document.getElementById(`appt-${first.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50)
  }

  // ── walk-in ───────────────────────────────────────────────────────────
  const cartServices: CartService[] = useMemo(
    () => services.map((s) => ({
      id: s.id, name: s.name, price: Number(s.price), duration_min: s.duration_min,
      kind: s.kind === 'supplement' ? 'supplement' : 'main', bookable_alone: !!s.bookable_alone,
      bookable_online: true, is_active: true, includes: s.includes ?? [], exclusive_group: s.exclusive_group ?? null,
    })),
    [services],
  )
  const [sheet, setSheet] = useState(false)
  const walkInServices = useMemo(() => {
    const own = cartServices.filter((s) => s.kind === 'main' || s.bookable_alone)
    return own.length ? own : cartServices
  }, [cartServices])
  const [wiService, setWiService] = useState('')
  const [wiExtras, setWiExtras] = useState<string[]>([])
  const [wiBarber, setWiBarber] = useState('')
  const [wiName, setWiName] = useState('')
  const [wiPhone, setWiPhone] = useState('')
  const [wiSaving, setWiSaving] = useState(false)
  const [wiError, setWiError] = useState<string | null>(null)

  const wiSvc = cartServices.find((s) => s.id === wiService) ?? null
  const wiBlocked = useMemo(() => new Set(wiSvc?.includes ?? []), [wiSvc])
  const supplementChoices = wiSvc && wiSvc.kind === 'main' ? cartServices.filter((s) => s.kind === 'supplement') : []
  const wiTotals = previewSelection({
    service: wiSvc, offer: null, services: cartServices,
    extras: wiExtras.map((id) => cartServices.find((s) => s.id === id)).filter((s): s is CartService => !!s),
  })

  useEffect(() => {
    if (!sheet) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sheet])

  const estimate = useMemo(() => {
    if (!sheet || !wiSvc || wiTotals.totalDuration <= 0) return null
    const [y, m, d] = ymd.split('-').map(Number)
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    const dayHours = computeEffectiveHours(hours).find((h) => h.day_of_week === dow)
    const nowMinutes = minutesInTimezone(new Date(now).toISOString(), tz)
    const candidates: (string | null)[] = wiBarber ? [wiBarber] : barbers.length ? barbers.map((b) => b.id) : [null]
    let best: { start: number; barber: string | null } | null = null
    for (const id of candidates) {
      const busyRanges: MinuteRange[] = appts
        .filter((a) => !['cancelled', 'no_show'].includes(a.status) && (id === null || a.employee_id === id))
        .map((a) => ({ start: minutesInTimezone(a.starts_at, tz), end: minutesInTimezone(a.ends_at, tz) || 24 * 60 }))
      const start = nextFreeStart({ dayHours, durationMin: wiTotals.totalDuration, busy: busyRanges, nowMinutes })
      if (start !== null && (!best || start < best.start)) best = { start, barber: id }
    }
    return best
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, wiSvc, wiTotals.totalDuration, wiBarber, appts, now, hours, barbers, tz, ymd])

  function openSheet() {
    setWiError(null); setWiName(''); setWiPhone(''); setWiBarber(barberId); setWiExtras([])
    setWiService((cur) => cur || walkInServices[0]?.id || '')
    setSheet(true)
  }

  function pickService(id: string) {
    setWiService(id)
    setWiExtras([]) // supplements depend on the main service (what it already includes)
  }

  async function addWalkIn() {
    if (!wiSvc || !estimate) return
    setWiSaving(true); setWiError(null); working.current = true
    let createdAppointmentId: string | null = null
    try {
      let clientId: string | null = null
      const name = wiName.trim()
      const phone = wiPhone.trim()
      if (name) {
        if (phone) {
          const found = await findClientByPhone(supabase, business.id, phone)
          clientId = found?.id ?? null
        }
        if (!clientId) {
          const { data: created, error: cErr } = await supabase.from('clients').insert({ business_id: business.id, name, phone: normalizePhone(phone) ?? (phone || null) }).select('id').single()
          if (cErr || !created) throw new Error('client')
          clientId = created.id
        }
      }
      const startsAt = zonedDateTime(ymd, estimate.start, tz)
      const endsAt = new Date(startsAt.getTime() + wiTotals.totalDuration * 60_000)
      const withExtras = wiTotals.lines.length > 1
      const { data, error: aErr } = await supabase.from('appointments').insert({
        business_id: business.id, client_id: clientId, employee_id: estimate.barber, service_id: wiSvc.id,
        starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
        status: 'confirmed', source: 'manual', price: wiTotals.totalPrice,
        ...(withExtras ? { items_summary: wiTotals.summary } : {}),
      }).select(APPT_SELECT).single()
      if (aErr || !data) {
        setWiError(aErr?.message?.includes('slot_already_booked') ? T.errorTaken : T.errorGeneric)
        return
      }
      createdAppointmentId = data.id

      if (withExtras) {
        // The lines let the POS charge the supplements; without them the sale would be too low,
        // so if they cannot be saved the booking is removed again and the barber can retry.
        const { error: iErr } = await supabase.from('appointment_items').insert(
          wiTotals.lines.map((l, i) => ({
            appointment_id: data.id, business_id: business.id, service_id: l.service_id,
            name: l.name, price: l.price, duration_min: l.duration_min, position: i,
          })),
        )
        if (iErr) {
          await supabase.from('appointments').delete().eq('id', data.id)
          createdAppointmentId = null
          setWiError(T.errorGeneric)
          return
        }
      }

      setAppts((l) => [...l, data as unknown as TodayAppointment])
      createdAppointmentId = null
      setSheet(false)
      router.refresh()
    } catch {
      if (createdAppointmentId) await supabase.from('appointments').delete().eq('id', createdAppointmentId)
      setWiError(T.errorGeneric)
    } finally {
      setWiSaving(false); working.current = false
    }
  }

  // ── share link + checklist ────────────────────────────────────────────
  const link = origin ? `${origin}/book/${business.slug}` : ''
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true); setLinkShared(true)
      try { localStorage.setItem('bb_link_shared', '1') } catch { /* ignore */ }
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked */ }
  }
  const steps = [
    { key: 'barbers', label: T.stepBarbers, done: barbers.length > 0, href: '/settings' },
    { key: 'hours', label: T.stepHours, done: hasHours, href: '/settings' },
    { key: 'link', label: T.stepLink, done: linkShared, href: null as string | null },
  ]
  const showChecklist = !dismissed && steps.some((s) => !s.done)

  const minsTo = (iso: string) => Math.round((new Date(iso).getTime() - now) / 60_000)
  const style = { '--accent': accent } as React.CSSProperties

  // Supplement chips in the walk-in sheet: independent ones first, then each single-choice group.
  const supplementBlocks: { group: string | null; items: CartService[] }[] = []
  const independent = supplementChoices.filter((s) => !s.exclusive_group)
  if (independent.length) supplementBlocks.push({ group: null, items: independent })
  for (const g of Array.from(new Set(supplementChoices.map((s) => s.exclusive_group).filter((g): g is string => !!g)))) {
    supplementBlocks.push({ group: g, items: supplementChoices.filter((s) => s.exclusive_group === g) })
  }

  return (
    <div style={style}>
      <Header title={T.title} />
      <main className="p-4 md:p-6 space-y-4 max-w-3xl pb-28">
        {error && <p role="alert" className="text-sm rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2">{error}</p>}

        <PushBanner />

        {/* Barber filter */}
        {barbers.length > 1 && (
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0" role="group">
            {[{ id: '', name: T.all }, ...barbers].map((b) => (
              <button key={b.id || 'all'} type="button" aria-pressed={barberId === b.id} onClick={() => setBarberId(b.id)}
                className={`shrink-0 min-h-[40px] rounded-full border px-4 text-sm font-medium transition-colors ${barberId === b.id ? 'bg-[#0e0e0f] text-white border-[#0e0e0f]' : 'bg-white text-gray-700 border-gray-300'}`}>
                {b.name}
              </button>
            ))}
          </div>
        )}

        {/* Strip */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900 tabular-nums">{counts.done}<span className="text-gray-400"> / {counts.done + counts.remaining + counts.overdue}</span></div>
            <div className="text-xs text-gray-500 mt-0.5">{fmt(T.done, { n: counts.done })} · {fmt(T.remaining, { n: counts.remaining })}</div>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900 tabular-nums">{money(revenueToday)}</div>
            <div className="text-xs text-gray-500 mt-0.5">{T.revenue}</div>
            {kridiToday > 0 && <div className="text-xs font-semibold text-orange-600 mt-0.5">{fmt(fr.kridi.kridiToday, { amount: money(kridiToday) })}</div>}
          </div>
        </div>

        {overdue.length > 0 && (
          <button type="button" onClick={showOverdue} className="w-full text-left text-sm rounded-lg border border-orange-200 bg-orange-50 text-orange-900 px-3 py-3 min-h-[48px]">
            {fmt(T.overdueBanner, { n: overdue.length })}
          </button>
        )}

        {lowStock > 0 && (
          <Link href="/inventory" className="block text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">{fmt(T.lowStock, { n: lowStock })}</Link>
        )}

        {/* Next client */}
        {next ? (
          <section className="rounded-2xl bg-[#0e0e0f] text-white p-5 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">{next.current ? T.inProgress : T.next}</span>
              <span className="text-sm text-white/60 tabular-nums">
                {next.current ? fmt(T.endsAt, { time: timeOf(next.appt.ends_at) }) : minsTo(next.appt.starts_at) <= 0 ? T.startsNow : fmt(T.inMinutes, { n: minsTo(next.appt.starts_at) })}
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <div className="text-4xl font-extrabold tabular-nums text-[var(--accent)]">{timeOf(next.appt.starts_at)}</div>
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">{clientOf(next.appt)}</div>
                <div className="text-sm text-white/70 truncate">{summaryOf(next.appt)}{barberName(next.appt.employee_id) ? ` · ${barberName(next.appt.employee_id)}` : ''}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy === next.appt.id} onClick={() => void setStatus(next.appt.id, 'completed')}
                className="min-h-[52px] rounded-xl bg-[var(--accent)] text-[#111] font-bold text-base disabled:opacity-60">{T.finish}</button>
              <button type="button" onClick={() => charge(next.appt)}
                className="min-h-[52px] rounded-xl bg-white/10 text-white font-semibold text-base">{T.charge}</button>
            </div>
            <div className="mt-2 flex gap-2">
              {['pending', 'confirmed'].includes(next.appt.status) && (
                <button type="button" onClick={() => setPostponeId(next.appt.id)}
                  className="flex-1 min-h-[44px] rounded-xl text-sm text-white/80 hover:text-white">{fr.agenda.postpone.button}</button>
              )}
              <button type="button" disabled={busy === next.appt.id} onClick={() => void setStatus(next.appt.id, 'no_show')}
                className="flex-1 min-h-[44px] rounded-xl text-sm text-white/60 hover:text-white">{T.noShow}</button>
            </div>
          </section>
        ) : forBarber.some((a) => a.status !== 'cancelled') && overdue.length === 0 ? (
          <p className="rounded-xl bg-white border border-gray-200 p-4 text-sm text-gray-600">{T.nothingLeft}</p>
        ) : null}

        {/* Timeline */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">{T.timeline}</h2>
          {visible.length === 0 ? (
            <div className="rounded-xl bg-white border border-gray-200 p-6 text-center">
              <div className="font-medium text-gray-900">{T.empty}</div>
              <p className="text-sm text-gray-500 mt-1">{T.emptyHint}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((a) => {
                const open = expanded === a.id
                const late = isOverdue(a, now)
                const dim = ['completed', 'paid', 'cancelled', 'no_show'].includes(a.status)
                const canAct = ['pending', 'confirmed'].includes(a.status)
                const label = late ? T.status.overdue : (T.status as Record<string, string>)[a.status] ?? a.status
                return (
                  <li key={a.id} id={`appt-${a.id}`} className={`rounded-xl bg-white border ${late ? 'border-orange-300' : 'border-gray-200'} ${dim ? 'opacity-70' : ''}`}>
                    <button type="button" onClick={() => setExpanded(open ? null : a.id)} aria-expanded={open}
                      className="w-full flex items-center gap-3 p-3 text-left min-h-[60px]">
                      <div className="w-14 shrink-0 text-base font-bold text-gray-900 tabular-nums">{timeOf(a.starts_at)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 truncate">{clientOf(a)}</div>
                        <div className="text-xs text-gray-500 truncate">{summaryOf(a)}{!barberId && barberName(a.employee_id) ? ` · ${barberName(a.employee_id)}` : ''}</div>
                      </div>
                      <span className={`shrink-0 text-[11px] font-semibold rounded-full px-2 py-0.5 ${STATUS_STYLE[late ? 'overdue' : a.status] ?? 'bg-gray-100 text-gray-700'}`}>{label}</span>
                      <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="px-3 pb-3 flex flex-wrap gap-2">
                        {canAct && <button type="button" disabled={busy === a.id} onClick={() => void setStatus(a.id, 'completed')} className="min-h-[44px] px-4 rounded-lg bg-[#0e0e0f] text-white text-sm font-semibold">{T.finish}</button>}
                        {a.status !== 'paid' && a.status !== 'cancelled' && a.status !== 'no_show' && (
                          <button type="button" onClick={() => charge(a)} className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-800">{T.charge}</button>
                        )}
                        {canAct && <button type="button" disabled={busy === a.id} onClick={() => void setStatus(a.id, 'no_show')} className="min-h-[44px] px-4 rounded-lg text-sm text-gray-600">{T.noShow}</button>}
                        {canAct && <button type="button" disabled={busy === a.id} onClick={() => void setStatus(a.id, 'cancelled')} className="min-h-[44px] px-4 rounded-lg text-sm text-red-600">{T.cancel}</button>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {cancelledCount > 0 && (
            <button type="button" onClick={() => setShowCancelled((v) => !v)} className="mt-2 min-h-[44px] text-sm text-gray-500 underline">
              {showCancelled ? T.hideCancelled : fmt(T.showCancelled, { n: cancelledCount })}
            </button>
          )}
        </section>

        <RemindersCard
          appts={reminders.filter((a) => !barberId || a.employee_id === barberId)}
          remindedIds={remindedIds} day={tomorrowLabel} shopName={business.name} timezone={tz}
        />

        {(() => {
          const target = appts.find((a) => a.id === postponeId)
          if (!target) return null
          return (
            <PostponeSheet
              appt={{ id: target.id, starts_at: target.starts_at, ends_at: target.ends_at, employee_id: target.employee_id, clientName: clientOf(target), clientPhone: target.clients?.phone }}
              ymdNow={ymd} timezone={tz} hours={hours} barbers={barbers}
              onClose={() => setPostponeId(null)}
              onDone={() => { setPostponeId(null); router.refresh() }}
            />
          )
        })()}

        {/* Checklist */}
        {showChecklist && (
          <section className="rounded-xl bg-white border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{T.checklistTitle}</h2>
              <button type="button" onClick={() => { setDismissed(true); try { localStorage.setItem('bb_checklist_dismissed', '1') } catch { /* ignore */ } }} className="text-xs text-gray-500 hover:underline">{T.dismiss}</button>
            </div>
            <ul className="mt-2 space-y-1">
              {steps.map((s) => (
                <li key={s.key} className="flex items-center gap-3 min-h-[44px]">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${s.done ? 'bg-green-100 text-green-700' : 'border-2 border-gray-300'}`}>{s.done && <Check className="w-4 h-4" />}</span>
                  <span className={`text-sm flex-1 ${s.done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{s.label}</span>
                  {!s.done && (s.href ? <Link href={s.href} className="text-sm font-medium text-blue-600">{T.go}</Link> : <button type="button" onClick={() => void copyLink()} className="text-sm font-medium text-blue-600">{T.copy}</button>)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Share link */}
        <section className="rounded-xl bg-white border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900">{T.linkTitle}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{T.linkHint}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-800">{link || '…'}</code>
            <button type="button" onClick={() => void copyLink()} className="inline-flex items-center gap-1.5 shrink-0 min-h-[40px] rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? T.copied : T.copy}
            </button>
          </div>
        </section>
      </main>

      {/* Walk-in button */}
      <button type="button" onClick={openSheet}
        className="fixed right-4 md:right-6 z-20 bottom-[calc(4.25rem+env(safe-area-inset-bottom)+0.75rem)] md:bottom-6 inline-flex items-center gap-2 h-14 px-5 rounded-full bg-[var(--accent)] text-[#111] font-bold shadow-xl">
        <Plus className="w-5 h-5" /> {T.walkInButton}
      </button>

      {/* Walk-in sheet */}
      {sheet && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={T.walkInTitle}>
          <div className="absolute inset-0 bg-black/60" onClick={() => setSheet(false)} />
          <div className="absolute bottom-0 inset-x-0 mx-auto max-w-lg bg-white rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{T.walkInTitle}</h2>
              <button type="button" onClick={() => setSheet(false)} aria-label={fr.nav.close} className="p-2 rounded-lg text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            {walkInServices.length === 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p>{T.noServices}</p>
                <Link href="/settings?tab=services" className="mt-2 inline-block min-h-[44px] leading-[44px] font-semibold underline">{T.openSettings}</Link>
              </div>
            ) : (
              <>
                <div className="mt-3 text-xs font-medium text-gray-500">{T.service}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {walkInServices.map((s) => (
                    <button key={s.id} type="button" aria-pressed={wiService === s.id} onClick={() => pickService(s.id)}
                      className={`min-h-[44px] rounded-full border px-4 text-sm font-medium ${wiService === s.id ? 'bg-[#0e0e0f] text-white border-[#0e0e0f]' : 'bg-white text-gray-700 border-gray-300'}`}>
                      {s.name} · {s.duration_min} min
                    </button>
                  ))}
                </div>

                {supplementBlocks.length > 0 && (
                  <>
                    <div className="mt-4 text-xs font-medium text-gray-500">{T.extrasTitle}</div>
                    {supplementBlocks.map((blk) => (
                      <div key={blk.group ?? '_'} className="mt-1">
                        {blk.group && <div className="text-[11px] text-gray-400 mt-1">{fmt(T.singleChoiceGroup, { group: blk.group })}</div>}
                        <div className="mt-1 flex flex-wrap gap-2">
                          {blk.items.map((s) => {
                            const inc = wiBlocked.has(s.id)
                            const on = wiExtras.includes(s.id)
                            return (
                              <button key={s.id} type="button" aria-pressed={on || inc} disabled={inc}
                                onClick={() => setWiExtras((cur) => toggleAddOn(cur, s.id, cartServices, wiBlocked))}
                                className={`min-h-[44px] rounded-full border px-4 text-sm font-medium ${inc ? 'bg-gray-100 text-gray-400 border-gray-200' : on ? 'bg-[var(--accent)] text-[#111] border-[var(--accent)]' : 'bg-white text-gray-700 border-gray-300'}`}>
                                {inc ? `✓ ${s.name} · ${T.included}` : `${s.name} · +${money(s.price)}`}
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
                    <div className="mt-4 text-xs font-medium text-gray-500">{T.barber}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {[{ id: '', name: T.firstFree }, ...barbers].map((b) => (
                        <button key={b.id || 'any'} type="button" aria-pressed={wiBarber === b.id} onClick={() => setWiBarber(b.id)}
                          className={`min-h-[44px] rounded-full border px-4 text-sm font-medium ${wiBarber === b.id ? 'bg-[#0e0e0f] text-white border-[#0e0e0f]' : 'bg-white text-gray-700 border-gray-300'}`}>
                          {b.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">{T.name}</span>
                    <input value={wiName} onChange={(e) => setWiName(e.target.value)} autoComplete="off" className="mt-1 w-full min-h-[48px] rounded-lg border border-gray-300 px-3 text-base" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">{T.phone}</span>
                    <input value={wiPhone} onChange={(e) => setWiPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="off" className="mt-1 w-full min-h-[48px] rounded-lg border border-gray-300 px-3 text-base" />
                  </label>
                </div>

                {wiSvc && (
                  <div className="mt-4 flex items-center justify-between text-sm text-gray-700">
                    <span>{wiTotals.summary}</span>
                    <b className="tabular-nums">{fmt(T.total, { price: money(wiTotals.totalPrice), n: wiTotals.totalDuration })}</b>
                  </div>
                )}

                <div className="mt-2 rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm text-gray-800" aria-live="polite">
                  {!wiService ? T.chooseService
                    : estimate ? (estimate.barber && barbers.length > 1 ? fmt(T.estimateWith, { time: formatMinutes(estimate.start), barber: barberName(estimate.barber) ?? '' }) : fmt(T.estimate, { time: formatMinutes(estimate.start) }))
                      : T.noSlot}
                </div>
                {wiError && <p role="alert" className="mt-2 text-sm text-red-600">{wiError}</p>}

                <button type="button" disabled={!estimate || wiSaving} onClick={() => void addWalkIn()}
                  className="mt-4 w-full min-h-[56px] rounded-xl bg-[#0e0e0f] text-white text-base font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2">
                  {wiSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> {T.adding}</> : T.add}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
