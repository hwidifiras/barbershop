'use client'

// Phone "Agenda" for barbershop mode (docs/barbershop-mode/SPEC.md 4.3): one day as a vertical list,
// previous/next day (arrows or swipe), "Aujourd'hui", a barber filter, and a bottom sheet per
// appointment with the status actions, Encaisser, Call and WhatsApp. French only. Statuses are the
// existing `appointments.status` values; nothing new in the database.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Phone, MessageCircle, X } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatInBusinessTimezone } from '@/lib/utils'
import { isOverdue, localYmd } from '@/lib/barbershop-today'
import { formatPhone, whatsappNumber } from '@/lib/phone'
import { fr, fmt } from '@/lib/barbershop-fr'

const A = fr.agenda

export interface AgendaAppointment {
  id: string; starts_at: string; ends_at: string; status: string; price: number | null
  items_summary: string | null; notes: string | null; source: string | null
  employee_id: string | null; service_id: string | null; client_id: string | null
  clients: { id: string; name: string; phone: string | null } | null
  services: { id: string; name: string } | null
}
interface Barber { id: string; name: string; avatar_url: string | null }

interface Props {
  business: { id: string; currency: string; timezone: string }
  ymd: string
  today: string
  prevYmd: string
  nextYmd: string
  view: 'day' | 'week'
  weekDays: { ymd: string; closed: boolean }[]
  prevWeekYmd: string
  nextWeekYmd: string
  nowMs: number
  accent: string
  barbers: Barber[]
  closed: boolean
  initialAppts: AgendaAppointment[]
}

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
const SWIPE_MIN_PX = 70

