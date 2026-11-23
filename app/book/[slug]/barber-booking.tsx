'use client'

// Public booking page for barbershop mode (docs/barbershop-mode/SPEC.md section 4.9).
// Reuses the existing booking backend unchanged: get_booked_slots RPC for availability and
// POST /api/book for the atomic reservation. Only the presentation and the flow are new.

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, CalendarPlus, Check, Loader2, MapPin, MessageCircle, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { buildGCalUrl } from '@/lib/gcal'
import { computeEffectiveHours, type DayHours } from '@/lib/booking-availability'
import {
  computeBarberSlots, groupByDayPart, minutesInTimezone, unionSlots, type BookedRange,
} from '@/lib/barbershop-slots'
import { fr, fmt } from '@/lib/barbershop-fr'
import { bricolage, dmSans } from '@/lib/landing-fonts'
import styles from './barber-booking.module.css'

interface Service { id: string; name: string; description: string | null; price: number; duration_min: number; category: string | null }
interface Barber { id: string; name: string; avatar_url: string | null }
interface Business {
  id: string; name: string; currency: string; slug: string; timezone: string | null
  address: string | null; phone: string | null; logo_url: string | null
}

interface Props {
  business: Business
  services: Service[]
  barbers: Barber[]
  workingHours: DayHours[]
  accent: string
  initialBarberId?: string | null
  initialServiceId?: string | null
}

type Step = 'pick' | 'time' | 'contact' | 'done'
const DAYS_AHEAD = 14
const CONTACT_KEY = 'barbershop_contact_v1'
const L = fr.booking

// ── date helpers (all in the business timezone) ─────────────────────────────

function todayIn(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}
function dowOf(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}
function utcDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const frDate = (ymd: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'UTC' }).format(utcDate(ymd))

