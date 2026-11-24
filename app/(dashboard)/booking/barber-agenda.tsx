// Server side of the barbershop phone "Agenda" (docs/barbershop-mode/SPEC.md 4.3): loads one local day
// (`?d=YYYY-MM-DD`, default today) and hands it to the interactive AgendaView.

import { createClient } from '@/lib/supabase/server'
import { addDaysYmd, dayRangeIso, isYmd, localYmd } from '@/lib/barbershop-today'
import { accentFor } from '@/lib/barbershop-theme'
import { AgendaView, type AgendaAppointment } from './agenda-view'

interface BusinessRow {
  id: string; name: string; currency: string; timezone: string | null; brand_color: string | null
}

const SELECT =
  'id, starts_at, ends_at, status, price, items_summary, notes, source, employee_id, service_id, client_id, clients(id, name, phone), services(id, name)'

export async function BarberAgenda({ business, dayParam }: { business: BusinessRow; dayParam?: string }) {
  const supabase = await createClient()
  const tz = business.timezone ?? 'UTC'
  const nowMs = Date.now()
  const today = localYmd(new Date(nowMs), tz)
  const ymd = isYmd(dayParam) ? dayParam : today
  const { from, to } = dayRangeIso(ymd, tz)

  const [apptRes, barbersRes, hoursRes] = await Promise.all([
    supabase.from('appointments').select(SELECT).eq('business_id', business.id).gte('starts_at', from).lt('starts_at', to).order('starts_at'),
    supabase.from('employees').select('id, name, avatar_url').eq('business_id', business.id).eq('is_active', true).order('name'),
    supabase.from('business_hours').select('day_of_week, is_open').eq('business_id', business.id),
  ])

  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay()
  const dayHours = (hoursRes.data ?? []).find((h) => h.day_of_week === dow)
  const closed = (hoursRes.data ?? []).length > 0 && !dayHours?.is_open

  return (
    <AgendaView
      business={{ id: business.id, currency: business.currency, timezone: tz }}
      ymd={ymd}
      today={today}
      prevYmd={addDaysYmd(ymd, -1)}
      nextYmd={addDaysYmd(ymd, 1)}
      nowMs={nowMs}
      accent={accentFor(business.brand_color)}
      barbers={barbersRes.data ?? []}
      closed={closed}
      initialAppts={(apptRes.data ?? []) as unknown as AgendaAppointment[]}
    />
  )
}
