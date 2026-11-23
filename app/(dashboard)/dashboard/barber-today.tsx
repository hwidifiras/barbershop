// Server side of the barbershop "Today" screen (docs/barbershop-mode/SPEC.md 4.2). It only loads the
// shop's local day and hands it to the interactive TodayView. The standard dashboard is not touched.

import { createClient } from '@/lib/supabase/server'
import { dayRangeIso, localYmd } from '@/lib/barbershop-today'
import { accentFor } from '@/lib/barbershop-theme'
import { TodayView, type TodayAppointment } from './today-view'

interface BusinessRow {
  id: string
  name: string
  slug: string
  currency: string
  timezone: string | null
  brand_color: string | null
  enabled_modules: string[] | null
}

const APPT_SELECT =
  'id, starts_at, ends_at, status, price, items_summary, notes, source, employee_id, service_id, client_id, clients(id, name, phone), services(id, name)'

export async function BarberToday({ business }: { business: BusinessRow }) {
  const supabase = await createClient()
  const tz = business.timezone ?? 'UTC'
  const nowMs = Date.now()
  const ymd = localYmd(new Date(nowMs), tz)
  const { from, to } = dayRangeIso(ymd, tz)
  const inventoryOn = (business.enabled_modules ?? []).includes('inventory')

  const [apptRes, barbersRes, servicesRes, hoursRes, revenueRes, stockRes] = await Promise.all([
    supabase.from('appointments').select(APPT_SELECT).eq('business_id', business.id).gte('starts_at', from).lt('starts_at', to).order('starts_at'),
    supabase.from('employees').select('id, name, avatar_url').eq('business_id', business.id).eq('is_active', true).order('name'),
    supabase.from('services').select('id, name, price, duration_min, kind, bookable_alone').eq('business_id', business.id).eq('is_active', true).order('name'),
    supabase.from('business_hours').select('day_of_week, is_open, open_time, close_time, break_start, break_end').eq('business_id', business.id),
    supabase.from('transactions').select('amount').eq('business_id', business.id).eq('status', 'completed').gte('created_at', from).lt('created_at', to),
    inventoryOn
      ? supabase.from('inventory_items').select('quantity, low_stock_threshold').eq('business_id', business.id)
      : Promise.resolve({ data: [] as { quantity: number; low_stock_threshold: number }[] }),
  ])

  const revenueToday = (revenueRes.data ?? []).reduce((t, r) => t + Number(r.amount), 0)
  const lowStock = (stockRes.data ?? []).filter((i) => Number(i.quantity) <= Number(i.low_stock_threshold)).length

  return (
    <TodayView
      business={{ id: business.id, name: business.name, slug: business.slug, currency: business.currency, timezone: tz }}
      ymd={ymd}
      nowMs={nowMs}
      accent={accentFor(business.brand_color)}
      barbers={barbersRes.data ?? []}
      services={(servicesRes.data ?? []).map((s) => ({ ...s, price: Number(s.price) }))}
      hours={hoursRes.data ?? []}
      hasHours={(hoursRes.data ?? []).length > 0}
      initialAppts={(apptRes.data ?? []) as unknown as TodayAppointment[]}
      revenueToday={revenueToday}
      lowStock={lowStock}
    />
  )
}