export function BarberBooking({ business, services, barbers, workingHours, accent, initialBarberId, initialServiceId }: Props) {
  const supabase = createClient()
  const tz = business.timezone ?? 'UTC'
  const hours = computeEffectiveHours(workingHours)
  const today = todayIn(tz)
  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i))
  const isOpenOn = (ymd: string) => hours.find((h) => h.day_of_week === dowOf(ymd))?.is_open ?? false

  const validBarber = barbers.some((b) => b.id === initialBarberId) ? (initialBarberId as string) : ''
  const [barberId, setBarberId] = useState<string>(validBarber)
  const [service, setService] = useState<Service | null>(null)
  const [step, setStep] = useState<Step>('pick')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [next, setNext] = useState<{ date: string; time: string; slots: string[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [contact, setContact] = useState({ name: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const req = useRef(0)

  const barber = barbers.find((b) => b.id === barberId) ?? null

  // Free times for one date: one barber, or the union across all barbers for "first available".
  const slotsFor = useCallback(async (ymd: string, svc: Service, bId: string): Promise<string[]> => {
    const dayHours = hours.find((h) => h.day_of_week === dowOf(ymd))
    if (!dayHours?.is_open) return []
    const ids: (string | null)[] = bId ? [bId] : barbers.length > 0 ? barbers.map((b) => b.id) : [null]
    const lists = await Promise.all(ids.map(async (id) => {
      let booked: BookedRange[] = []
      try {
        const { data } = await supabase.rpc('get_booked_slots', { p_business_id: business.id, p_date: ymd, p_employee_id: id })
        booked = (data ?? []) as BookedRange[]
      } catch { /* treat as free; the server re-checks atomically on submit */ }
      return computeBarberSlots({
        dayHours, durationMin: svc.duration_min, booked, timezone: tz,
        nowMinutes: ymd === today ? minutesInTimezone(new Date().toISOString(), tz) : undefined,
      })
    }))
    return unionSlots(lists)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id, tz, today, barbers, workingHours])

  // Entering the time step: jump to the first date that has a free slot (saves taps).
  const openTimeStep = useCallback(async (svc: Service, bId: string) => {
    const my = ++req.current
    setStep('time'); setError(null); setTime(''); setSlots([]); setNext(null); setLoading(true)
    let found: { date: string; slots: string[] } | null = null
    for (const d of dates) {
      if (!isOpenOn(d)) continue
      const s = await slotsFor(d, svc, bId)
      if (my !== req.current) return
      if (s.length) { found = { date: d, slots: s }; break }
    }
    if (my !== req.current) return
    if (found) {
      setDate(found.date); setSlots(found.slots)
      setNext({ date: found.date, time: found.slots[0], slots: found.slots })
    } else {
      setDate(dates.find(isOpenOn) ?? dates[0]); setSlots([])
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsFor])

  async function pickDate(d: string) {
    if (!service) return
    const my = ++req.current
    setDate(d); setTime(''); setSlots([]); setLoading(true); setError(null)
    const s = await slotsFor(d, service, barberId)
    if (my !== req.current) return
    setSlots(s); setLoading(false)
  }

  function chooseService(s: Service) {
    setService(s)
    void openTimeStep(s, barberId)
  }

  // Prefill a returning client; honour ?b= and ?s= deep links.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONTACT_KEY)
      if (raw) {
        const c = JSON.parse(raw)
        if (c && typeof c.name === 'string' && typeof c.phone === 'string') setContact({ name: c.name, phone: c.phone })
      }
    } catch { /* storage unavailable (private mode / in-app browser): ignore */ }
    const svc = services.find((s) => s.id === initialServiceId)
    if (svc) { setService(svc); void openTimeStep(svc, validBarber) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { window.scrollTo({ top: 0 }) }, [step])

  async function submit() {
    if (!service || !date || !time) return
    const name = contact.name.trim()
    const phone = contact.phone.trim()
    if (!name) { setError(L.errorName); return }
    if (!/^[\d\s+\-().]{7,}$/.test(phone)) { setError(L.errorPhone); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id, serviceId: service.id, employeeId: barberId || null,
          date, time, name, phone, email: null,
        }),
      })
      if (res.status === 409) {
        const body = await res.json().catch(() => null)
        setSaving(false)
        if (body?.error === 'no_staff_available') { setError(L.errorNoStaff); return }
        setError(L.errorSlotTaken); setStep('time'); setTime('')
        void pickDate(date)
        return
      }
      if (res.status === 429) { setSaving(false); setError(L.errorRateLimit); return }
      if (res.status === 403) { setSaving(false); setError(L.errorClosedOnline); return }
      if (!res.ok) throw new Error(String(res.status))
      try { localStorage.setItem(CONTACT_KEY, JSON.stringify({ name, phone })) } catch { /* ignore */ }
      setSaving(false); setStep('done')
    } catch {
      setSaving(false); setError(L.errorGeneric)
    }
  }

  function reset() {
    ++req.current
    setService(null); setStep('pick'); setDate(''); setTime(''); setSlots([]); setNext(null); setError(null)
  }

  // ── derived view data ─────────────────────────────────────────────────────

  const groups: { title: string | null; items: Service[] }[] = []
  for (const s of services) {
    const key = s.category?.trim() || null
    let g = groups.find((x) => x.title === key)
    if (!g) { g = { title: key, items: [] }; groups.push(g) }
    g.items.push(s)
  }
  const multipleGroups = groups.length > 1
  const dayLabel = (d: string) =>
    d === today ? L.today : d === addDays(today, 1) ? L.tomorrow : frDate(d, { weekday: 'long', day: 'numeric', month: 'long' })
  const whenLabel = date && time ? `${frDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${time}` : ''
  const parts = groupByDayPart(slots)
  const price = service ? formatCurrency(service.price, business.currency, 'fr-FR') : ''
  const phoneDigits = (business.phone ?? '').replace(/[^\d+]/g, '')
  const canWhatsapp = /^(\+|00)\d{8,}$/.test(phoneDigits)

  const rootStyle = { '--accent': accent } as React.CSSProperties

  return (
    <div className={`${styles.root} ${bricolage.variable} ${dmSans.variable}`} style={rootStyle}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logo_url} alt="" className={styles.logo} />
          ) : (
            <div className={`${styles.logoFallback} ${styles.display}`}>{business.name.trim()[0]?.toUpperCase()}</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div className={`${styles.shopName} ${styles.display}`}>{business.name}</div>
            <div className={styles.tagline}>{L.headerTagline}</div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {error && <div className={styles.error} role="alert">{error}</div>}

        {/* ── Screen 1: barber + service ─────────────────────────────── */}
        {step === 'pick' && (
          <>
            {barbers.length > 1 && (
              <>
                <h2 className={`${styles.h2} ${styles.display}`}>{L.chooseBarber}</h2>
                <div className={styles.barbers} role="group" aria-label={L.chooseBarber}>
                  <button className={styles.barber} aria-pressed={barberId === ''} onClick={() => setBarberId('')}>
                    <span className={styles.avatar}>✂</span>
                    <span className={styles.barberName}>{L.anyBarber}</span>
                    <span className={styles.barberSub}>{L.anyBarberHint}</span>
                  </button>
                  {barbers.map((b) => (
                    <button key={b.id} className={styles.barber} aria-pressed={barberId === b.id} onClick={() => setBarberId(b.id)}>
                      {b.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.avatar_url} alt="" className={styles.avatar} />
                      ) : (
                        <span className={styles.avatar}>{b.name.trim()[0]?.toUpperCase()}</span>
                      )}
                      <span className={styles.barberName}>{b.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <h2 className={`${styles.h2} ${styles.display}`}>{L.chooseService}</h2>
            {groups.map((g) => (
              <div key={g.title ?? '_'}>
                {multipleGroups && <h3 className={styles.h3}>{g.title ?? L.otherCategory}</h3>}
                {g.items.map((s) => (
                  <button key={s.id} className={styles.service} onClick={() => chooseService(s)}>
                    <span>
                      <div className={styles.serviceName}>{s.name}</div>
                      <div className={`${styles.serviceMeta} ${styles.num}`}>
                        {fmt(L.minutes, { n: s.duration_min })}{s.description ? ` · ${s.description}` : ''}
                      </div>
                    </span>
                    <span className={`${styles.price} ${styles.num}`}>{formatCurrency(s.price, business.currency, 'fr-FR')}</span>
                  </button>
                ))}
              </div>
            ))}
          </>
        )}

        {/* ── Screen 2: date + time ──────────────────────────────────── */}
        {step === 'time' && service && (
          <>
            <button className={styles.back} onClick={() => { ++req.current; setStep('pick'); setError(null) }}>
              <ArrowLeft size={16} /> {L.back}
            </button>
            <h2 className={`${styles.h2} ${styles.display}`} style={{ marginTop: 4 }}>{L.chooseTime}</h2>
            <div className={styles.muted}>
              {service.name} · {fmt(L.minutes, { n: service.duration_min })}{barber ? ` · ${barber.name}` : ''}
            </div>

            <div className={styles.dates} role="group" style={{ marginTop: 14 }}>
              {dates.map((d) => (
                <button key={d} className={styles.date} aria-pressed={date === d} disabled={!isOpenOn(d)} onClick={() => void pickDate(d)} aria-label={dayLabel(d)}>
                  <span className={styles.dow}>{frDate(d, { weekday: 'short' }).replace('.', '')}</span>
                  <span className={`${styles.dom} ${styles.display} ${styles.num}`}>{Number(d.slice(8))}</span>
                </button>
              ))}
            </div>

            {loading && (
              <p className={styles.muted} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
                <Loader2 size={16} className="animate-spin" /> {L.loadingSlots}
              </p>
            )}

            {!loading && next && !time && (
              <button className={styles.next} onClick={() => { setDate(next.date); setSlots(next.slots); setTime(next.time) }}>
                {L.nextAvailable} : <b>{dayLabel(next.date)} · {next.time}</b>
              </button>
            )}

            {!loading && slots.length === 0 && <p className={styles.muted} style={{ marginTop: 16 }}>{L.noSlots}</p>}

            {!loading && (['morning', 'afternoon', 'evening'] as const).map((part) =>
              parts[part].length ? (
                <div key={part}>
                  <h3 className={styles.h3}>{L[part]}</h3>
                  <div className={styles.slots}>
                    {parts[part].map((s) => (
                      <button key={s} className={`${styles.slot} ${styles.num}`} aria-pressed={time === s} onClick={() => setTime(s)}>{s}</button>
                    ))}
                  </div>
                </div>
              ) : null,
            )}

            <div className={styles.cta}>
              <div className={styles.ctaInner}>
                <button className={styles.btn} disabled={!time} onClick={() => { setError(null); setStep('contact') }}>{L.continue}</button>
              </div>
            </div>
          </>
        )}

        {/* ── Screen 3: details + confirm ────────────────────────────── */}
        {step === 'contact' && service && (
          <>
            <button className={styles.back} onClick={() => { setError(null); setStep('time') }}>
              <ArrowLeft size={16} /> {L.back}
            </button>
            <h2 className={`${styles.h2} ${styles.display}`} style={{ marginTop: 4 }}>{L.yourDetails}</h2>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="bb-name">{L.name}</label>
              <input id="bb-name" className={styles.input} type="text" autoComplete="given-name" placeholder={L.namePlaceholder}
                value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="bb-phone">{L.phone}</label>
              <input id="bb-phone" className={styles.input} type="tel" inputMode="tel" autoComplete="tel" placeholder={L.phonePlaceholder}
                value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />
              <div className={styles.hint}>{L.phoneHint}</div>
            </div>

            <h3 className={styles.h3}>{L.summary}</h3>
            <div className={styles.summary}>
              <div className={styles.row}><span>{L.barber}</span><span>{barber ? barber.name : L.anyBarber}</span></div>
              <div className={styles.row}><span>{L.service}</span><span>{service.name}</span></div>
              <div className={styles.row}><span>{L.when}</span><span className={styles.num}>{whenLabel}</span></div>
              <div className={styles.row}><span>{L.price}</span><span className={styles.num}>{price}</span></div>
            </div>
            <p className={styles.muted}>{L.payAtShop}</p>

            <div className={styles.cta}>
              <div className={styles.ctaInner}>
                <button className={styles.btn} disabled={saving} onClick={() => void submit()}>
                  {saving ? <><Loader2 size={18} className="animate-spin" /> {L.confirming}</> : L.confirm}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Confirmation ───────────────────────────────────────────── */}
        {step === 'done' && service && (
          <div className={styles.done}>
            <div className={styles.check}><Check size={36} strokeWidth={3} /></div>
            <h2 className={`${styles.h2} ${styles.display}`} style={{ marginTop: 0 }}>{L.doneTitle}</h2>
            <p className={styles.muted}>{L.doneSubtitle}</p>
            <div className={styles.summary} style={{ textAlign: 'left' }}>
              <div className={styles.row}><span>{L.barber}</span><span>{barber ? barber.name : L.anyBarber}</span></div>
              <div className={styles.row}><span>{L.service}</span><span>{service.name}</span></div>
              <div className={styles.row}><span>{L.when}</span><span className={styles.num}>{whenLabel}</span></div>
              <div className={styles.row}><span>{L.price}</span><span className={styles.num}>{price}</span></div>
            </div>
            <p className={styles.muted}>{L.payAtShop}</p>
            <div className={styles.actions}>
              <a className={styles.btn} target="_blank" rel="noopener noreferrer"
                href={buildGCalUrl({ businessName: business.name, serviceName: service.name, employeeName: barber?.name, date, time, durationMin: service.duration_min, timezone: business.timezone, address: business.address })}>
                <CalendarPlus size={18} /> {L.addToCalendar}
              </a>
              {business.address && (
                <a className={`${styles.btn} ${styles.btnGhost}`} target="_blank" rel="noopener noreferrer"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`}>
                  <MapPin size={18} /> {L.openMaps}
                </a>
              )}
              {phoneDigits && (
                <a className={`${styles.btn} ${styles.btnGhost}`} href={`tel:${phoneDigits}`}><Phone size={18} /> {L.callShop}</a>
              )}
              {canWhatsapp && (
                <a className={`${styles.btn} ${styles.btnGhost}`} target="_blank" rel="noopener noreferrer"
                  href={`https://wa.me/${phoneDigits.replace(/^\+|^00/, '')}`}>
                  <MessageCircle size={18} /> {L.whatsappShop}
                </a>
              )}
              <button className={styles.back} style={{ justifyContent: 'center' }} onClick={reset}>{L.bookAnother}</button>
            </div>
          </div>
        )}
      </main>

      <footer className={styles.footer}>{L.poweredBy} Pronto</footer>
    </div>
  )
}
