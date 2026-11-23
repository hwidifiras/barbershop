# Barbershop mode: changelog

Every pull request that changes behaviour under [`SPEC.md`](./SPEC.md) adds an entry here
in the same PR. Newest first. Keep entries factual: what changed, which files, which
phase, how it was verified, and confirmation that non-barbershop types are unaffected.

## Entry template

```
### YYYY-MM-DD: short title (PR #N, phase X)
- **What changed:** …
- **Where:** files / routes
- **Barbershop vs standard:** how it differs; standard types unaffected because …
- **Data/migrations:** none | file name and what it does
- **Spec section(s):** 4.x
- **Verified:** tsc / check:i18n / tests / viewports checked
- **Notes / follow-ups:** …
```

## Log

### 2026-11-23: Phase 1b — smart services: supplements, online switch, offers (branch `feat/barbershop-smart-services`)
- **What changed:**
  - Services have a type (main / supplement) and, for supplements, "Réservable seul" (per supplement).
  - Per-service **En ligne** switch: hides the service from the public page and `/api/book` only; POS and calendar still show it; existing bookings unchanged.
  - **Offers**: package price for several services, optional period, all barbers or chosen barbers; shown with the regular price struck through.
  - Public booking page: offers section, optional "Ajouter un supplément ?" step with running total, price/duration summed, date strip respects an offer's period.
  - `/api/book` computes price, duration and all rules itself (`lib/barbershop-cart.ts`) and stores the lines.
  - Calendar and confirmation messages show the combined label; POS "Charger" loads all lines and the package discount.
  - Settings → Services (barbershops): new screen for all of the above.
- **Where:** `lib/barbershop-cart.ts`, `app/api/book/route.ts`, `app/api/email/confirm/route.ts`, `app/book/[slug]/{page,barber-booking}.tsx` + css, `components/settings/barbershop-services.tsx`, `app/(dashboard)/settings/{page,settings-tabs}.tsx`, `app/(dashboard)/booking/{page,booking-calendar}.tsx`, `app/(dashboard)/pos/{page,pos-terminal}.tsx`, `lib/barbershop-fr.ts`, `lib/supabase/database.types.ts`.
- **Barbershop vs standard:** all new behaviour is gated by `isBarbershopMode`. Standard types keep the unchanged booking form and Services tab; `/api/book` ignores `extraServiceIds`/`offerId` for them; calendar/POS/confirmation changes only act when a booking has the new fields (null for standard bookings).
- **Data/migrations:** `040_barbershop_services_offers.sql`: `services.kind/bookable_alone/bookable_online`, tables `offers` and `appointment_items` (RLS via `my_business_ids()` + explicit grants), `appointments.offer_id/items_summary`. Additive; defaults leave existing rows unchanged. **Apply before deploying.**
- **Spec section(s):** 4.12 (and a correction to 4.11 about the existing access rules)
- **Verified:** `tsc` clean; unit tests 87 pass (21 new for pricing/rules: supplements, alone/with-main, hidden services, offer period and barbers, three-decimal prices); `npm test` 14 pass incl. the grants rule for 040; `check:i18n` OK; lint 0 errors; full `next build` OK.
- **Notes / follow-ups:** reminder messages sent by the scheduled job still name only the main service (confirmation messages are updated). Chair emoji and "available barber" badge skipped by decision.


### 2026-11-23: Phase 1 — barbershop public booking link (branch `feat/barbershop-booking-link`)
- **What changed:**
  - New phone-first, dark, French-only booking page for barbershops: barber photo cards (or "Premier disponible") + services grouped by category on screen 1; swipeable 14-day strip, "Prochain créneau" shortcut and Matin/Après-midi/Soir slot groups on screen 2; name + phone only, summary and a sticky confirm button on screen 3; confirmation with add-to-calendar, Maps, call and WhatsApp.
  - Deep links `?b=<barberId>` and `?s=<serviceId>` on the public link.
  - "Any barber" now offers a time when at least one barber is free (availability is checked per barber).
  - Online-booking on/off switch (walk-in-only shops): the public page shows a "réservation en ligne indisponible" notice and `/api/book` refuses with 403.
  - Settings → General (barbershops only): booking link + copy, QR code (download), per-barber links, barber photo upload, online-booking switch, and the "Mode barbershop" escape-hatch switch (stays visible when the mode is off).
- **Where:** `app/book/[slug]/page.tsx` (branch), `app/book/[slug]/barber-booking.tsx` + `.module.css`, `lib/vertical.ts`, `lib/barbershop-slots.ts`, `lib/barbershop-theme.ts`, `lib/barbershop-fr.ts`, `app/api/book/route.ts` (flag check), `app/api/employees/[id]/avatar/route.ts`, `components/settings/barbershop-shop-card.tsx`, `app/(dashboard)/settings/{page,settings-tabs}.tsx`, `lib/supabase/database.types.ts`, `package.json` (`qrcode`).
- **Barbershop vs standard:** the branch is `isBarbershopMode(business)` (type `barbershop` unless `barbershop_mode` overrides). Every other type renders the unchanged `PublicBookingForm`; the settings card and the `/api/book` flag check apply only in barbershop mode. The existing `booking-form.tsx` is not edited.
- **Data/migrations:** `039_barbershop_mode.sql` adds `businesses.barbershop_mode boolean null` and `businesses.online_booking_enabled boolean not null default true` (additive, no new grants). Storage bucket `logos` (public, 2 MB) created in the production project; photos are stored under `<businessId>/barbers/`.
- **Spec section(s):** 3, 4.7 (partial), 4.9, 4.10 (dial 1), 8
- **Verified:** `tsc --noEmit` clean; `npm run test:unit` 66 pass (17 new: mode selection, slot maths incl. breaks, overlaps, timezone, lead time, any-barber union, day parts, accent colour); `npm test` 13 pass; `check:i18n` OK; full `next build` OK.
- **Notes / follow-ups:** apply migration 039 BEFORE deploying this code (the public page and `/api/book` select the new columns). Manual device checks still to be done (see PR description). Barber photos need the `logos` bucket. Per-barber hours/services and the walk-in button come in later phases.


### 2026-11-23: client answers recorded (phase 0, docs only)
- **What changed:** spec now covers the universal walk-in/appointment model (4.10), team-access foundations (4.11), French-only, cash-only, and RTL after team access; phases re-ordered (5 = team access, 6 = RTL and extras).
- **Where:** `docs/barbershop-mode/SPEC.md` (3, 4.4, 4.7, 4.9, 4.10, 4.11, 9, 11, 12)
- **Barbershop vs standard:** no code change.
- **Spec section(s):** as listed

### 2026-11-23: Products default recorded (phase 0, docs only)
- **What changed:** spec records that Products is off by default for barbershops and can be re-enabled.
- **Where:** `docs/barbershop-mode/SPEC.md` (4.6, 7, 12)
- **Barbershop vs standard:** no code change.
- **Spec section(s):** 4.6, 7, 12

### 2026-11-23: spec drafted (phase 0, docs only)
- **What changed:** added `docs/barbershop-mode/SPEC.md` and this changelog.
- **Where:** `docs/barbershop-mode/`
- **Barbershop vs standard:** no code changes; nothing user-visible.
- **Data/migrations:** none
- **Spec section(s):** all
- **Verified:** n/a (documentation)
- **Notes / follow-ups:** awaiting approval of the matrix in section 4 and answers to section 11.

### Context (already shipped, not part of this spec)
- #3 French localization (merged). #4 self-hosted fonts (open at time of writing; enables the barbershop display font without
  a build-time Google dependency).
