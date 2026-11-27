import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Sidebar } from '@/components/layout/sidebar'
import { getAuthUser } from '@/lib/auth-user'
import { BarberShell } from '@/components/layout/barber-shell'
import { isBarbershopMode } from '@/lib/vertical'
import { accentFor } from '@/lib/barbershop-theme'
import { getBusinessForOwner } from '@/lib/business'
import type { Metadata } from 'next'

// Barbershop mode (SPEC 4.14): the phone's home-screen app is named after the shop and opens on
// Today (needed on iPhone, where notifications only work from the home-screen app).
export async function generateMetadata(): Promise<Metadata> {
  const user = await getAuthUser()
  if (!user) return {}
  const business = await getBusinessForOwner(user.id)
  if (!business || !isBarbershopMode(business)) return {}
  return {
    manifest: `/barbershop.webmanifest?n=${encodeURIComponent(business.name)}`,
    appleWebApp: { capable: true, title: business.name, statusBarStyle: 'default' },
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()

  if (!user) redirect('/login')

  // Same memoised query as generateMetadata above: one database round trip for both.
  const business = await getBusinessForOwner(user.id)

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