export function AgendaView({ business, ymd, today, prevYmd, nextYmd, view, weekDays, prevWeekYmd, nextWeekYmd, nowMs, accent, barbers, closed, initialAppts }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const tz = business.timezone
  const money = (n: number) => formatCurrency(n, business.currency, 'fr-FR')
  const timeOf = (iso: string) => formatInBusinessTimezone(iso, tz, 'time', 'fr')

  const [appts, setAppts] = useState(initialAppts)
  const [now, setNow] = useState(nowMs)
  const [barberId, setBarberId] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCancelled, setShowCancelled] = useState(false)

  // The server sends the day again after router.refresh() or when the day changes.
  useEffect(() => { setAppts(initialAppts) }, [initialAppts])

  const working = useRef(false)
  const lastRefresh = useRef(0)
  useEffect(() => {
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

  useEffect(() => {
    if (!openId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId])

  // One place builds the address: view (day or week) + the date shown.
  const go = (v: 'day' | 'week', d: string) => {
    setOpenId(null)
    const q = new URLSearchParams()
    if (v === 'week') q.set('v', 'week')
    if (d !== today) q.set('d', d)
    const qs = q.toString()
    router.push(qs ? `/booking?${qs}` : '/booking')
  }
  const goTo = (d: string) => go('day', d)
  const weekStart = weekDays[0].ymd
  const weekEnd = weekDays[6].ymd
  const weekHasToday = today >= weekStart && today <= weekEnd

  // Swipe left = next day, right = previous day (ignored when mostly vertical, or inside the sheet).
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; touch.current = null
    if (!s || openId) return
    const dx = e.changedTouches[0].clientX - s.x
    const dy = e.changedTouches[0].clientY - s.y
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (view === 'week') go('week', dx < 0 ? nextWeekYmd : prevWeekYmd)
    else goTo(dx < 0 ? nextYmd : prevYmd)
  }

  const barberName = (id: string | null) => barbers.find((b) => b.id === id)?.name ?? null
  const forBarber = useMemo(() => appts.filter((a) => !barberId || a.employee_id === barberId), [appts, barberId])
  const cancelledCount = forBarber.filter((a) => a.status === 'cancelled').length
  const visible = useMemo(
    () => forBarber.filter((a) => showCancelled || a.status !== 'cancelled').sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [forBarber, showCancelled],
  )
  const active = forBarber.filter((a) => a.status !== 'cancelled').length
  const opened = appts.find((a) => a.id === openId) ?? null

  const fmtDay = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...o, timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))
  const byDay = useMemo(() => {
    const m = new Map<string, AgendaAppointment[]>()
    for (const a of forBarber) {
      if (a.status === 'cancelled') continue
      const k = localYmd(new Date(a.starts_at), tz)
      m.set(k, [...(m.get(k) ?? []), a])
    }
    return m
  }, [forBarber, tz])
  const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${ymd}T12:00:00Z`))
  const clientOf = (a: AgendaAppointment) => a.clients?.name ?? A.walkIn
  const summaryOf = (a: AgendaAppointment) => a.items_summary ?? a.services?.name ?? ''

  async function setStatus(a: AgendaAppointment, status: string) {
    const before = appts
    working.current = true
    setBusy(true); setError(null)
    setAppts((l) => l.map((x) => (x.id === a.id ? { ...x, status } : x)))
    const { error: err } = await supabase.from('appointments').update({ status }).eq('id', a.id)
    setBusy(false); working.current = false
    if (err) { setAppts(before); setError(A.errorGeneric); return }
    setOpenId(null)
    router.refresh()
  }

  function charge(a: AgendaAppointment) {
    const p = new URLSearchParams({ bookingId: a.id })
    if (a.client_id) p.set('clientId', a.client_id)
    if (a.service_id) p.set('serviceId', a.service_id)
    if (a.employee_id) p.set('staffId', a.employee_id)
    router.push(`/pos?${p.toString()}`)
  }

  return (
    <div className="min-h-[60vh]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <Header title={A.title} />
      <main className="p-4 pb-28 max-w-lg mx-auto space-y-3">
        {/* Jour / Semaine switch */}
        <div className="grid grid-cols-2 rounded-xl bg-gray-100 p-1" role="group">
          {(['day', 'week'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v}
              onClick={() => { if (v !== view) go(v, v === 'week' ? ymd : (weekHasToday ? today : weekStart)) }}
              className={`min-h-[44px] rounded-lg text-sm font-semibold ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              {v === 'day' ? A.viewDay : A.viewWeek}
            </button>
          ))}
        </div>

        {view === 'day' && (<>
        {/* Day navigation */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => goTo(prevYmd)} aria-label={A.prevDay}
            className="min-w-[48px] min-h-[48px] rounded-xl border border-gray-300 bg-white flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></button>
          <div className="flex-1 text-center">
            <div className="text-base font-bold text-gray-900 capitalize leading-tight">{dayLabel}</div>
            <div className="text-xs text-gray-500">{active === 1 ? A.countOne : fmt(A.count, { n: active })}</div>
          </div>
          <button type="button" onClick={() => goTo(nextYmd)} aria-label={A.nextDay}
            className="min-w-[48px] min-h-[48px] rounded-xl border border-gray-300 bg-white flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
        </div>
        {ymd !== today && (
          <button type="button" onClick={() => goTo(today)} className="w-full min-h-[44px] rounded-xl text-sm font-semibold text-white" style={{ background: '#0e0e0f' }}>{A.today}</button>
        )}
        </>)}

        {view === 'week' && (<>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go('week', prevWeekYmd)} aria-label={A.prevWeek}
            className="min-w-[48px] min-h-[48px] rounded-xl border border-gray-300 bg-white flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></button>
          <div className="flex-1 text-center">
            <div className="text-base font-bold text-gray-900 leading-tight">{fmt(A.weekOf, { from: fmtDay(weekStart, { day: 'numeric', month: 'short' }), to: fmtDay(weekEnd, { day: 'numeric', month: 'short' }) })}</div>
          </div>
          <button type="button" onClick={() => go('week', nextWeekYmd)} aria-label={A.nextWeek}
            className="min-w-[48px] min-h-[48px] rounded-xl border border-gray-300 bg-white flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
        </div>
        {!weekHasToday && (
          <button type="button" onClick={() => go('week', today)} className="w-full min-h-[44px] rounded-xl text-sm font-semibold text-white" style={{ background: '#0e0e0f' }}>{A.thisWeek}</button>
        )}
        </>)}

        {/* Barber filter */}
        {barbers.length > 1 && (
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" role="group">
            {[{ id: '', name: A.all }, ...barbers].map((b) => (
              <button key={b.id || 'all'} type="button" aria-pressed={barberId === b.id} onClick={() => setBarberId(b.id)}
                className={`shrink-0 min-h-[40px] px-4 rounded-full text-sm font-medium border ${barberId === b.id ? 'text-white border-transparent' : 'bg-white text-gray-700 border-gray-300'}`}
                style={barberId === b.id ? { background: '#0e0e0f' } : undefined}>{b.name}</button>
            ))}
          </div>
        )}

        {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3" role="alert">{error}</div>}

        {/* The week: one row per day, tap a day to open it */}
        {view === 'week' && (
          <ul className="space-y-2">
            {weekDays.map((w) => {
              const list = (byDay.get(w.ymd) ?? []).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
              const isToday = w.ymd === today
              return (
                <li key={w.ymd}>
                  <button type="button" onClick={() => goTo(w.ymd)}
                    className={`w-full flex gap-3 p-3 text-left min-h-[64px] rounded-xl bg-white border ${isToday ? 'border-2' : 'border-gray-200'} ${w.closed && list.length === 0 ? 'opacity-60' : ''}`}
                    style={isToday ? { borderColor: accent } : undefined}>
                    <div className="w-14 shrink-0 text-center">
                      <div className="text-xs font-semibold text-gray-500 uppercase">{fmtDay(w.ymd, { weekday: 'short' }).replace('.', '')}</div>
                      <div className="text-xl font-extrabold text-gray-900 tabular-nums leading-tight">{fmtDay(w.ymd, { day: 'numeric' })}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      {list.length === 0 ? (
                        <div className="text-sm text-gray-400 pt-2">{w.closed ? A.closed : A.free}</div>
                      ) : (
                        <>
                          <div className="text-sm font-semibold text-gray-900">{list.length === 1 ? A.countOne : fmt(A.count, { n: list.length })}</div>
                          <ul className="mt-0.5 space-y-0.5">
                            {list.slice(0, 3).map((a) => (
                              <li key={a.id} className="text-xs text-gray-600 truncate"><span className="tabular-nums font-medium">{timeOf(a.starts_at)}</span> {clientOf(a)}</li>
                            ))}
                          </ul>
                          {list.length > 3 && <div className="text-xs text-gray-400 mt-0.5">{fmt(A.more, { n: list.length - 3 })}</div>}
                        </>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0 self-center text-gray-400" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {/* The day */}
        {view === 'day' && (visible.length === 0 ? (
          <div className="rounded-xl bg-white border border-gray-200 p-6 text-center">
            <div className="font-medium text-gray-900">{closed ? A.closed : ymd === today ? A.emptyToday : A.empty}</div>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((a) => {
              const late = isOverdue(a, now)
              const dim = ['completed', 'paid', 'cancelled', 'no_show'].includes(a.status)
              const label = late ? A.status.overdue : (A.status as Record<string, string>)[a.status] ?? a.status
              return (
                <li key={a.id}>
                  <button type="button" onClick={() => setOpenId(a.id)}
                    className={`w-full flex items-center gap-3 p-3 text-left min-h-[64px] rounded-xl bg-white border ${late ? 'border-orange-300' : 'border-gray-200'} ${dim ? 'opacity-70' : ''}`}>
                    <div className="w-14 shrink-0">
                      <div className="text-base font-bold text-gray-900 tabular-nums">{timeOf(a.starts_at)}</div>
                      <div className="text-[11px] text-gray-400 tabular-nums">{timeOf(a.ends_at)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900 truncate">{clientOf(a)}</div>
                      <div className="text-xs text-gray-500 truncate">{summaryOf(a)}{!barberId && barberName(a.employee_id) ? ` · ${barberName(a.employee_id)}` : ''}</div>
                    </div>
                    <span className={`shrink-0 text-[11px] font-semibold rounded-full px-2 py-0.5 ${STATUS_STYLE[late ? 'overdue' : a.status] ?? 'bg-gray-100 text-gray-700'}`}>{label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ))}
        {view === 'day' && cancelledCount > 0 && (
          <button type="button" onClick={() => setShowCancelled((v) => !v)} className="min-h-[44px] text-sm text-gray-500 underline">
            {showCancelled ? A.hideCancelled : fmt(A.showCancelled, { n: cancelledCount })}
          </button>
        )}
      </main>

      {/* Appointment sheet */}
      {opened && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end justify-center" onClick={() => setOpenId(null)}>
          <div role="dialog" aria-modal="true" aria-label={clientOf(opened)} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[88dvh] overflow-y-auto bg-white rounded-t-2xl p-4 space-y-4"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold text-gray-900 truncate">{clientOf(opened)}</div>
                <div className="text-sm text-gray-500 tabular-nums capitalize">{dayLabel} · {timeOf(opened.starts_at)} – {timeOf(opened.ends_at)}</div>
              </div>
              <button type="button" onClick={() => setOpenId(null)} aria-label={A.close} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500"><X className="w-6 h-6" /></button>
            </div>

            <dl className="rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm">
              <Row label={A.service} value={summaryOf(opened) || '—'} />
              {barberName(opened.employee_id) && <Row label={A.with} value={barberName(opened.employee_id)!} />}
              {opened.price != null && <Row label={A.price} value={money(Number(opened.price))} />}
              {opened.clients?.phone && <Row label={A.phone} value={formatPhone(opened.clients.phone)} />}
              <Row label="" value={opened.source === 'online' ? A.online : A.manual} muted />
              {opened.notes && <Row label={A.notes} value={opened.notes} />}
            </dl>

            {opened.clients?.phone && (
              <div className="grid grid-cols-2 gap-2">
                <a href={`tel:${opened.clients.phone.replace(/[^\d+]/g, '')}`} className="min-h-[48px] rounded-xl border border-gray-300 flex items-center justify-center gap-2 text-sm font-semibold text-gray-800"><Phone className="w-4 h-4" />{A.call}</a>
                {whatsappNumber(opened.clients.phone) && (
                  <a href={`https://wa.me/${whatsappNumber(opened.clients.phone)}`} target="_blank" rel="noopener noreferrer" className="min-h-[48px] rounded-xl border border-gray-300 flex items-center justify-center gap-2 text-sm font-semibold text-gray-800"><MessageCircle className="w-4 h-4" />{A.whatsapp}</a>
                )}
              </div>
            )}

            <div className="space-y-2">
              {['pending', 'confirmed'].includes(opened.status) && (
                <button type="button" disabled={busy} onClick={() => void setStatus(opened, 'completed')}
                  className="w-full min-h-[52px] rounded-xl text-base font-bold text-white disabled:opacity-50" style={{ background: '#0e0e0f' }}>{A.finish}</button>
              )}
              {!['paid', 'cancelled', 'no_show'].includes(opened.status) && (
                <button type="button" onClick={() => charge(opened)} className="w-full min-h-[52px] rounded-xl border-2 text-base font-bold text-gray-900" style={{ borderColor: accent }}>{A.charge}</button>
              )}
              {opened.status === 'pending' && (
                <button type="button" disabled={busy} onClick={() => void setStatus(opened, 'confirmed')} className="w-full min-h-[48px] rounded-xl border border-gray-300 text-sm font-semibold text-gray-800 disabled:opacity-50">{A.confirm}</button>
              )}
              {['pending', 'confirmed'].includes(opened.status) && (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy} onClick={() => void setStatus(opened, 'no_show')} className="min-h-[48px] rounded-xl text-sm font-medium text-gray-700 bg-gray-100 disabled:opacity-50">{A.noShow}</button>
                  <button type="button" disabled={busy} onClick={() => void setStatus(opened, 'cancelled')} className="min-h-[48px] rounded-xl text-sm font-medium text-red-700 bg-red-50 disabled:opacity-50">{A.cancel}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2.5">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd className={`text-right ${muted ? 'text-gray-400 text-xs w-full text-left' : 'font-medium text-gray-900'}`}>{value}</dd>
    </div>
  )
}
