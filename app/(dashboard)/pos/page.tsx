import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { POSTerminal } from './pos-terminal'
import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { History } from 'lucide-react'
import { formatInBusinessTimezone } from '@/lib/utils'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'

interface SearchParams {
  bookingId?: string
  clientId?: string
  serviceId?: string
  staffId?: string
}

export default async function POSPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient()
  const locale = await getLocale()
  const user = await getAuthUser()

  const business = await getBusinessForOwner(user!.id)

  if (!business) redirect('/onboarding')

  const [{ data: services }, { data: employees }, { data: clients }] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, price, duration_min, category')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('employees')
      .select('id, name')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('clients')
      .select('id, name, phone')
      .eq('business_id', business.id)
      .order('name')
      .limit(200),
  ])

  // ── Booking context: prefill POS from an appointment ──────────────────────
  let bookingContext: {
    bookingId: string
    clientId: string
    serviceId: string
    staffId: string
    label: string
    // Barbershop bookings with supplements or an offer: every line, plus the package discount.
    lines?: { id: string; name: string; price: number; duration_min: number; category: string | null }[]
    discount?: number
  } | undefined

  if (searchParams.bookingId) {
    const { data: appt } = await supabase
      .from('appointments')
      .select('id, starts_at, price, items_summary, clients(name), services(name), employees(id, name)')
      .eq('id', searchParams.bookingId)
      .eq('business_id', business.id) // security: only own business
      .maybeSingle()

    if (appt) {
      // Lines of a barbershop booking (supplements / offer). Standard bookings have none and
      // keep the original single-service prefill.
      const { data: apptItems } = await supabase
        .from('appointment_items')
        .select('service_id, name, price, duration_min, position')
        .eq('appointment_id', appt.id)
        .order('position')
      const lines = (apptItems ?? []).map((i) => ({
        id: i.service_id ?? `item-${i.position}`, name: i.name, price: Number(i.price), duration_min: i.duration_min, category: null as string | null,
      }))
      const listTotal = lines.reduce((t, l) => t + l.price, 0)
      const discount = lines.length > 0 && appt.price != null ? Math.max(0, Math.round((listTotal - Number(appt.price)) * 1000) / 1000) : 0

      const clientName = (appt.clients as { name: string } | null)?.name ?? 'Walk-in'
      const serviceName = appt.items_summary ?? (appt.services as { name: string } | null)?.name ?? ''
      const tz = business.timezone ?? 'UTC'
      bookingContext = {
        bookingId: appt.id,
        clientId: searchParams.clientId ?? '',
        serviceId: searchParams.serviceId ?? '',
        staffId: searchParams.staffId ?? (appt.employees as { id: string; name: string } | null)?.id ?? '',
        label: `${clientName} — ${serviceName} — ${formatInBusinessTimezone(appt.starts_at, tz, 'time', locale)}`,
        ...(lines.length > 0 ? { lines, discount } : {}),
      }
    }
  }

  const t = await getTranslations('pos')

  return (
    <>
      <Header
        title={t('title')}
        actions={
          <Link href="/pos/history" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
            <History className="w-4 h-4" /> Sales history
          </Link>
        }
      />
      <POSTerminal
        businessId={business.id}
        currency={business.currency}
        services={services ?? []}
        employees={employees ?? []}
        clients={clients ?? []}
        bookingContext={bookingContext}
      />
    </>
  )
}
