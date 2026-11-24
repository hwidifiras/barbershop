'use client'

// "Do I already have an appointment this week?" pieces of the public barbershop booking page
// (docs/barbershop-mode/SPEC.md 4.9): a hint shown as soon as the phone number is complete, and the
// "Possédez-vous déjà un rendez-vous ?" sheet. Both call /api/book/lookup and only ever receive the
// day/time and barber of the visitor's own upcoming appointments.

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ChevronDown, Loader2, X } from 'lucide-react'
import { lookupKey } from '@/lib/phone'
import { fr, fmt } from '@/lib/barbershop-fr'
import styles from './barber-booking.module.css'

const L = fr.booking

export interface FoundAppointment { startsAt: string; barber: string | null }
type Result = { key: string; appts: FoundAppointment[] | null; error: 'failed' | 'too_many' | null }

/** Looks up the visitor's appointments once the number is complete (debounced, one call per number). */
export function useAppointmentLookup(businessId: string, rawPhone: string) {
  const key = lookupKey(rawPhone)
  const [results, setResults] = useState<Record<string, Result>>({})
  const done = useRef(new Set<string>()) // numbers already answered (only read inside the effect)

  useEffect(() => {
    if (!key || done.current.has(key)) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      let r: Result
      try {
        const res = await fetch('/api/book/lookup', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ businessId, phone: rawPhone }), signal: ctrl.signal,
        })
        if (res.status === 429) r = { key, appts: null, error: 'too_many' }
        else if (!res.ok) r = { key, appts: null, error: 'failed' }
        else r = { key, appts: ((await res.json()).appointments ?? []) as FoundAppointment[], error: null }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        r = { key, appts: null, error: 'failed' }
      }
      if (!r.error) done.current.add(key) // errors can be retried by retyping
      setResults((prev) => ({ ...prev, [key]: r }))
    }, 500)
    return () => { clearTimeout(timer); ctrl.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, businessId])

  const current = key ? (results[key] ?? null) : null
  return { key, loading: !!key && !current, appts: current?.appts ?? null, error: current?.error ?? null }
}

function whenText(iso: string, timezone: string): string {
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone }).format(d)
  const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(d)
  return `${day} · ${time}`
}

function List({ appts, timezone }: { appts: FoundAppointment[]; timezone: string }) {
  return (
    <ul className={styles.apptList}>
      {appts.map((a) => (
        <li key={a.startsAt}>
          <span className={styles.num}>{whenText(a.startsAt, timezone)}</span>
          {a.barber && <span className={styles.apptBarber}> {fmt(L.withBarber, { name: a.barber })}</span>}
        </li>
      ))}
    </ul>
  )
}

/** Shown under the phone field while booking, with no button to press. */
export function ExistingAppointmentHint({ businessId, phone, timezone }: { businessId: string; phone: string; timezone: string }) {
  const { appts } = useAppointmentLookup(businessId, phone)
  const [open, setOpen] = useState(false)
  if (!appts || appts.length === 0) return null
  return (
    <div className={styles.notice}>
      <button type="button" className={styles.noticeBtn} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <AlertCircle size={18} />
        <span>{L.haveApptHint}<small>{L.haveApptHintTap}</small></span>
        <ChevronDown size={18} style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && <List appts={appts} timezone={timezone} />}
    </div>
  )
}

/** The "Possédez-vous déjà un rendez-vous ?" link and its sheet. */
export function ExistingAppointmentLookup({ businessId, timezone }: { businessId: string; timezone: string }) {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  return (
    <>
      <div className={styles.lookupRow}>
        <button type="button" className={styles.lookupLink} onClick={() => setOpen(true)}>{L.lookupLink}</button>
      </div>
      {open && <LookupSheet businessId={businessId} timezone={timezone} phone={phone} setPhone={setPhone} onClose={() => setOpen(false)} />}
    </>
  )
}

function LookupSheet({ businessId, timezone, phone, setPhone, onClose }: {
  businessId: string; timezone: string; phone: string; setPhone: (v: string) => void; onClose: () => void
}) {
  const { key, loading, appts, error } = useAppointmentLookup(businessId, phone)
  return (
    <div className={styles.sheetBackdrop} onClick={onClose}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={L.lookupTitle} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHead}>
          <h2 className={`${styles.h2} ${styles.display}`} style={{ margin: 0 }}>{L.lookupTitle}</h2>
          <button type="button" className={styles.sheetClose} onClick={onClose} aria-label={L.lookupClose}><X size={22} /></button>
        </div>
        <p className={styles.muted}>{L.lookupIntro}</p>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="bb-lookup-phone">{fr.booking.phone}</label>
          <input id="bb-lookup-phone" className={styles.input} type="tel" inputMode="tel" autoComplete="tel" autoFocus
            placeholder={L.phonePlaceholder} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        {key && loading && <p className={styles.muted}><Loader2 size={16} className="animate-spin" style={{ verticalAlign: 'middle' }} /> …</p>}
        {error && <div className={styles.error} role="alert">{error === 'too_many' ? L.lookupTooMany : L.lookupError}</div>}
        {appts && appts.length === 0 && <p className={styles.muted}>{L.lookupNone}</p>}
        {appts && appts.length > 0 && (
          <>
            <h3 className={styles.h3} style={{ marginTop: 8 }}>{L.lookupFound}</h3>
            <List appts={appts} timezone={timezone} />
          </>
        )}
      </div>
    </div>
  )
}
