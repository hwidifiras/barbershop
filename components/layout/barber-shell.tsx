'use client'

// App shell for barbershop mode (docs/barbershop-mode/SPEC.md 4.1): bottom tab bar on phones
// (Aujourd'hui · Agenda · Caisse · Clients · Plus), relabelled sidebar on desktop, French only.
// Standard businesses keep components/layout/sidebar.tsx untouched.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Banknote, CalendarDays, Check, Copy, LogOut, Menu, Package, Settings, Sun, Users, X, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fr } from '@/lib/barbershop-fr'

const N = fr.nav

interface Props {
  businessName: string
  logoUrl: string | null
  slug: string
  inventoryOn: boolean
  accent: string
}

interface Tab { href: string; label: string; icon: LucideIcon }

export function BarberShell({ businessName, logoUrl, slug, inventoryOn, accent }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale()
  const supabase = createClient()
  const [moreOpen, setMoreOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const forced = useRef(false)

  // French is the only language in barbershop mode: switch the dashboard language once.
  useEffect(() => {
    if (locale === 'fr' || forced.current) return
    forced.current = true
    fetch('/api/user/locale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: 'fr' }) })
      .then((r) => { if (r.ok) router.refresh() })
      .catch(() => { /* offline: stays in the current language until the next visit */ })
  }, [locale, router])

  const tabs: Tab[] = [
    { href: '/dashboard', label: N.today, icon: Sun },
    { href: '/booking', label: N.calendar, icon: CalendarDays },
    { href: '/pos', label: N.charge, icon: Banknote },
    { href: '/crm', label: N.clients, icon: Users },
  ]
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const moreActive = isActive('/settings') || isActive('/inventory')

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/book/${slug}`)
      setCopied(true)
      try { localStorage.setItem('bb_link_shared', '1') } catch { /* ignore */ }
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked */ }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const logo = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover bg-white/10 shrink-0" />
  ) : (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[#111] shrink-0" style={{ background: accent }}>
      {businessName.trim()[0]?.toUpperCase()}
    </div>
  )

  const style = { '--accent': accent } as React.CSSProperties

  return (
    <div style={style} className="contents">
      {/* Phone: slim top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-[#0e0e0f] border-b border-white/10 flex items-center gap-3 px-4 pt-[env(safe-area-inset-top)] box-content">
        {logo}
        <div className="text-[15px] font-semibold text-white truncate">{businessName}</div>
      </div>

      {/* Desktop: sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col h-screen sticky top-0 bg-[#0e0e0f] border-r border-white/10">
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          {logo}
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-white truncate">{businessName}</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {[...tabs, ...(inventoryOn ? [{ href: '/inventory', label: N.products, icon: Package }] : [])].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive(href) ? 'text-[var(--accent)] bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
              <Icon className="w-4 h-4 shrink-0" /> {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-0.5">
          <button onClick={copyLink} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors">
            {copied ? <Check className="w-4 h-4 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />} {copied ? N.linkCopied : N.shareLink}
          </button>
          <Link href="/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive('/settings') ? 'text-[var(--accent)] bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
            <Settings className="w-4 h-4 shrink-0" /> {N.settings}
          </Link>
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors">
            <LogOut className="w-4 h-4 shrink-0" /> {N.signOut}
          </button>
        </div>
      </aside>

      {/* Phone: bottom tab bar */}
      <nav aria-label={N.menu} className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0e0e0f] border-t border-white/10 grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 min-h-[60px] text-[11px] font-medium ${isActive(href) ? 'text-[var(--accent)]' : 'text-white/55'}`}>
            <Icon className="w-5 h-5" /> {label}
          </Link>
        ))}
        <button onClick={() => setMoreOpen(true)} aria-haspopup="dialog"
          className={`flex flex-col items-center justify-center gap-1 min-h-[60px] text-[11px] font-medium ${moreActive || moreOpen ? 'text-[var(--accent)]' : 'text-white/55'}`}>
          <Menu className="w-5 h-5" /> {N.more}
        </button>
      </nav>

      {/* Phone: "Plus" sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={N.more}>
          <div className="absolute inset-0 bg-black/60" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-[#17171a] rounded-t-2xl border-t border-white/10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="text-sm font-semibold text-white">{N.more}</div>
              <button onClick={() => setMoreOpen(false)} aria-label={N.close} className="p-2 rounded-lg text-white/60"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-1">
              {inventoryOn && (
                <Link href="/inventory" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 px-3 min-h-[52px] rounded-xl text-[15px] text-white bg-white/5">
                  <Package className="w-5 h-5 text-white/60" /> {N.products}
                </Link>
              )}
              <button onClick={copyLink} className="w-full flex items-center gap-3 px-3 min-h-[52px] rounded-xl text-[15px] text-white bg-white/5 text-left">
                {copied ? <Check className="w-5 h-5 text-white/60" /> : <Copy className="w-5 h-5 text-white/60" />} {copied ? N.linkCopied : N.shareLink}
              </button>
              <Link href="/settings" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 px-3 min-h-[52px] rounded-xl text-[15px] text-white bg-white/5">
                <Settings className="w-5 h-5 text-white/60" /> {N.settings}
              </Link>
              <button onClick={signOut} className="w-full flex items-center gap-3 px-3 min-h-[52px] rounded-xl text-[15px] text-white bg-white/5 text-left">
                <LogOut className="w-5 h-5 text-white/60" /> {N.signOut}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
