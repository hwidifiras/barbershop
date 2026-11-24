// "Do I already have an appointment?" for the public barbershop booking page
// (docs/barbershop-mode/SPEC.md 4.9). Given a phone number it returns ONLY the day/time and the barber
// of the caller's upcoming appointments in the next 7 days: no name, service, price or contact details.
// An unknown number and a number with nothing booked look the same. Rate limited per IP and per number.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit, getIp } from '@/lib/rate-limit'
import { isBarbershopMode } from '@/lib/vertical'
import { normalizePhone } from '@/lib/phone'

const Schema = z.object({
  businessId: z.string().uuid(),
  phone: z.string().max(30),
})

const DAY_MS = 24 * 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  if (!rateLimit(`lookup:${ip}`, { limit: 20, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'validation_failed' }, { status: 422 })
  const { businessId, phone } = parsed.data

  const key = normalizePhone(phone)
  if (!key) return NextResponse.json({ appointments: [] })

  // Hammering one number (to guess whose it is) is capped no matter how many IPs are used.
  if (!rateLimit(`lookup-key:${businessId}:${key}`, { limit: 10, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const supabase = createServiceClient()
  const { data: biz } = await supabase.from('businesses').select('type, barbershop_mode').eq('id', businessId).maybeSingle()
  if (!isBarbershopMode(biz)) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: clients } = await supabase.from('clients').select('id').eq('business_id', businessId).eq('phone_key', key)
  const ids = (clients ?? []).map((c) => c.id)
  if (ids.length === 0) return NextResponse.json({ appointments: [] })

  const now = Date.now()
  const { data: appts } = await supabase
    .from('appointments')
    .select('starts_at, employees(name)')
    .eq('business_id', businessId)
    .in('client_id', ids)
    .in('status', ['pending', 'confirmed'])
    .gt('ends_at', new Date(now).toISOString())
    .lt('starts_at', new Date(now + 7 * DAY_MS).toISOString())
    .order('starts_at', { ascending: true })
    .limit(3)

  const appointments = (appts ?? []).map((a) => {
    const emp = a.employees as { name: string } | { name: string }[] | null
    const barber = Array.isArray(emp) ? emp[0]?.name : emp?.name
    return { startsAt: a.starts_at as string, barber: barber ?? null }
  })
  return NextResponse.json({ appointments }, { headers: { 'Cache-Control': 'no-store' } })
}
