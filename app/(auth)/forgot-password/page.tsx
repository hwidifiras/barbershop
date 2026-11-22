import { requestPasswordReset } from './actions'
import Link from 'next/link'
import { SubmitButton } from './SubmitButton'
import { getTranslations } from 'next-intl/server'

export default async function ForgotPasswordPage(
  props: {
    searchParams: Promise<{ sent?: string; email?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const t = await getTranslations('auth.forgotPassword')
  if (searchParams.sent) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-3">{t('sentHeading')}</h1>
        <p className="text-sm text-gray-600 mb-6">
          {t('sentBody', { email: searchParams.email ?? '' })}
        </p>
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          {t('backToLogin')}
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-2">{t('heading')}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {t('subheading')}
      </p>

      <form action={requestPasswordReset} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">{t('emailLabel')}</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={t('emailPlaceholder')}
          />
        </div>
        <SubmitButton />
      </form>

      <div className="mt-6">
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          ← Back to sign in
        </Link>
      </div>
    </div>
  )
}
