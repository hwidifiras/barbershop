import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { LangSwitcher } from '@/components/layout/lang-switcher'
import { HJaimeMark, BRAND_NAME } from '@/components/brand/hjaime-logo'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('brand')
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-3"><LangSwitcher variant="light" /></div>
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3 no-underline" style={{ color: '#111' }}>
            <HJaimeMark size={64} />
            <span className="text-2xl font-bold" style={{ letterSpacing: '-0.5px' }}>{BRAND_NAME}</span>
          </Link>
          <p className="text-sm text-gray-500 mt-1">{t('tagline')}</p>
        </div>
        {children}
      </div>
    </div>
  )
}
