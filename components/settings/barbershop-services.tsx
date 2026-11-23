'use client'

// Settings → Services for barbershop mode (docs/barbershop-mode/SPEC.md 4.12): main services and
// supplements, an "online" switch per service, and offers (forfaits). French only.
// The standard Services tab is untouched; settings-tabs.tsx renders this one in barbershop mode.

import { useState } from 'react'
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { fr, fmt } from '@/lib/barbershop-fr'

const S = fr.services
const O = fr.offers

export interface ServiceRow {
  id: string; name: string; description: string | null; price: number; duration_min: number
  category: string | null; is_active: boolean; capacity: number
  kind: string; bookable_alone: boolean; bookable_online: boolean
}
export interface OfferRow {
  id: string; name: string; price: number; service_ids: string[]; barber_ids: string[] | null
  valid_from: string | null; valid_to: string | null; is_active: boolean
}
interface Props {
  businessId: string
  currency: string
  services: ServiceRow[]
  offers: OfferRow[]
  barbers: { id: string; name: string }[]
}

const num = (v: string) => Number(v.replace(',', '.').trim())

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
      {children}
    </button>
  )
}

const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'
const label = 'text-xs font-medium text-gray-500'

export function BarbershopServices({ businessId, currency, services: initServices, offers: initOffers, barbers }: Props) {
  const supabase = createClient()
  const money = (n: number) => formatCurrency(n, currency, 'fr-FR')
  const [services, setServices] = useState(initServices)
  const [offers, setOffers] = useState(initOffers)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const nameOf = (id: string) => services.find((s) => s.id === id)?.name ?? '—'

  // ── services ──────────────────────────────────────────────────────────
  const emptySvc = { id: '', name: '', description: '', price: '', duration: '30', category: '', kind: 'main', alone: false }
  const [svcForm, setSvcForm] = useState<typeof emptySvc | null>(null)
  const [confirmDelSvc, setConfirmDelSvc] = useState<string | null>(null)
  const categories = Array.from(new Set(services.map((s) => s.category?.trim()).filter(Boolean))) as string[]

  async function saveService() {
    if (!svcForm) return
    const name = svcForm.name.trim()
    const price = num(svcForm.price || '0')
    const duration = Math.round(num(svcForm.duration || '0'))
    if (!name) return setMsg(fr.offers.errorName)
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(duration) || duration < 1) return setMsg(O.errorPrice)
    setBusy('svc'); setMsg(null)
    const row = {
      name, description: svcForm.description.trim() || null, price, duration_min: duration,
      category: svcForm.category.trim() || null, kind: svcForm.kind,
      bookable_alone: svcForm.kind === 'supplement' ? svcForm.alone : false,
    }
    if (svcForm.id) {
      const { data, error } = await supabase.from('services').update(row).eq('id', svcForm.id).select().single()
      if (error || !data) setMsg(S.saveError)
      else { setServices((l) => l.map((x) => (x.id === data.id ? { ...x, ...data, price: Number(data.price) } : x))); setSvcForm(null) }
    } else {
      const { data, error } = await supabase.from('services').insert({ ...row, business_id: businessId }).select().single()
      if (error || !data) setMsg(S.saveError)
      else { setServices((l) => [...l, { ...data, price: Number(data.price) }]); setSvcForm(null) }
    }
    setBusy(null)
  }

  async function setOnline(id: string, value: boolean) {
    setBusy(`on-${id}`); setMsg(null)
    const { error } = await supabase.from('services').update({ bookable_online: value }).eq('id', id)
    if (error) setMsg(S.saveError)
    else setServices((l) => l.map((x) => (x.id === id ? { ...x, bookable_online: value } : x)))
    setBusy(null)
  }

  async function removeService(id: string) {
    setBusy(`del-${id}`); setMsg(null)
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) setMsg(S.saveError)
    else { setServices((l) => l.filter((x) => x.id !== id)); setConfirmDelSvc(null) }
    setBusy(null)
  }

  // ── offers ────────────────────────────────────────────────────────────
  const emptyOffer = { id: '', name: '', price: '', serviceIds: [] as string[], from: '', to: '', barberIds: [] as string[] }
  const [offerForm, setOfferForm] = useState<typeof emptyOffer | null>(null)
  const [confirmDelOffer, setConfirmDelOffer] = useState<string | null>(null)
  const listTotal = (ids: string[]) => ids.reduce((t, id) => t + Number(services.find((s) => s.id === id)?.price ?? 0), 0)

  function openOffer(o?: OfferRow) {
    setMsg(null)
    setOfferForm(o
      ? { id: o.id, name: o.name, price: String(o.price), serviceIds: o.service_ids, from: o.valid_from ?? '', to: o.valid_to ?? '', barberIds: o.barber_ids ?? [] }
      : { ...emptyOffer })
  }

  function toggleOfferBarber(id: string) {
    setOfferForm((f) => {
      if (!f) return f
      const next = f.barberIds.includes(id) ? f.barberIds.filter((x) => x !== id) : [...f.barberIds, id]
      // every barber ticked = "Tous les barbiers" (stored as null)
      return { ...f, barberIds: next.length === barbers.length ? [] : next }
    })
  }

  async function saveOffer() {
    if (!offerForm) return
    const name = offerForm.name.trim()
    const price = num(offerForm.price || '')
    if (!name) return setMsg(O.errorName)
    if (offerForm.serviceIds.length === 0) return setMsg(O.errorServices)
    if (!Number.isFinite(price) || price < 0 || offerForm.price.trim() === '') return setMsg(O.errorPrice)
    if (offerForm.from && offerForm.to && offerForm.to < offerForm.from) return setMsg(O.errorDates)
    setBusy('offer'); setMsg(null)
    const row = {
      name, price, service_ids: offerForm.serviceIds,
      barber_ids: offerForm.barberIds.length ? offerForm.barberIds : null,
      valid_from: offerForm.from || null, valid_to: offerForm.to || null,
    }
    if (offerForm.id) {
      const { data, error } = await supabase.from('offers').update(row).eq('id', offerForm.id).select().single()
      if (error || !data) setMsg(S.saveError)
      else { setOffers((l) => l.map((x) => (x.id === data.id ? { ...data, price: Number(data.price) } : x))); setOfferForm(null) }
    } else {
      const { data, error } = await supabase.from('offers').insert({ ...row, business_id: businessId }).select().single()
      if (error || !data) setMsg(S.saveError)
      else { setOffers((l) => [...l, { ...data, price: Number(data.price) }]); setOfferForm(null) }
    }
    setBusy(null)
  }

  async function setOfferActive(id: string, value: boolean) {
    setBusy(`oa-${id}`); setMsg(null)
    const { error } = await supabase.from('offers').update({ is_active: value }).eq('id', id)
    if (error) setMsg(S.saveError)
    else setOffers((l) => l.map((x) => (x.id === id ? { ...x, is_active: value } : x)))
    setBusy(null)
  }

  async function removeOffer(id: string) {
    setBusy(`od-${id}`); setMsg(null)
    const { error } = await supabase.from('offers').delete().eq('id', id)
    if (error) setMsg(S.saveError)
    else { setOffers((l) => l.filter((x) => x.id !== id)); setConfirmDelOffer(null) }
    setBusy(null)
  }

  const period = (o: OfferRow) =>
    o.valid_from && o.valid_to ? fmt(O.between, { from: o.valid_from, to: o.valid_to })
      : o.valid_to ? fmt(O.until, { date: o.valid_to }) : o.valid_from ? fmt(O.since, { date: o.valid_from }) : O.always

  return (
    <div className="space-y-6">
      {msg && <p role="alert" className="text-sm rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2">{msg}</p>}

      {/* ── Services ─────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">{S.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{S.hint}</p>
          </div>
          {!svcForm && (
            <button type="button" onClick={() => { setMsg(null); setSvcForm({ ...emptySvc }) }}
              className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">
              <Plus className="w-4 h-4" /> {S.add}
            </button>
          )}
        </div>

        {svcForm && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className={label}>{S.name}</label><input className={input} value={svcForm.name} onChange={(e) => setSvcForm({ ...svcForm, name: e.target.value })} /></div>
              <div>
                <label className={label}>{S.category}</label>
                <input className={input} list="bb-cats" placeholder={S.categoryHint} value={svcForm.category} onChange={(e) => setSvcForm({ ...svcForm, category: e.target.value })} />
                <datalist id="bb-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div><label className={label}>{S.price}</label><input className={input} inputMode="decimal" value={svcForm.price} onChange={(e) => setSvcForm({ ...svcForm, price: e.target.value })} /></div>
              <div><label className={label}>{S.duration}</label><input className={input} inputMode="numeric" value={svcForm.duration} onChange={(e) => setSvcForm({ ...svcForm, duration: e.target.value })} /></div>
            </div>
            <div><label className={label}>{S.description}</label><input className={input} value={svcForm.description} onChange={(e) => setSvcForm({ ...svcForm, description: e.target.value })} /></div>
            <div>
              <label className={label}>{S.kind}</label>
              <div className="mt-1 flex gap-2">
                <Chip on={svcForm.kind === 'main'} onClick={() => setSvcForm({ ...svcForm, kind: 'main' })}>{S.kindMain}</Chip>
                <Chip on={svcForm.kind === 'supplement'} onClick={() => setSvcForm({ ...svcForm, kind: 'supplement' })}>{S.kindSupplement}</Chip>
              </div>
            </div>
            {svcForm.kind === 'supplement' && (
              <div className="flex items-start justify-between gap-4 rounded-lg bg-white border border-gray-200 p-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{S.aloneLabel}</div>
                  <p className="text-xs text-gray-500 mt-0.5">{svcForm.alone ? S.aloneHintOn : S.aloneHintOff}</p>
                </div>
                <Toggle checked={svcForm.alone} label={S.aloneLabel} onChange={(v) => setSvcForm({ ...svcForm, alone: v })} />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button type="button" disabled={busy === 'svc'} onClick={() => void saveService()}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60">
                {busy === 'svc' && <Loader2 className="w-4 h-4 animate-spin" />} {busy === 'svc' ? S.saving : S.save}
              </button>
              <button type="button" onClick={() => setSvcForm(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{S.cancel}</button>
            </div>
          </div>
        )}

        {services.length === 0 && !svcForm && <p className="text-sm text-gray-500 mt-4">{S.empty}</p>}

        <ul className="mt-4 divide-y divide-gray-100">
          {services.map((s) => (
            <li key={s.id} className="py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{s.name}</span>
                  {s.kind === 'supplement' && <span className="text-[11px] font-semibold rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">{S.badgeSupplement}</span>}
                  {s.kind === 'supplement' && s.bookable_alone && <span className="text-[11px] font-semibold rounded-full bg-gray-100 text-gray-700 px-2 py-0.5">{S.badgeAlone}</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {fmt(S.minutes, { n: s.duration_min })} · {money(Number(s.price))}{s.category ? ` · ${s.category}` : ''}
                </div>
                {!s.bookable_online && <div className="text-xs text-gray-400 mt-0.5">{S.onlineOff}</div>}
              </div>
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <Toggle checked={s.bookable_online} label={`${S.online} — ${s.name}`} disabled={busy === `on-${s.id}`} onChange={(v) => void setOnline(s.id, v)} />
                <span className="text-[10px] text-gray-500">{S.online}</span>
              </div>
              {confirmDelSvc === s.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" disabled={busy === `del-${s.id}`} onClick={() => void removeService(s.id)} className="text-xs font-medium text-red-600 hover:underline">{S.yes}</button>
                  <button type="button" onClick={() => setConfirmDelSvc(null)} className="text-xs text-gray-500 hover:underline">{S.cancel}</button>
                </div>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" aria-label={`${S.edit} ${s.name}`} onClick={() => { setMsg(null); setSvcForm({ id: s.id, name: s.name, description: s.description ?? '', price: String(s.price), duration: String(s.duration_min), category: s.category ?? '', kind: s.kind, alone: s.bookable_alone }) }} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><Pencil className="w-4 h-4" /></button>
                  <button type="button" aria-label={`${S.remove} ${s.name}`} onClick={() => setConfirmDelSvc(s.id)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-400 mt-2">{S.onlineHint}</p>
      </section>

      {/* ── Offers ───────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">{O.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{O.hint}</p>
          </div>
          {!offerForm && (
            <button type="button" onClick={() => openOffer()} className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">
              <Plus className="w-4 h-4" /> {O.add}
            </button>
          )}
        </div>

        {offerForm && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
            <div><label className={label}>{O.name}</label><input className={input} placeholder={O.namePlaceholder} value={offerForm.name} onChange={(e) => setOfferForm({ ...offerForm, name: e.target.value })} /></div>

            <div>
              <label className={label}>{O.services}</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {services.map((s) => (
                  <Chip key={s.id} on={offerForm.serviceIds.includes(s.id)}
                    onClick={() => setOfferForm({ ...offerForm, serviceIds: offerForm.serviceIds.includes(s.id) ? offerForm.serviceIds.filter((x) => x !== s.id) : [...offerForm.serviceIds, s.id] })}>
                    {s.name}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <label className={label}>{O.price}</label>
              <div className="flex items-center gap-3">
                <input className={`${input} max-w-[10rem]`} inputMode="decimal" value={offerForm.price} onChange={(e) => setOfferForm({ ...offerForm, price: e.target.value })} />
                {offerForm.serviceIds.length > 0 && <span className="text-sm text-gray-500">{fmt(O.instead, { price: money(listTotal(offerForm.serviceIds)) })}</span>}
              </div>
            </div>

            <div>
              <label className={label}>{O.period}</label>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <div><span className="text-[11px] text-gray-500">{O.from}</span><input type="date" className={input} value={offerForm.from} onChange={(e) => setOfferForm({ ...offerForm, from: e.target.value })} /></div>
                <div><span className="text-[11px] text-gray-500">{O.to}</span><input type="date" className={input} value={offerForm.to} onChange={(e) => setOfferForm({ ...offerForm, to: e.target.value })} /></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">{O.periodHint}</p>
            </div>

            {barbers.length > 1 && (
              <div>
                <label className={label}>{O.barbers}</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Chip on={offerForm.barberIds.length === 0} onClick={() => setOfferForm({ ...offerForm, barberIds: [] })}>{O.allBarbers}</Chip>
                  {barbers.map((b) => <Chip key={b.id} on={offerForm.barberIds.includes(b.id)} onClick={() => toggleOfferBarber(b.id)}>{b.name}</Chip>)}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" disabled={busy === 'offer'} onClick={() => void saveOffer()}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60">
                {busy === 'offer' && <Loader2 className="w-4 h-4 animate-spin" />} {busy === 'offer' ? S.saving : S.save}
              </button>
              <button type="button" onClick={() => setOfferForm(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{S.cancel}</button>
            </div>
          </div>
        )}

        {offers.length === 0 && !offerForm && <p className="text-sm text-gray-500 mt-4">{O.empty}</p>}

        <ul className="mt-4 divide-y divide-gray-100">
          {offers.map((o) => {
            const list = listTotal(o.service_ids)
            const who = o.barber_ids && o.barber_ids.length ? o.barber_ids.map((id) => barbers.find((b) => b.id === id)?.name ?? '—').join(', ') : O.allBarbers
            return (
              <li key={o.id} className="py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">{o.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{o.service_ids.map(nameOf).join(' + ')}</div>
                  <div className="text-xs mt-0.5">
                    {list > o.price && <span className="text-gray-400 line-through mr-2">{money(list)}</span>}
                    <span className="font-semibold text-gray-900">{money(Number(o.price))}</span>
                    <span className="text-gray-500"> · {period(o)} · {who}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <Toggle checked={o.is_active} label={`${O.active} — ${o.name}`} disabled={busy === `oa-${o.id}`} onChange={(v) => void setOfferActive(o.id, v)} />
                  <span className="text-[10px] text-gray-500">{o.is_active ? O.active : O.inactive}</span>
                </div>
                {confirmDelOffer === o.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" disabled={busy === `od-${o.id}`} onClick={() => void removeOffer(o.id)} className="text-xs font-medium text-red-600 hover:underline">{S.yes}</button>
                    <button type="button" onClick={() => setConfirmDelOffer(null)} className="text-xs text-gray-500 hover:underline">{S.cancel}</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" aria-label={`${S.edit} ${o.name}`} onClick={() => openOffer(o)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><Pencil className="w-4 h-4" /></button>
                    <button type="button" aria-label={`${S.remove} ${o.name}`} onClick={() => setConfirmDelOffer(o.id)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
