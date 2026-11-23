'use client'

// Settings → shop card for barbershop mode (docs/barbershop-mode/SPEC.md 4.7, 4.10).
// Booking link + QR code, per-barber links and photos, online-booking switch, and the
// "Barbershop mode" escape-hatch switch. French only, like the rest of the mode.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { Check, Copy, Download, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fr } from '@/lib/barbershop-fr'

const S = fr.settings

export interface CardBarber { id: string; name: string; avatar_url: string | null }
interface Props {
  business: { id: string; slug: string; online_booking_enabled: boolean }
  barbers: CardBarber[]
  modeOn: boolean
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) } catch { /* clipboard blocked */ }
      }}
      className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      {done ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {done ? S.copied : S.copy}
    </button>
  )
}

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export function BarbershopShopCard({ business, barbers: initialBarbers, modeOn }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [origin, setOrigin] = useState('')
  const [qr, setQr] = useState('')
  const [online, setOnline] = useState(business.online_booking_enabled)
  const [mode, setMode] = useState(modeOn)
  const [barbers, setBarbers] = useState(initialBarbers)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => { setOrigin(window.location.origin) }, [])
  const link = origin ? `${origin}/book/${business.slug}` : ''

  useEffect(() => {
    if (!link) return
    QRCode.toDataURL(link, { margin: 2, width: 640, color: { dark: '#111111', light: '#ffffff' } }).then(setQr).catch(() => setQr(''))
  }, [link])

  async function save(patch: { online_booking_enabled?: boolean; barbershop_mode?: boolean }, key: string) {
    setBusy(key); setMsg(null)
    const { error } = await supabase.from('businesses').update(patch).eq('id', business.id)
    setBusy(null)
    if (error) { setMsg({ kind: 'err', text: S.saveError }); return false }
    setMsg({ kind: 'ok', text: S.saved })
    return true
  }

  async function uploadPhoto(id: string, file: File) {
    setBusy(`photo-${id}`); setMsg(null)
    try {
      const form = new FormData()
      form.append('photo', file)
      const res = await fetch(`/api/employees/${id}/avatar`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'error')
      setBarbers((bs) => bs.map((b) => (b.id === id ? { ...b, avatar_url: data.avatar_url } : b)))
    } catch { setMsg({ kind: 'err', text: S.photoError }) }
    setBusy(null)
  }

  async function removePhoto(id: string) {
    setBusy(`photo-${id}`); setMsg(null)
    try {
      const res = await fetch(`/api/employees/${id}/avatar`, { method: 'DELETE' })
      if (!res.ok) throw new Error('error')
      setBarbers((bs) => bs.map((b) => (b.id === id ? { ...b, avatar_url: null } : b)))
    } catch { setMsg({ kind: 'err', text: S.photoError }) }
    setBusy(null)
  }

  const modeRow = (
    <div className="flex items-start justify-between gap-4 pt-4 mt-4 border-t border-gray-100">
      <div>
        <div className="text-sm font-medium text-gray-900">{S.mode}</div>
        <p className="text-xs text-gray-500 mt-0.5">{S.modeHint}</p>
      </div>
      <Toggle checked={mode} label={S.mode} disabled={busy === 'mode'} onChange={async (v) => {
        if (await save({ barbershop_mode: v }, 'mode')) { setMode(v); router.refresh() }
      }} />
    </div>
  )

  // Escape hatch: when the mode is off, only the switch to turn it back on is shown.
  if (!mode) {
    return <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">{modeRow}{msg && <p className="text-xs mt-2 text-gray-500">{msg.text}</p>}</section>
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <h2 className="font-semibold text-gray-900">{S.cardTitle}</h2>
      <p className="text-sm text-gray-500 mt-1">{S.cardHint}</p>

      <div className="mt-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <label className="text-xs font-medium text-gray-500">{S.link}</label>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-800">{link || '…'}</code>
            {link && <CopyButton text={link} />}
          </div>
        </div>
        {qr && (
          <div className="shrink-0 flex sm:flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={S.qr} width={132} height={132} className="rounded-lg border border-gray-200" />
            <a href={qr} download={`qr-${business.slug}.png`} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:underline">
              <Download className="w-4 h-4" /> {S.downloadQr}
            </a>
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-4 pt-4 mt-4 border-t border-gray-100">
        <div>
          <div className="text-sm font-medium text-gray-900">{S.onlineBooking}</div>
          <p className="text-xs text-gray-500 mt-0.5">{S.onlineBookingHint}</p>
        </div>
        <Toggle checked={online} label={S.onlineBooking} disabled={busy === 'online'} onChange={async (v) => {
          if (await save({ online_booking_enabled: v }, 'online')) setOnline(v)
        }} />
      </div>

      {barbers.length > 0 && (
        <div className="pt-4 mt-4 border-t border-gray-100">
          <div className="text-sm font-medium text-gray-900">{S.barberLinkTitle}</div>
          <p className="text-xs text-gray-500 mt-0.5 mb-3">{S.barberLinkHint} {S.photoTypes}</p>
          <ul className="space-y-3">
            {barbers.map((b) => {
              const url = link ? `${link}?b=${b.id}` : ''
              const uploading = busy === `photo-${b.id}`
              return (
                <li key={b.id} className="flex items-center gap-3">
                  {b.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover bg-gray-100 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-500 font-semibold flex items-center justify-center shrink-0">{b.name.trim()[0]?.toUpperCase()}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{b.name}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                      <label className="text-xs font-medium text-blue-600 hover:underline cursor-pointer">
                        {uploading ? <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {S.photoUploading}</span> : (b.avatar_url ? S.changePhoto : S.addPhoto)}
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading}
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadPhoto(b.id, f) }} />
                      </label>
                      {b.avatar_url && !uploading && (
                        <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => void removePhoto(b.id)}>{S.removePhoto}</button>
                      )}
                    </div>
                  </div>
                  {url && <CopyButton text={url} />}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {modeRow}
      {msg && <p className={`text-xs mt-2 ${msg.kind === 'err' ? 'text-red-600' : 'text-gray-500'}`} role="status">{msg.text}</p>}
    </section>
  )
}
