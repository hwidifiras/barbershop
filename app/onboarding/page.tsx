import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { ensureOwnerBusiness } from '@/lib/create-business'
import { redirect } from 'next/navigation'
import { OnboardingWizard } from './OnboardingWizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: business, error } = await supabase
    .from('businesses')
    .select('id, slug, name, onboarding_completed')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)

  // Signed in but no business yet (account added outside /register): create it here. Redirecting
  // to /login would bounce straight back to the dashboard and loop.
  if (!business) {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const created = await ensureOwnerBusiness(admin, user)
    // Read the new row by id. Repeating the query above would not work: Next memoizes identical
    // GET requests within one render, so it would return the same empty answer.
    if (created) {
      ({ data: business, error } = await admin
        .from('businesses')
        .select('id, slug, name, onboarding_completed')
        .eq('id', created.id)
        .single())
    }
  }

  // Fail visibly rather than redirect: any redirect from here would loop.
  if (!business) throw new Error('Could not set up your business. Please sign out and try again.')

  // Guard: already onboarded → go straight to dashboard
  if (business.onboarding_completed) {
    const isSaas = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'saas'
    if (isSaas && business.slug) {
      const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'trypronto.app'
      redirect(`https://${business.slug}.${rootDomain}/dashboard`)
    }
    redirect('/dashboard')
  }

  const isSaas = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'saas'

  return (
    <OnboardingWizard
      initialSlug={business.slug ?? ''}
      initialName={business.name ?? ''}
      isSaas={isSaas}
      rootDomain={process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'trypronto.app'}
    />
  )
}
