// Pricing and rules for barbershop bookings: main services, supplements and offers
// (docs/barbershop-mode/SPEC.md 4.12). Pure functions, shared by the public page (display) and
// POST /api/book (authority), so both always agree. Unit-tested in tests/unit/barbershop-cart.spec.ts.

export type ServiceKind = 'main' | 'supplement'

export interface CartService {
  id: string
  name: string
  price: number
  duration_min: number
  kind: ServiceKind
  bookable_alone: boolean
  bookable_online: boolean
  is_active: boolean
  /** Main service: supplements it already covers (shown as "Inclus", cannot be added again). */
  includes: string[]
  /** Supplement: supplements with the same group are a single choice. null = independent. */
  exclusive_group: string | null
}

export interface CartOffer {
  id: string
  name: string
  price: number
  service_ids: string[]
  /** null / empty = every barber */
  barber_ids: string[] | null
  valid_from: string | null // YYYY-MM-DD
  valid_to: string | null   // YYYY-MM-DD
  is_active: boolean
}

export interface BookingLine { service_id: string; name: string; price: number; duration_min: number }

export type CartError =
  | 'service_unavailable'
  | 'supplement_requires_main'
  | 'invalid_supplement'
  | 'supplement_included'
  | 'supplement_conflict'
  | 'offer_unavailable'
  | 'offer_not_valid_on_date'
  | 'offer_barber_not_allowed'

export type ResolvedBooking =
  | {
      ok: true
      lines: BookingLine[]
      totalPrice: number
      totalDuration: number
      /** Sum of the regular prices; differs from totalPrice for an offer. */
      listTotal: number
      offerId: string | null
      summary: string
    }
  | { ok: false; error: CartError }

const round3 = (n: number) => Math.round(n * 1000) / 1000
const num = (v: unknown) => Number(v) || 0

/** Offer is bookable for a visit on this date (YYYY-MM-DD). */
export function isOfferValidOn(offer: Pick<CartOffer, 'is_active' | 'valid_from' | 'valid_to'>, ymd: string): boolean {
  if (!offer.is_active) return false
  if (offer.valid_from && ymd < offer.valid_from) return false
  if (offer.valid_to && ymd > offer.valid_to) return false
  return true
}

/** Barbers an offer applies to, among the shop's barbers. */
export function offerBarberIds(offer: Pick<CartOffer, 'barber_ids'>, allBarberIds: string[]): string[] {
  if (!offer.barber_ids || offer.barber_ids.length === 0) return allBarberIds
  return allBarberIds.filter((id) => offer.barber_ids!.includes(id))
}

const bookableOnline = (s: CartService | undefined): s is CartService => !!s && s.is_active && s.bookable_online

/** Services shown as a starting choice: every main service, and supplements that may be booked alone. */
export function startingServices(services: CartService[]): CartService[] {
  return services.filter((s) => bookableOnline(s) && (s.kind === 'main' || s.bookable_alone))
}

/** Supplements that can be added to a main service. */
export function addOnServices(services: CartService[]): CartService[] {
  return services.filter((s) => bookableOnline(s) && s.kind === 'supplement')
}

type ExtrasResult = { ok: true; lines: BookingLine[] } | { ok: false; error: CartError }

/** Checks the supplements added on top of a main service or an offer. */
function checkExtras(
  extraIds: string[],
  byId: Map<string, CartService>,
  coveredIds: Set<string>,
  includedIds: Set<string>,
): ExtrasResult {
  const lines: BookingLine[] = []
  const groups = new Set<string>()
  for (const id of extraIds) {
    const s = byId.get(id)
    if (!bookableOnline(s) || s.kind !== 'supplement' || coveredIds.has(id)) return { ok: false, error: 'invalid_supplement' }
    if (includedIds.has(id)) return { ok: false, error: 'supplement_included' }
    if (s.exclusive_group) {
      if (groups.has(s.exclusive_group)) return { ok: false, error: 'supplement_conflict' }
      groups.add(s.exclusive_group)
    }
    lines.push({ service_id: s.id, name: s.name, price: num(s.price), duration_min: num(s.duration_min) })
  }
  return { ok: true, lines }
}

const sumPrice = (lines: BookingLine[]) => round3(lines.reduce((t, l) => t + l.price, 0))
const sumDuration = (lines: BookingLine[]) => lines.reduce((t, l) => t + l.duration_min, 0)

