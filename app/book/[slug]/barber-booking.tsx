'use client'

// Public booking page for barbershop mode (docs/barbershop-mode/SPEC.md sections 4.9 and 4.12).
// Reuses the existing booking backend: get_booked_slots RPC for availability and POST /api/book for
// the atomic reservation. Price, duration and rules are re-computed by the server; the totals shown
// here are display only (lib/barbershop-cart.ts is shared by both).

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, CalendarPlus, Check, Loader2, MapPin, MessageCircle, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { buildGCalUrl } from '@/lib/gcal'
import { computeEffectiveHours, type DayHours } from '@/lib/booking-availability'
import {
  computeBarberSlots, groupByDayPart, minutesInTimezone, unionSlots, type BookedRange,
} from '@/lib/barbershop-slots'
import {
  addOnServices, isOfferValidOn, offerBarberIds, pickBarberFor, previewSelection, startingServices,
  type CartOffer, type CartService,
} from '@/lib/barbershop-cart'
import { fr, fmt } from '@/lib/barbershop-fr'
import { bricolage, dmSans } from '@/lib/landing-fonts'
import styles from './barber-booking.module.css'

type Service = CartService & { description: string | null; category: string | null }
interface Barber { id: string; name: string; avatar_url: string | null }
interface Business {
  id: string; name: string; currency: string; slug: string; timezone: string | null
  address: string | null; phone: string | null; logo_url: string | null
}

interface Props {
  business: Business
  services: Service[]
  offers: CartOffer[]
  barbers: Barber[]
  workingHours: DayHours[]
  accent: string
  initialBarberId?: string | null
  initialServiceId?: string | null
}

type Step = 'pick' | 'extras' | 'time' | 'contact' | 'done'
type PerBarber = Record<string, string[]>
const DAYS_AHEAD = 14
const CONTACT_KEY = 'barbershop_contact_v1'
const L = fr.booking

// ── date helpers (all in the business timezone) ─────────────────────────────

