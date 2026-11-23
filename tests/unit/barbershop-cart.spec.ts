import { describe, it, expect } from 'vitest'
import {
  resolveBooking, isOfferValidOn, offerBarberIds, startingServices, addOnServices, pickBarberFor, previewSelection,
  type CartService, type CartOffer,
} from '@/lib/barbershop-cart'

const svc = (o: Partial<CartService> & { id: string }): CartService => ({
  name: o.id, price: 10, duration_min: 30, kind: 'main', bookable_alone: false, bookable_online: true, is_active: true, ...o,
})
const cut = svc({ id: 'cut', name: 'Coupe', price: 100, duration_min: 30 })
const beard = svc({ id: 'beard', name: 'Barbe', price: 60, duration_min: 20 })
const wax = svc({ id: 'wax', name: 'Cire', price: 15, duration_min: 5, kind: 'supplement' })
const lineup = svc({ id: 'lineup', name: 'Contour', price: 20, duration_min: 10, kind: 'supplement', bookable_alone: true })
const hidden = svc({ id: 'hidden', name: 'Masque', bookable_online: false })
const off = svc({ id: 'off', name: 'Off', is_active: false })
const services = [cut, beard, wax, lineup, hidden, off]

const offer = (o: Partial<CartOffer> = {}): CartOffer => ({
  id: 'o1', name: 'Forfait', price: 120, service_ids: ['cut', 'beard'], barber_ids: null, valid_from: null, valid_to: null, is_active: true, ...o,
})
const base = { date: '2026-11-25', services, offers: [offer()] }

describe('service lists', () => {
  it('starting list = main services + supplements bookable alone, never hidden/inactive', () => {
    expect(startingServices(services).map((s) => s.id).sort()).toEqual(['beard', 'cut', 'lineup'])
  })
  it('add-ons = online supplements only', () => {
    expect(addOnServices(services).map((s) => s.id).sort()).toEqual(['lineup', 'wax'])
  })
})

describe('resolveBooking: service + supplements', () => {
  it('main service alone', () => {
    const r = resolveBooking({ ...base, serviceId: 'cut' })
    expect(r).toMatchObject({ ok: true, totalPrice: 100, totalDuration: 30, listTotal: 100, offerId: null, summary: 'Coupe' })
  })
  it('adds supplements: price, duration and summary are summed', () => {
    const r = resolveBooking({ ...base, serviceId: 'cut', extraServiceIds: ['wax', 'lineup'] })
    expect(r).toMatchObject({ ok: true, totalPrice: 135, totalDuration: 45, summary: 'Coupe + Cire + Contour' })
  })
  it('ignores duplicate extras', () => {
    const r = resolveBooking({ ...base, serviceId: 'cut', extraServiceIds: ['wax', 'wax'] })
    expect(r).toMatchObject({ ok: true, totalPrice: 115 })
  })
  it('a supplement cannot be booked alone unless allowed', () => {
    expect(resolveBooking({ ...base, serviceId: 'wax' })).toEqual({ ok: false, error: 'supplement_requires_main' })
    expect(resolveBooking({ ...base, serviceId: 'lineup' })).toMatchObject({ ok: true, totalPrice: 20 })
  })
  it('a standalone supplement cannot carry extras', () => {
    expect(resolveBooking({ ...base, serviceId: 'lineup', extraServiceIds: ['wax'] })).toEqual({ ok: false, error: 'supplement_requires_main' })
  })
  it('extras must be supplements', () => {
    expect(resolveBooking({ ...base, serviceId: 'cut', extraServiceIds: ['beard'] })).toEqual({ ok: false, error: 'invalid_supplement' })
    expect(resolveBooking({ ...base, serviceId: 'cut', extraServiceIds: ['nope'] })).toEqual({ ok: false, error: 'invalid_supplement' })
  })
  it('switched-off-online and inactive services cannot be booked online', () => {
    expect(resolveBooking({ ...base, serviceId: 'hidden' })).toEqual({ ok: false, error: 'service_unavailable' })
    expect(resolveBooking({ ...base, serviceId: 'off' })).toEqual({ ok: false, error: 'service_unavailable' })
    expect(resolveBooking({ ...base, serviceId: 'missing' })).toEqual({ ok: false, error: 'service_unavailable' })
  })
})

