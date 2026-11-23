'use client'

import { useLocale } from 'next-intl'
import { useState } from 'react'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'it', label: 'IT' },
  { code: 'pt', label: 'PT' },
  { code: 'fr', label: 'FR' },
]

export function LangSwitcher({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const locale = useLocale()
  const [loading, setLoading] = useState(false)

  async function switchLocale(code: string) {
    if (code === locale || loading) return
    setLoading(true)
    await fetch('/api/user/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: code }),
    })
    window.location.reload()
  }

  const light = variant === 'light'

  return (
    <div className="flex items-center gap-1 px-1 py-1" role="group" aria-label={locale === 'fr' ? 'Langue' : 'Language'}>
      <Globe className={cn('w-3.5 h-3.5 shrink-0 mr-0.5', light ? 'text-gray-400' : 'text-white/30')} />
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          disabled={loading}
          className={cn(
            'text-xs font-medium px-1.5 py-0.5 rounded transition-colors',
            code === locale
              ? light ? 'text-gray-900 bg-gray-100' : 'text-white bg-white/15'
              : light ? 'text-gray-400 hover:text-gray-700' : 'text-white/40 hover:text-white/70'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
