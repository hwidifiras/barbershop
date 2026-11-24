import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { BookingCalendar } from './booking-calendar'
import { getAuthUser } from '@/lib/auth-user'
import { getBusinessForOwner } from '@/lib/business'
import { getTranslations } from 'next-intl/server'
import { isBarbershopMode } from '@/lib/vertical'
import { BarberAgenda } from './barber-agenda'

export default async function BookingPage(props: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await props.searchParams
  const supabase = await createClient()
  const t = await getTranslations('booking')
  const user = await getAuthUser()

  const business = await getBusinessForOwner(user!.id)

  if (!business) redirect('/onboarding')

  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + 1)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  const [{ data: appointments }, { data: employees }, { data: services }, { data: clients }, { data: businessHours }] =
    await Promise.all([
      supabase
        .from('appointments')
        .select('id, starts_at, ends_at, status, source, notes, items_summary, clients(id, name), employees(id, name), services(id, name, price)')
        .eq('business_id', business.id)
        .gte('starts_at', weekStart.toISOString())
        .lt('starts_at', weekEnd.toISOString())
        .order('starts_at'),
      supabase
        .from('employees')
        .select('id, name')
        .eq('business_id', business.id)
        .eq('is_active', true),
      supabase
        .from('services')
        .select('id, name, duration_min, price')
        .eq('business_id', business.id)
        .eq('is_active', true),
      supabase
        .from('clients')
        .select('id, name, phone')
        .eq('business_id', business.id)
        .order('name')
        .limit(200),
      supabase
        .from('business_hours')
        .select('day_of_week, is_open, open_time, close_time')
        .eq('business_id', business.id),
    ])

  const calendar = (
    <>
      <Header title={t('title')} />
      <BookingCalendar
        businessId={business.id}
        slug={business.slug}
        timezone={business.timezone}
        appointments={appointments ?? []}
        employees={employees ?? []}
        services={services ?? []}
        clients={clients ?? []}
        businessHours={businessHours ?? []}
      />
    </>
  )

  // Barbershop mode (docs/barbershop-mode/SPEC.md 4.3): day agenda on phones, the existing week
  // calendar from md and up. Every other business type keeps the calendar exactly as it was.
  if (isBarbershopMode(business)) {
    return (
      <>
        <div className="md:hidden"><BarberAgenda business={business} dayParam={d} /></div>
        <div className="hidden md:block">{calendar}</div>
      </>
    )
  }
  return calendar
}
