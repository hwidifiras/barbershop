'use client'

// Barbershop mode (docs/barbershop-mode/SPEC.md 4.14): turn on "Nouveau RDV" notifications on this
// phone. Android/Chrome: one tap. iPhone: only from the home-screen app (Safari rule), so the card
// shows the steps first. The Today screen shows a small banner until this phone is set up.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, BellOff, Check, Share } from 'lucide-react'
import { fr } from '@/lib/barbershop-fr'
import { isIOSDevice, pushSupport, urlBase64ToUint8Array, type PushSupport } from '@/lib/barbershop-push'
import { removePushSubscription, savePushSubscription, sendTestPush } from '@/app/(dashboard)/settings/push-actions'

const P = fr.push
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

type State = PushSupport | 'loading' | 'not_configured' | 'on'

function detect(): PushSupport {
  const nav = navigator as Navigator & { standalone?: boolean }
  return pushSupport({
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    isIOS: isIOSDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0),
    isStandalone: window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
    permission: 'Notification' in window ? Notification.permission : null,
  })
}

/** The site's service worker (registered by Serwist on every page); registers it if it is not there yet. */
async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing) return existing
  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

function usePush() {
  const [state, setState] = useState<State>('loading')
  const [endpoint, setEndpoint] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const support = detect()
      if (support !== 'ready') return setState(support)
      if (!PUBLIC_KEY) return setState('not_configured')
      if (Notification.permission !== 'granted') return setState('ready')
      try {
        const sub = await (await registration()).pushManager.getSubscription()
        if (cancelled) return
        if (!sub) return setState('ready')
        setEndpoint(sub.endpoint)
        setState('on')
        // Heals a row lost on the server (for example after "Désactiver" on another phone of the same account).
        savePushSubscription(sub.toJSON(), navigator.userAgent).catch(() => {})
      } catch {
        if (!cancelled) setState('ready')
      }
    })()
    return () => { cancelled = true }
  }, [])

  const enable = useCallback(async (): Promise<boolean> => {
    // Asked first, straight from the tap: iPhone only shows the question in response to a tap.
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setState(permission === 'denied' ? 'denied' : 'ready')
      return false
    }
    const reg = await registration()
    const sub = (await reg.pushManager.getSubscription())
      ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY) }))
    const saved = await savePushSubscription(sub.toJSON(), navigator.userAgent)
    if (!saved.ok) return false
    setEndpoint(sub.endpoint)
    setState('on')
    return true
  }, [])

  const disable = useCallback(async () => {
    const sub = await (await registration()).pushManager.getSubscription()
    if (sub) {
      await removePushSubscription(sub.endpoint).catch(() => {})
      await sub.unsubscribe().catch(() => false)
    }
    setEndpoint(null)
    setState('ready')
  }, [])

  return { state, endpoint, enable, disable }
}

export function PushCard() {
  const { state, endpoint, enable, disable } = usePush()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function onEnable() {
    setBusy(true); setMessage(null)
    const ok = await enable().catch(() => false)
    setBusy(false)
    if (!ok && Notification.permission !== 'denied') setMessage({ ok: false, text: P.error })
    // The test makes the barber see a real notification right away.
    if (ok) await onTest()
  }

  async function onTest() {
    const sub = endpoint ?? (await (await registration()).pushManager.getSubscription())?.endpoint
    if (!sub) return
    const res = await sendTestPush(sub).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setMessage(res.ok ? { ok: true, text: P.testSent } : { ok: false, text: res.reason === 'not_configured' ? P.notConfigured : P.testFailed })
  }

  if (state === 'loading') return null

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3" aria-labelledby="push-title">
      <div className="flex items-start gap-3">
        <Bell className="w-5 h-5 mt-0.5 text-gray-700 shrink-0" aria-hidden />
        <div>
          <h2 id="push-title" className="font-semibold text-gray-900">{P.title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{P.hint}</p>
        </div>
      </div>

      {state === 'ios-install' && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
          <p className="text-sm font-medium text-gray-900 flex items-center gap-2"><Share className="w-4 h-4" aria-hidden />{P.iosTitle}</p>
          <ol className="mt-2 space-y-1.5 text-sm text-gray-700 list-decimal pl-5">
            {P.iosSteps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </div>
      )}
      {state === 'unsupported' && <p className="text-sm text-gray-600">{P.unsupported}</p>}
      {state === 'denied' && <p className="text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">{P.denied}</p>}
      {state === 'not_configured' && <p className="text-sm text-gray-600">{P.notConfigured}</p>}

      {state === 'ready' && (
        <button type="button" onClick={onEnable} disabled={busy}
          className="w-full min-h-[48px] rounded-xl bg-[#0e0e0f] text-white font-semibold text-sm disabled:opacity-60">
          {busy ? P.enabling : P.enable}
        </button>
      )}

      {state === 'on' && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-green-700 flex items-center gap-2"><Check className="w-4 h-4" aria-hidden />{P.on}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onTest} className="min-h-[44px] rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-800">{P.test}</button>
            <button type="button" onClick={() => { setMessage(null); disable() }} className="min-h-[44px] rounded-xl px-4 text-sm text-gray-500 flex items-center gap-1.5">
              <BellOff className="w-4 h-4" aria-hidden />{P.disable}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-700'}`}>{message.text}</p>
      )}
    </section>
  )
}

const DISMISS_KEY = 'push-banner-dismissed-until'

/** Today screen: a one-line nudge until this phone receives notifications. Hidden for 7 days on "Plus tard". */
export function PushBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
        if (Date.now() < until) return
      } catch { /* storage blocked: show the banner anyway */ }
      const support = detect()
      if (support === 'unsupported' || support === 'denied' || !PUBLIC_KEY) return
      if (support === 'ready' && Notification.permission === 'granted') {
        const sub = await (await registration()).pushManager.getSubscription().catch(() => null)
        if (sub) return
      }
      if (!cancelled) setShow(true)
    })()
    return () => { cancelled = true }
  }, [])

  if (!show) return null
  function later() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 3600_000)) } catch { /* ignore */ }
    setShow(false)
  }
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 text-blue-950 px-3 py-2.5 text-sm flex items-center gap-3">
      <Bell className="w-4 h-4 shrink-0" aria-hidden />
      <span className="flex-1">{P.banner}</span>
      <Link href="/settings?tab=notifications" className="min-h-[40px] flex items-center font-semibold underline">{P.bannerAction}</Link>
      <button type="button" onClick={later} className="min-h-[40px] text-blue-900/70">{P.bannerLater}</button>
    </div>
  )
}
