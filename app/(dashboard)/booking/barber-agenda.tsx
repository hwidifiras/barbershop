// Server side of the barbershop phone "Agenda" (docs/barbershop-mode/SPEC.md 4.3): loads one local day
// (`?d=YYYY-MM-DD`, default today) and hands it to the interactive AgendaView.

import { createClient } from '@/lib/supabase/server'
import { addDaysYmd, dayRangeIso, isYmd, localYmd, weekStartYmd } from '@/lib/barbershop-today'
import { accentFor } from '@/lib/barbershop-theme'
import { balanceOf } from '@/lib/kridi'
import { AgendaView, type AgendaAppointment } from './agenda-view'

interface BusinessRow {
  id: string; name: string; currency: string; timezone: string | null; brand_color: string | null
}

const SELECT =
  'id, starts_at, ends_at, status, price, items_summary, notes, source, employee_id, service_id, client_id, clients(id, name, phone), services(id, name)'

export async function BarberAgenda({ business, dayParam, viewParam }: { business: BusinessRow; dayParam?: string; viewParam?: string }) {
  const supabase = await createClient()
  const tz = business.timezone ?? 'UTC'
  const nowMs = Date.now()
  const today = localYmd(new Date(nowMs), tz)
  const ymd = isYmd(dayParam) ? dayParam : today
  const view = viewParam === 'week' ? 'week' : 'day'
  // Day view loads one day; week view loads Monday to Sunday of the week that contains `ymd`.
  const weekStart = weekStartYmd(ymd)
  const { from, to } = view === 'week'
    ? { from: dayRangeIso(weekStart, tz).from, to: dayRangeIso(addDaysYmd(weekStart, 6), tz).to }
    : dayRangeIso(ymd, tz)

  const [apptRes, barbersRes, hoursRes, servicesRes] = await Promise.all([
    supabase.from('appointments').select(SELECT).eq('business_id', business.id).gte('starts_at', from).lt('starts_at', to).order('starts_at'),
    supabase.from('employees').select('id, name, avatar_url').eq('business_id', business.id).eq('is_active', true).order('name'),
    supabase.from('business_hours').select('day_of_week, is_open, open_time, close_time, break_start, break_end').eq('business_id', business.id),
    supabase.from('services').select('id, name, price, duration_min, kind, bookable_alone, includes, exclusive_group').eq('business_id', business.id).eq('is_active', true).order('name'),
  ])

  const hoursRows = hoursRes.data ?? []
  const isClosedOn = (day: string) => {
    if (hoursRows.length === 0) return false
    const dow = new Date(`${day}T12:00:00Z`).getUTCDay()
    return !hoursRows.find((h) => h.day_of_week === dow)?.is_open
  }
  const closed = isClosedOn(ymd)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = addDaysYmd(weekStart, i)
    return { ymd: day, closed: isClosedOn(day) }
  })

  // Who owes kridi among the clients on screen, so the barber knows before the cut.
  const clientIds = Array.from(new Set((apptRes.data ?? []).map((a) => a.client_id).filter((id): id is string => !!id)))
  const owed: Record<string, number> = {}
  if (clientIds.length > 0) {
    const { data: ledger } = await supabase.from('client_ledger').select('client_id, kind, amount').eq('business_id', business.id).in('client_id', clientIds)
    const byClient = new Map<string, { kind: string; amount: number }[]>()
    for (const r of ledger ?? []) byClient.set(r.client_id, [...(byClient.get(r.client_id) ?? []), r])
    for (const [id, list] of byClient) { const b = balanceOf(list); if (b > 0) owed[id] = b }
  }

  return (
    <AgendaView
      business={{ id: business.id, currency: business.currency, timezone: tz }}
      ymd={ymd}
      today={today}
      prevYmd={addDaysYmd(ymd, -1)}
      nextYmd={addDaysYmd(ymd, 1)}
      view={view}
      weekDays={weekDays}
      prevWeekYmd={addDaysYmd(weekStart, -7)}
      nextWeekYmd={addDaysYmd(weekStart, 7)}
      nowMs={nowMs}
      accent={accentFor(business.brand_color)}
      barbers={barbersRes.data ?? []}
      closed={closed}
      owed={owed}
      hours={hoursRows}
      services={(servicesRes.data ?? []).map((sv) => ({ ...sv, price: Number(sv.price), includes: sv.includes ?? [] }))}
      initialAppts={(apptRes.data ?? []) as unknown as AgendaAppointment[]}
    />
  )
}
