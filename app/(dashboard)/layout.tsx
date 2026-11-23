import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Sidebar } from '@/components/layout/sidebar'
import { getAuthUser } from '@/lib/auth-user'
import { BarberShell } from '@/components/layout/barber-shell'
import { isBarbershopMode } from '@/lib/vertical'
import { accentFor } from '@/lib/barbershop-theme'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const user = await getAuthUser()

  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, slug, plan, type, barbershop_mode, logo_url, brand_color, enabled_modules')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!business) redirect('/onboarding')

  // SaaS: if user is on the main domain, redirect to their subdomain preserving the path.
  // Covers /dashboard, /settings, /pos, /crm, /inventory, /booking — any app route.
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  if (rootDomain && business?.slug) {
    const headersList = await headers()
    const host = headersList.get('host') ?? ''
    if (host === rootDomain || host === `www.${rootDomain}`) {
      // x-pathname is set by middleware on every request
      const pathname = headersList.get('x-pathname') ?? '/dashboard'
      redirect(`https://${business.slug}.${rootDomain}${pathname}`)
    }
  }

  // Barbershop mode (docs/barbershop-mode/SPEC.md 4.1): bottom tab bar on phones, French only.
  if (isBarbershopMode(business)) {
    return (
      <div className="fixed inset-0 flex overflow-hidden bg-gray-50">
        <BarberShell
          businessName={business.name}
          logoUrl={business.logo_url ?? null}
          slug={business.slug}
          inventoryOn={(business.enabled_modules ?? []).includes('inventory')}
          accent={accentFor(business.brand_color)}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pt-0 md:pb-0">
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-gray-50">
      <Sidebar businessName={business.name} />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pt-14 md:pt-0">
        {children}
      </div>
    </div>
  )
}
