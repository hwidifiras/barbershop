/**
 * POST /api/book
 * Server-side booking submission with Zod validation and rate limiting.
 * Replaces direct Supabase client calls from booking-form.tsx.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'
import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit, getIp } from '@/lib/rate-limit'
import { isBarbershopMode } from '@/lib/vertical'
import { normalizePhone } from '@/lib/phone'
import { resolveBooking, type ResolvedBooking } from '@/lib/barbershop-cart'
import { computeEffectiveHours, checkSlotWithinHours, dayOfWeekFromDateString } from '@/lib/booking-availability'

function sanitize(s: string): string {
  return DOMPurify.sanitize(s, { ALLOWED_TAGS: [] }).trim()
}

/** Convert a wall-clock date+time (e.g. "2024-03-15", "14:30") in a named IANA timezone to a UTC Date. */
function parseDateTimeInTz(date: string, time: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  // Use noon UTC on the same date as a stable reference to determine the TZ offset,
  // avoiding DST edge cases that only happen near midnight.
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  }).formatToParts(noonUtc)
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0')
  const localNoonMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  const offsetMs = localNoonMs - noonUtc.getTime()
  // wall_clock = UTC + offset  →  UTC = wall_clock - offset
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offsetMs)
}

const BookingSchema = z.object({
  businessId: z.string().uuid(),
  serviceId:  z.string().uuid(),
  // Barbershop mode only (docs/barbershop-mode/SPEC.md 4.12): supplements and offers. Ignored for other types.
  extraServiceIds: z.array(z.string().uuid()).max(10).optional(),
  offerId:    z.string().uuid().nullable().optional(),
  employeeId: z.string().uuid().nullable().optional(),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  time:       z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  name:       z.string().min(1).max(100),
  phone:      z.string().max(30).optional().nullable(),
  email:      z.string().email().optional().nullable().or(z.literal('')),
})