export function resolveBooking(input: {
  serviceId: string
  extraServiceIds?: string[]
  offerId?: string | null
  employeeId?: string | null
  /** Visit date YYYY-MM-DD (business timezone). */
  date: string
  services: CartService[]
  offers: CartOffer[]
}): ResolvedBooking {
  const byId = new Map(input.services.map((s) => [s.id, s]))
  const extraIds = Array.from(new Set(input.extraServiceIds ?? []))

  // ── Offer (supplements may be added on top) ────────────────────────────
  if (input.offerId) {
    const offer = input.offers.find((o) => o.id === input.offerId)
    if (!offer || !offer.is_active) return { ok: false, error: 'offer_unavailable' }
    if (!isOfferValidOn(offer, input.date)) return { ok: false, error: 'offer_not_valid_on_date' }
    if (offer.barber_ids && offer.barber_ids.length > 0) {
      if (!input.employeeId || !offer.barber_ids.includes(input.employeeId)) {
        return { ok: false, error: 'offer_barber_not_allowed' }
      }
    }
    const offerLines: BookingLine[] = []
    for (const id of offer.service_ids) {
      const s = byId.get(id)
      if (!bookableOnline(s)) return { ok: false, error: 'offer_unavailable' }
      offerLines.push({ service_id: s.id, name: s.name, price: num(s.price), duration_min: num(s.duration_min) })
    }
    const covered = new Set(offer.service_ids)
    const included = new Set(offer.service_ids.flatMap((id) => byId.get(id)?.includes ?? []))
    const extras = checkExtras(extraIds, byId, covered, included)
    if (!extras.ok) return extras

    const lines = [...offerLines, ...extras.lines]
    const base = `${offer.name} (${offerLines.map((l) => l.name).join(' + ')})`
    return {
      ok: true,
      lines,
      totalPrice: round3(num(offer.price) + sumPrice(extras.lines)),
      totalDuration: sumDuration(lines),
      listTotal: sumPrice(lines),
      offerId: offer.id,
      summary: extras.lines.length ? `${base} + ${extras.lines.map((l) => l.name).join(' + ')}` : base,
    }
  }

  // ── Service + optional supplements ─────────────────────────────────────
  const primary = byId.get(input.serviceId)
  if (!bookableOnline(primary)) return { ok: false, error: 'service_unavailable' }

  if (primary.kind === 'supplement') {
    if (!primary.bookable_alone || extraIds.length > 0) return { ok: false, error: 'supplement_requires_main' }
  }

  const extras = checkExtras(extraIds, byId, new Set([primary.id]), new Set(primary.includes ?? []))
  if (!extras.ok) return extras

  const lines: BookingLine[] = [
    { service_id: primary.id, name: primary.name, price: num(primary.price), duration_min: num(primary.duration_min) },
    ...extras.lines,
  ]
  const total = sumPrice(lines)
  return {
    ok: true,
    lines,
    totalPrice: total,
    totalDuration: sumDuration(lines),
    listTotal: total,
    offerId: null,
    summary: lines.map((l) => l.name).join(' + '),
  }
}

/** First allowed barber who is free at `time` (used when the client chose "first available" but the offer is limited). */
export function pickBarberFor(time: string, perBarber: Record<string, string[]>, allowed: string[]): string | null {
  for (const id of allowed) if ((perBarber[id] ?? []).includes(time)) return id
  return null
}

/** Supplements already covered by what the client picked (shown as "Inclus", cannot be added). */
export function includedIdsOf(input: { service: CartService | null; offer: CartOffer | null; services: CartService[] }): Set<string> {
  if (input.offer) {
    const byId = new Map(input.services.map((s) => [s.id, s]))
    return new Set(input.offer.service_ids.flatMap((id) => byId.get(id)?.includes ?? []))
  }
  return new Set(input.service?.includes ?? [])
}

/** Supplements that can be added to this choice: online supplements that are not the offer's own lines. */
export function addOnsFor(input: { offer: CartOffer | null; services: CartService[] }): CartService[] {
  const own = new Set(input.offer?.service_ids ?? [])
  return addOnServices(input.services).filter((s) => !own.has(s.id))
}

/** Ticks or unticks a supplement. Included ones cannot be ticked; ticking one in an exclusive group replaces the other. */
export function toggleAddOn(current: string[], id: string, services: CartService[], blocked: Set<string>): string[] {
  if (blocked.has(id)) return current
  if (current.includes(id)) return current.filter((x) => x !== id)
  const picked = services.find((s) => s.id === id)
  const group = picked?.exclusive_group ?? null
  const kept = group ? current.filter((x) => services.find((s) => s.id === x)?.exclusive_group !== group) : current
  return [...kept, id]
}

/** Totals for what the client has picked so far, for display only (no date or availability rules;
 *  POST /api/book re-checks everything with resolveBooking). */
export function previewSelection(input: {
  service: CartService | null
  extras: CartService[]
  offer: CartOffer | null
  services: CartService[]
}): { lines: BookingLine[]; totalPrice: number; totalDuration: number; listTotal: number; summary: string } {
  const toLine = (s: CartService): BookingLine => ({ service_id: s.id, name: s.name, price: num(s.price), duration_min: num(s.duration_min) })
  const extraLines = input.extras.map(toLine)
  let lines: BookingLine[] = []
  if (input.offer) {
    const byId = new Map(input.services.map((s) => [s.id, s]))
    const offerLines = input.offer.service_ids.map((id) => byId.get(id)).filter((s): s is CartService => !!s).map(toLine)
    lines = [...offerLines, ...extraLines]
  } else if (input.service) {
    lines = [toLine(input.service), ...extraLines]
  }
  const listTotal = sumPrice(lines)
  return {
    lines,
    totalPrice: input.offer ? round3(num(input.offer.price) + sumPrice(extraLines)) : listTotal,
    totalDuration: sumDuration(lines),
    listTotal,
    summary: lines.map((l) => l.name).join(' + '),
  }
}