function todayIn(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
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

export function BarberBooking({ business, services, offers, barbers, workingHours, accent, initialBarberId, initialServiceId }: Props) {
  const supabase = createClient()
  const tz = business.timezone ?? 'UTC'
  const hours = computeEffectiveHours(workingHours)
  const today = todayIn(tz)
  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i))
  const isOpenOn = (ymd: string) => hours.find((h) => h.day_of_week === dowOf(ymd))?.is_open ?? false
  const money = (n: number) => formatCurrency(n, business.currency, 'fr-FR')

  const allBarberIds = barbers.map((b) => b.id)
  const svcMap = new Map(services.map((s) => [s.id, s]))
  const addOns = addOnServices(services) as Service[]

  const validBarber = barbers.some((b) => b.id === initialBarberId) ? (initialBarberId as string) : ''
  const [barberId, setBarberId] = useState<string>(validBarber)
  const [service, setService] = useState<Service | null>(null)
  const [extras, setExtras] = useState<string[]>([])
  const [offer, setOffer] = useState<CartOffer | null>(null)
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
  const perBarberByDate = useRef<Record<string, PerBarber>>({})

  const barber = barbers.find((b) => b.id === barberId) ?? null
  const selection = previewSelection({
    service, offer, services,
    extras: extras.map((id) => svcMap.get(id)).filter((s): s is Service => !!s),
  })
  const hasExtrasStep = !!service && service.kind === 'main' && !offer && addOns.length > 0

  // Barbers who may take the current choice ("first available" is limited for restricted offers).
  const candidatesFor = useCallback((bId: string, o: CartOffer | null): (string | null)[] => {
    if (bId) return [bId]
    if (barbers.length === 0) return [null]
    return o ? offerBarberIds(o, allBarberIds) : allBarberIds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barbers])

  const slotsFor = useCallback(async (ymd: string, durationMin: number, ids: (string | null)[]): Promise<{ slots: string[]; perBarber: PerBarber }> => {
    const dayHours = hours.find((h) => h.day_of_week === dowOf(ymd))
    if (!dayHours?.is_open) return { slots: [], perBarber: {} }
    const perBarber: PerBarber = {}
    const lists = await Promise.all(ids.map(async (id) => {
      let booked: BookedRange[] = []
      try {
        const { data } = await supabase.rpc('get_booked_slots', { p_business_id: business.id, p_date: ymd, p_employee_id: id })
        booked = (data ?? []) as BookedRange[]
      } catch { /* treat as free; the server re-checks atomically on submit */ }
      const list = computeBarberSlots({
        dayHours, durationMin, booked, timezone: tz,
        nowMinutes: ymd === today ? minutesInTimezone(new Date().toISOString(), tz) : undefined,
      })
      if (id) perBarber[id] = list
      return list
    }))
    return { slots: unionSlots(lists), perBarber }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id, tz, today, workingHours])

  // Entering the time step: jump to the first date that has a free slot (saves taps).
  const beginTime = useCallback(async (durationMin: number, bId: string, o: CartOffer | null) => {
    const my = ++req.current
    setStep('time'); setError(null); setTime(''); setSlots([]); setNext(null); setLoading(true)
    const ids = candidatesFor(bId, o)
    const usable = (d: string) => isOpenOn(d) && (!o || isOfferValidOn(o, d))
    let found: { date: string; slots: string[] } | null = null
    for (const d of dates) {
      if (!usable(d)) continue
      const r = await slotsFor(d, durationMin, ids)
      if (my !== req.current) return
      perBarberByDate.current[d] = r.perBarber
      if (r.slots.length) { found = { date: d, slots: r.slots }; break }
    }
    if (my !== req.current) return
    if (found) {
      setDate(found.date); setSlots(found.slots)
      setNext({ date: found.date, time: found.slots[0], slots: found.slots })
    } else {
      setDate(dates.find(usable) ?? dates[0]); setSlots([])
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsFor, candidatesFor])

  async function pickDate(d: string) {
    const my = ++req.current
    setDate(d); setTime(''); setSlots([]); setLoading(true); setError(null)
    const r = await slotsFor(d, selection.totalDuration, candidatesFor(barberId, offer))
    if (my !== req.current) return
    perBarberByDate.current[d] = r.perBarber
    setSlots(r.slots); setLoading(false)
  }

  function chooseService(s: Service, bId = barberId) {
    setOffer(null); setService(s); setExtras([]); setError(null)
    if (s.kind === 'main' && addOns.length > 0) setStep('extras')
    else void beginTime(s.duration_min, bId, null)
  }

  function chooseOffer(o: CartOffer) {
    const first = svcMap.get(o.service_ids[0]) ?? null
    const duration = o.service_ids.reduce((t, id) => t + (svcMap.get(id)?.duration_min ?? 0), 0)
    setOffer(o); setService(first); setExtras([]); setError(null)
    void beginTime(duration, barberId, o)
  }

  function toggleExtra(id: string) {
    setExtras((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))
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
    const svc = startingServices(services).find((s) => s.id === initialServiceId) as Service | undefined
    if (svc) chooseService(svc, validBarber)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { window.scrollTo({ top: 0 }) }, [step])

  async function submit() {
    if (!service || !date || !time) return
    const name = contact.name.trim()
    const phone = contact.phone.trim()
    if (!name) { setError(L.errorName); return }
    if (!/^[\d\s+\-().]{7,}$/.test(phone)) { setError(L.errorPhone); return }

    // "First available" with an offer limited to some barbers: name the barber ourselves so the
    // booking cannot land on someone the offer does not cover.
    let employeeId: string | null = barberId || null
    const restricted = !!offer && !!offer.barber_ids && offer.barber_ids.length > 0
    if (!employeeId && restricted) {
      employeeId = pickBarberFor(time, perBarberByDate.current[date] ?? {}, offerBarberIds(offer!, allBarberIds))
      if (!employeeId) { setError(L.errorSlotTaken); setStep('time'); setTime(''); void pickDate(date); return }
    }

    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id, serviceId: service.id, employeeId,
          extraServiceIds: offer ? [] : extras, offerId: offer?.id ?? null,
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
      if (res.status === 422 || res.status === 404) {
        const body = await res.json().catch(() => null)
        setSaving(false)
        const code = body?.error as string | undefined
        setError(
          code === 'offer_not_valid_on_date' ? L.errorOfferInvalidDate
            : code === 'offer_unavailable' || code === 'offer_barber_not_allowed' ? L.errorOfferUnavailable
              : L.errorServiceUnavailable,
        )
        if (code === 'offer_not_valid_on_date') { setStep('time'); setTime('') } else { reset(); }
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
    setService(null); setExtras([]); setOffer(null); setStep('pick'); setDate(''); setTime(''); setSlots([]); setNext(null)
  }

  // ── derived view data ─────────────────────────────────────────────────────

  const visibleOffers = offers.filter((o) =>
    o.service_ids.length > 0 && o.service_ids.every((id) => svcMap.has(id)) &&
    dates.some((d) => isOpenOn(d) && isOfferValidOn(o, d)) &&
    (barberId ? offerBarberIds(o, allBarberIds).includes(barberId) : barbers.length === 0 || offerBarberIds(o, allBarberIds).length > 0),
  )
  const groups: { title: string | null; items: Service[] }[] = []
  for (const s of startingServices(services) as Service[]) {
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
  const phoneDigits = (business.phone ?? '').replace(/[^\d+]/g, '')
  const canWhatsapp = /^(\+|00)\d{8,}$/.test(phoneDigits)
  const hasDiscount = selection.listTotal > selection.totalPrice

  const priceView = (
    <span className={styles.rowPrice}>
      {hasDiscount && <span className={`${styles.strike} ${styles.num}`}>{money(selection.listTotal)}</span>}
      <span className={styles.num}>{money(selection.totalPrice)}</span>
    </span>
  )
  const periodText = (o: CartOffer) =>
    o.valid_to ? fmt(L.offerUntil, { date: frDate(o.valid_to, { day: 'numeric', month: 'long' }) })
      : o.valid_from && o.valid_from > today ? fmt(L.offerFrom, { date: frDate(o.valid_from, { day: 'numeric', month: 'long' }) }) : ''

  const summaryRows = (
    <div className={styles.summary}>
      <div className={styles.row}><span>{L.barber}</span><span>{barber ? barber.name : L.anyBarber}</span></div>
      <div className={styles.row}>
        <span>{offer ? L.offerBadge : L.servicesLabel}</span>
        <span>{offer ? offer.name : selection.lines.map((l) => l.name).join(' + ')}</span>
      </div>
      {offer && <div className={styles.row}><span>{L.servicesLabel}</span><span>{selection.lines.map((l) => l.name).join(' + ')}</span></div>}
      <div className={styles.row}><span>{L.when}</span><span className={styles.num}>{whenLabel}</span></div>
      <div className={styles.row}><span>{L.price}</span>{priceView}</div>
    </div>
  )

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

        {/* ── Screen 1: barber + offers + service ────────────────────── */}
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

            {visibleOffers.length > 0 && (
              <>
                <h2 className={`${styles.h2} ${styles.display}`}>{L.offersTitle}</h2>
                {visibleOffers.map((o) => {
                  const included = o.service_ids.map((id) => svcMap.get(id)).filter((s): s is Service => !!s)
                  const list = included.reduce((t, s) => t + Number(s.price), 0)
                  return (
                    <button key={o.id} className={styles.offer} onClick={() => chooseOffer(o)}>
                      <span className={styles.offerTop}>
                        <span className={`${styles.offerName} ${styles.display}`}>{o.name}</span>
                        <span className={styles.pill}>{L.offerBadge}</span>
                      </span>
                      <span className={styles.offerIncludes}>
                        {included.map((s) => s.name).join(' + ')} · {fmt(L.minutes, { n: included.reduce((t, s) => t + s.duration_min, 0) })}
                      </span>
                      <span className={styles.offerPrices}>
                        {list > o.price && <span className={`${styles.strike} ${styles.num}`}>{money(list)}</span>}
                        <span className={`${styles.offerPrice} ${styles.num}`}>{money(o.price)}</span>
                      </span>
                      {periodText(o) && <span className={styles.offerUntil}>{periodText(o)}</span>}
                    </button>
                  )
                })}
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
                    <span className={`${styles.price} ${styles.num}`}>{money(Number(s.price))}</span>
                  </button>
                ))}
              </div>
            ))}
          </>
        )}

        {/* ── Optional supplements ───────────────────────────────────── */}
        {step === 'extras' && service && (
          <>
            <button className={styles.back} onClick={() => { setError(null); setStep('pick') }}>
              <ArrowLeft size={16} /> {L.back}
            </button>
            <h2 className={`${styles.h2} ${styles.display}`} style={{ marginTop: 4 }}>{L.addOnTitle}</h2>
            <p className={styles.muted} style={{ marginTop: 0 }}>{L.addOnHint}</p>
            <div style={{ marginTop: 14 }}>
              {addOns.map((a) => {
                const on = extras.includes(a.id)
                return (
                  <button key={a.id} className={styles.addon} aria-pressed={on} onClick={() => toggleExtra(a.id)}>
                    <span className={styles.box}>{on && <Check size={16} strokeWidth={3} />}</span>
                    <span className={styles.addonBody}>
                      <div className={styles.serviceName}>{a.name}</div>
                      <div className={`${styles.serviceMeta} ${styles.num}`}>{fmt(L.plusMinutes, { n: a.duration_min })}{a.description ? ` · ${a.description}` : ''}</div>
                    </span>
                    <span className={`${styles.price} ${styles.num}`}>+{money(Number(a.price))}</span>
                  </button>
                )
              })}
            </div>
            <div className={styles.totalLine}>
              <span className={styles.muted}>{service.name}{extras.length ? ` + ${extras.length}` : ''} · {fmt(L.minutes, { n: selection.totalDuration })}</span>
              <b className={styles.num}>{money(selection.totalPrice)}</b>
            </div>
            <div className={styles.cta}>
              <div className={styles.ctaInner}>
                <button className={styles.btn} onClick={() => void beginTime(selection.totalDuration, barberId, null)}>
                  {extras.length ? fmt(L.addOnContinue, { price: money(selection.totalPrice - Number(service.price)) }) : L.addOnSkip}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Screen 2: date + time ──────────────────────────────────── */}
        {step === 'time' && service && (
          <>
            <button className={styles.back} onClick={() => { ++req.current; setStep(hasExtrasStep ? 'extras' : 'pick'); setError(null) }}>
              <ArrowLeft size={16} /> {L.back}
            </button>
            <h2 className={`${styles.h2} ${styles.display}`} style={{ marginTop: 4 }}>{L.chooseTime}</h2>
            <div className={styles.muted}>
              {offer ? offer.name : selection.summary} · {fmt(L.minutes, { n: selection.totalDuration })}{barber ? ` · ${barber.name}` : ''}
            </div>

            <div className={styles.dates} role="group" style={{ marginTop: 14 }}>
              {dates.map((d) => {
                const usable = isOpenOn(d) && (!offer || isOfferValidOn(offer, d))
                return (
                  <button key={d} className={styles.date} aria-pressed={date === d} disabled={!usable} onClick={() => void pickDate(d)} aria-label={dayLabel(d)}>
                    <span className={styles.dow}>{frDate(d, { weekday: 'short' }).replace('.', '')}</span>
                    <span className={`${styles.dom} ${styles.display} ${styles.num}`}>{Number(d.slice(8))}</span>
                  </button>
                )
              })}
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
            {summaryRows}
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
            <div style={{ textAlign: 'left' }}>{summaryRows}</div>
            <p className={styles.muted}>{L.payAtShop}</p>
            <div className={styles.actions}>
              <a className={styles.btn} target="_blank" rel="noopener noreferrer"
                href={buildGCalUrl({ businessName: business.name, serviceName: selection.summary, employeeName: barber?.name, date, time, durationMin: selection.totalDuration, timezone: business.timezone, address: business.address })}>
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