export async function POST(req: NextRequest) {
  // Rate limit: 5 booking attempts per IP per 10 minutes
  const ip = getIp(req)
  if (!rateLimit(ip, { limit: 20, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  // Parse + validate input
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = BookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    )
  }

  const { businessId, serviceId, employeeId, date, time, phone, email } = parsed.data
  const name = sanitize(parsed.data.name)

  if (!phone && !email) {
    return NextResponse.json(
      { error: 'contact_required', message: 'At least a phone number or email is required' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Verify the business exists and the service belongs to it; also fetch timezone
  const [{ data: service }, { data: biz }] = await Promise.all([
    supabase
      .from('services')
      .select('id, duration_min, price')
      .eq('id', serviceId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('businesses')
      .select('timezone, type, barbershop_mode, online_booking_enabled')
      .eq('id', businessId)
      .maybeSingle(),
  ])

  // Barbershop mode, dial 1 (docs/barbershop-mode/SPEC.md 4.10): a walk-in-only shop can turn
  // the public link off. Enforced here as well as in the page so a stale tab or a direct POST
  // cannot book. Only barbershop mode reads this flag; other business types are unaffected.
  if (isBarbershopMode(biz) && biz?.online_booking_enabled === false) {
    return NextResponse.json(
      { error: 'online_booking_disabled', message: 'Online booking is turned off for this business.' },
      { status: 403 }
    )
  }

  // Barbershop mode: price, duration and the booking rules (supplements, offers, services switched
  // off online) are computed HERE from the database, never taken from the browser.
  let resolved: ResolvedBooking | null = null
  if (isBarbershopMode(biz)) {
    const [{ data: allServices }, { data: allOffers }] = await Promise.all([
      supabase
        .from('services')
        .select('id, name, price, duration_min, kind, bookable_alone, bookable_online, is_active, includes, exclusive_group')
        .eq('business_id', businessId),
      parsed.data.offerId
        ? supabase.from('offers').select('id, name, price, service_ids, barber_ids, valid_from, valid_to, is_active').eq('business_id', businessId)
        : Promise.resolve({ data: [] }),
    ])
    resolved = resolveBooking({
      serviceId,
      extraServiceIds: parsed.data.extraServiceIds,
      offerId: parsed.data.offerId ?? null,
      employeeId: employeeId ?? null,
      date,
      services: (allServices ?? []) as Parameters<typeof resolveBooking>[0]['services'],
      offers: (allOffers ?? []) as Parameters<typeof resolveBooking>[0]['offers'],
    })
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.error === 'service_unavailable' ? 404 : 422 }
      )
    }
  }

  if (!service) {
    return NextResponse.json({ error: 'service_not_found' }, { status: 404 })
  }

  const totalDuration = resolved?.ok ? resolved.totalDuration : service.duration_min
  const totalPrice    = resolved?.ok ? resolved.totalPrice : service.price

  const timezone = biz?.timezone ?? 'UTC'

  // Server-side availability check — the client (booking-form.tsx) already
  // restricts the slot picker to open hours / outside break, but that's UI
  // convenience only. Nothing before this point stopped a direct POST from
  // requesting a time the business is actually closed for, so repeat the
  // same check here using the same shared logic (lib/booking-availability.ts)
  // the client uses to build effectiveHours in the first place.
  const { data: businessHours } = await supabase
    .from('business_hours')
    .select('day_of_week, is_open, open_time, close_time, break_start, break_end')
    .eq('business_id', businessId)

  const effectiveHours = computeEffectiveHours(businessHours ?? [])
  const dow = dayOfWeekFromDateString(date)
  const dayHours = effectiveHours.find((h) => h.day_of_week === dow)
  const slotCheck = checkSlotWithinHours(dayHours, time, totalDuration)

  if (!slotCheck.ok) {
    const messages: Record<typeof slotCheck.reason, string> = {
      closed: 'This business is closed at the selected date. Please choose another day.',
      outside_hours: 'This time is outside business hours. Please choose another time.',
      break: 'This time falls during a break. Please choose another time.',
    }
    return NextResponse.json(
      { error: 'outside_availability', reason: slotCheck.reason, message: messages[slotCheck.reason] },
      { status: 400 }
    )
  }

  // Upsert client
  const barbershop = isBarbershopMode(biz)
  let clientId: string | null = null
  let hasTelegram = false
  let hasViber = false
  if (phone || email) {
    // BUG-8: search by all provided fields combined — avoids duplicate clients when
    // both phone and email are submitted but each matches a different existing record.
    // Matched via separate parameterized .eq() calls, never a hand-built PostgREST
    // .or() filter string — comma/parenthesis characters in a submitted phone/email
    // are structural in that syntax, so a raw filter string built from user input
    // could be extended into an unrelated OR clause and match a client this
    // booking has no business touching.
    type ClientMatch = { id: string; name: string; email: string | null; telegram_id: string | null; viber_user_id: string | null }
    let existing: ClientMatch | null = null
    if (phone) {
      if (barbershop) {
        // Barbershop mode: the phone number IS the client, however it was typed (spaces, +216, ...).
        const key = normalizePhone(phone)
        if (key) {
          const { data } = await supabase
            .from('clients')
            .select('id, name, email, telegram_id, viber_user_id')
            .eq('business_id', businessId)
            .eq('phone_key', key)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          existing = data
        }
      } else {
        const { data } = await supabase
          .from('clients')
          .select('id, name, email, telegram_id, viber_user_id')
          .eq('business_id', businessId)
          .eq('phone', phone)
          .maybeSingle()
        existing = data
      }
    }
    if (!existing && email) {
      const { data } = await supabase
        .from('clients')
        .select('id, name, email, telegram_id, viber_user_id')
        .eq('business_id', businessId)
        .eq('email', email)
        .maybeSingle()
      existing = data
    }

    if (existing) {
      clientId = existing.id
      hasTelegram = !!existing.telegram_id
      hasViber = !!existing.viber_user_id
      // BUG-10: update both name and email if different from stored value
      const updates: { name?: string; email?: string } = {}
      // Barbershop mode: the barber owns the client's name (fixed from the Clients page); a booking
      // typed with a different spelling must not overwrite it or it would undo the barber's fix.
      if (!barbershop && name && name !== existing.name) updates.name = name
      if (email && email !== existing.email) updates.email = email
      if (Object.keys(updates).length > 0) {
        await supabase.from('clients').update(updates).eq('id', existing.id)
      }
    } else {
      // BUG-9: fail fast if client creation fails — never book without a valid clientId
      const { data: newClient, error: insertErr } = await supabase
        .from('clients')
        .insert({
          business_id: businessId,
          name,
          phone: (barbershop ? normalizePhone(phone) : null) ?? (phone || null),
          email: email || null,
        })
        .select('id')
        .single()
      if (insertErr || !newClient) {
        console.error('[api/book] client insert error:', insertErr?.message)
        return NextResponse.json({ error: 'client_creation_failed' }, { status: 500 })
      }
      clientId = newClient.id
    }
  }

  // Create appointment — parse wall-clock time in the business timezone
  const startsAt = parseDateTimeInTz(date, time, timezone)
  const endsAt   = new Date(startsAt.getTime() + totalDuration * 60_000)

  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .insert({
      business_id: businessId,
      client_id:   clientId,
      employee_id: employeeId ?? null,
      service_id:  serviceId,
      starts_at:   startsAt.toISOString(),
      ends_at:     endsAt.toISOString(),
      price:       totalPrice,
      status:      'confirmed',
      source:      'online',
      ...(resolved?.ok ? { offer_id: resolved.offerId, items_summary: resolved.summary } : {}),
    })
    .select('id')
    .single()

  if (apptErr || !appt) {
    // Trigger 034: no active employee exists to assign this booking to —
    // distinct from a real time conflict, so it gets an honest message
    // instead of "slot already booked".
    if (apptErr?.message?.includes('no_staff_available')) {
      return NextResponse.json(
        { error: 'no_staff_available', message: 'This business has no staff available to take bookings right now. Please contact them directly.' },
        { status: 409 }
      )
    }

    // Trigger 017: the DB raises 'slot_already_booked' when a concurrent
    // request wins the race for the same slot.
    if (apptErr?.message?.includes('slot_already_booked')) {
      return NextResponse.json(
        { error: 'slot_taken', message: 'This time slot was just taken. Please choose another time.' },
        { status: 409 }
      )
    }
    console.error('[api/book] insert error:', apptErr?.message)
    return NextResponse.json({ error: 'booking_failed' }, { status: 500 })
  }

  // Barbershop mode: keep the booking's lines (price and duration frozen at booking time) for the
  // calendar and the POS. The appointment itself is already valid without them (it carries the
  // total price, the end time and a readable summary), so a failure here is logged, not fatal.
  if (resolved?.ok) {
    const { error: itemsErr } = await supabase.from('appointment_items').insert(
      resolved.lines.map((l, i) => ({
        appointment_id: appt.id,
        business_id: businessId,
        service_id: l.service_id,
        name: l.name,
        price: l.price,
        duration_min: l.duration_min,
        position: i,
      }))
    )
    if (itemsErr) console.error('[api/book] appointment_items insert error:', itemsErr.message)
  }

  // Trigger notifications (fire-and-forget — non-blocking)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/email/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.INTERNAL_API_SECRET ?? ''}`,
    },
    body: JSON.stringify({ appointmentId: appt.id, formEmail: email || null }),
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[api/book] email/confirm failed:', res.status, text)
    }
  }).catch((err) => {
    console.error('[api/book] email/confirm fetch error:', err)
  })

  return NextResponse.json({ appointmentId: appt.id, clientId, hasTelegram, hasViber })
}