describe('resolveBooking: offers', () => {
  it('uses the package price and sums the durations; list total is the regular sum', () => {
    const r = resolveBooking({ ...base, serviceId: 'cut', offerId: 'o1' })
    expect(r).toMatchObject({ ok: true, totalPrice: 120, listTotal: 160, totalDuration: 50, offerId: 'o1' })
    if (r.ok) expect(r.lines.map((l) => l.service_id)).toEqual(['cut', 'beard'])
  })
  it('ignores extras when an offer is booked', () => {
    const r = resolveBooking({ ...base, serviceId: 'cut', offerId: 'o1', extraServiceIds: ['wax'] })
    expect(r).toMatchObject({ ok: true, totalPrice: 120, totalDuration: 50 })
  })
  it('respects the validity period on the visit date', () => {
    const o = offer({ valid_from: '2026-11-20', valid_to: '2026-11-30' })
    expect(resolveBooking({ ...base, offers: [o], serviceId: 'cut', offerId: 'o1', date: '2026-11-25' }).ok).toBe(true)
    expect(resolveBooking({ ...base, offers: [o], serviceId: 'cut', offerId: 'o1', date: '2026-12-01' })).toEqual({ ok: false, error: 'offer_not_valid_on_date' })
    expect(resolveBooking({ ...base, offers: [o], serviceId: 'cut', offerId: 'o1', date: '2026-11-19' })).toEqual({ ok: false, error: 'offer_not_valid_on_date' })
  })
  it('is unavailable when inactive, unknown, or one of its services is hidden', () => {
    expect(resolveBooking({ ...base, offers: [offer({ is_active: false })], serviceId: 'cut', offerId: 'o1' })).toEqual({ ok: false, error: 'offer_unavailable' })
    expect(resolveBooking({ ...base, serviceId: 'cut', offerId: 'zzz' })).toEqual({ ok: false, error: 'offer_unavailable' })
    expect(resolveBooking({ ...base, offers: [offer({ service_ids: ['cut', 'hidden'] })], serviceId: 'cut', offerId: 'o1' })).toEqual({ ok: false, error: 'offer_unavailable' })
  })
  it('limited to some barbers: needs one of them', () => {
    const o = offer({ barber_ids: ['b1'] })
    expect(resolveBooking({ ...base, offers: [o], serviceId: 'cut', offerId: 'o1' })).toEqual({ ok: false, error: 'offer_barber_not_allowed' })
    expect(resolveBooking({ ...base, offers: [o], serviceId: 'cut', offerId: 'o1', employeeId: 'b2' })).toEqual({ ok: false, error: 'offer_barber_not_allowed' })
    expect(resolveBooking({ ...base, offers: [o], serviceId: 'cut', offerId: 'o1', employeeId: 'b1' }).ok).toBe(true)
  })
  it('three-decimal prices stay exact (TND)', () => {
    const s = svc({ id: 'x', price: 12.75 }); const y = svc({ id: 'y', price: 5.125, kind: 'supplement' })
    const r = resolveBooking({ ...base, services: [s, y], serviceId: 'x', extraServiceIds: ['y'] })
    expect(r).toMatchObject({ ok: true, totalPrice: 17.875 })
  })
})

describe('isOfferValidOn / offerBarberIds / pickBarberFor', () => {
  it('open-ended periods', () => {
    expect(isOfferValidOn({ is_active: true, valid_from: null, valid_to: null }, '2030-01-01')).toBe(true)
    expect(isOfferValidOn({ is_active: true, valid_from: '2026-12-01', valid_to: null }, '2026-11-30')).toBe(false)
    expect(isOfferValidOn({ is_active: false, valid_from: null, valid_to: null }, '2026-11-30')).toBe(false)
  })
  it('null or empty barber list means every barber', () => {
    expect(offerBarberIds({ barber_ids: null }, ['a', 'b'])).toEqual(['a', 'b'])
    expect(offerBarberIds({ barber_ids: [] }, ['a', 'b'])).toEqual(['a', 'b'])
    expect(offerBarberIds({ barber_ids: ['b', 'zzz'] }, ['a', 'b'])).toEqual(['b'])
  })
  it('picks the first allowed barber who is free', () => {
    expect(pickBarberFor('10:00', { a: ['09:00'], b: ['10:00'] }, ['a', 'b'])).toBe('b')
    expect(pickBarberFor('11:00', { a: ['09:00'], b: ['10:00'] }, ['a', 'b'])).toBeNull()
  })
})

describe('previewSelection', () => {
  it('service with extras', () => {
    const p = previewSelection({ service: cut, extras: [wax], offer: null, services })
    expect(p).toMatchObject({ totalPrice: 115, listTotal: 115, totalDuration: 35, summary: 'Coupe + Cire' })
  })
  it('offer shows the package price against the regular total', () => {
    const p = previewSelection({ service: cut, extras: [], offer: offer(), services })
    expect(p).toMatchObject({ totalPrice: 120, listTotal: 160, totalDuration: 50, summary: 'Coupe + Barbe' })
  })
  it('nothing picked yet', () => {
    expect(previewSelection({ service: null, extras: [], offer: null, services })).toMatchObject({ lines: [], totalPrice: 0, totalDuration: 0 })
  })
})
