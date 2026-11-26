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

### 2026-11-27: Products screens, barber photos and mode switch (phase 4c)
- **What changed:** products list shows name, stock and price; new and edit product show name, price (and stock when new) first, the rest behind "Avancé". Barber photos and personal links moved to Barbiers; the "Mode barbershop" switch moved to Modules (when the mode is off it stays on General so it can be turned back on).
- **Where:** `app/(dashboard)/inventory/*`, `app/(dashboard)/settings/settings-tabs.tsx`, `components/settings/barbershop-shop-card.tsx`
- **Barbershop vs standard:** every change is behind `isBarbershopMode`; other types keep the same screens.
- **Data/migrations:** none
- **Spec section(s):** 4.6, 4.7
- **Verified:** `tsc --noEmit`, eslint, check:i18n, node and unit tests. Not checked in a browser or on a phone.

### 2026-11-27: Settings reorganised for barbershops (phase 4b)
- **What changed:** tabs are Salon, Barbiers, Prestations, Notifications, Modules, Facturation, Compte. Behind "Avancé": business email, timezone, currency, type, web address and notification language (Salon); role and email (Barbiers); email sending and Viber (Notifications), with WhatsApp and Telegram first. Modules gets a "Barbershop" preset.
- **Where:** `app/(dashboard)/settings/settings-tabs.tsx`, `lib/barbershop-settings.ts` (+ `tests/unit/barbershop-settings.spec.ts`), `lib/barbershop-fr.ts`
- **Barbershop vs standard:** every change is behind `isBarbershopMode`; other types keep the same order, classes and fields.
- **Data/migrations:** none
- **Spec section(s):** 4.7
- **Verified:** `tsc --noEmit`, eslint, check:i18n, node and unit tests. Not checked in a browser or on a phone.
- **Notes / follow-ups:** barber photos and personal links are still on the Salon tab, and the "Mode barbershop" switch is still in the Salon card; the spec places them under Barbiers and Modules.

### 2026-11-27: barbershop onboarding presets, Products off by default (phase 4a)
- **What changed:** when Barbershop is picked at signup, step 2 offers five starter services to tick (editable price and duration) and asks "Vendez-vous des produits ?". Finishing sets the modules (Products only if answered yes), hours Tuesday to Saturday 09:00-19:00, French notifications, currency TND and timezone Africa/Tunis.
- **Where:** `app/onboarding/*`, `lib/barbershop-onboarding.ts` (+ `tests/unit/barbershop-onboarding.spec.ts`), `lib/barbershop-fr.ts`
- **Barbershop vs standard:** only when the picked type is barbershop and the shop is not yet onboarded; other types keep the single blank service form, and existing shops are not changed.
- **Data/migrations:** none
- **Spec section(s):** 4.8, 4.6, 7
- **Verified:** `tsc --noEmit`, eslint, check:i18n, node and unit tests. Not checked in a browser or on a phone.
- **Notes / follow-ups:** starter prices are placeholders. Currency and timezone are changeable in Settings.

### 2026-11-26: STATUS.md corrected
- **What changed:** 3f is live (PR #18), Reporter added as 3g (PR #21), phases 4, 5 and 6 marked not started (they were listed as "In review").
- **Where:** `docs/barbershop-mode/STATUS.md`
- **Barbershop vs standard:** documentation only.
- **Data/migrations:** none

### 2026-11-26: labelled "Modifier" button on the client page (restores PR #12)
- **What changed:** in barbershop mode the client page shows a labelled **Modifier** button (name, number, notes) instead of only a small pencil icon that was hard to find on a phone.
- **Where:** `app/(dashboard)/crm/[id]/client-detail-view.tsx`, `lib/barbershop-fr.ts`
- **Barbershop vs standard:** gated by the existing `barbershop` prop; other types keep the pencil icon.
- **Data/migrations:** none
- **Spec section(s):** 4.5
- **Verified:** `tsc --noEmit`, eslint, check:i18n, unit tests. Not checked on a phone.

### 2026-11-24: Reporter (postpone) an appointment from the phone Agenda
- **What changed:** a "Reporter" button in the appointment sheet (pending / confirmed only). It opens a sheet: day (next 21 days), barber, a free time. The appointment keeps its client, services, price and length; start, end and barber change. The Agenda then jumps to the new day. Existing 24h / 1h reminder log entries for that appointment are cleared so the new time gets its own reminders. The client is not messaged automatically.
- **Where:** `app/(dashboard)/booking/postpone-sheet.tsx` (new), `agenda-view.tsx`, `lib/barbershop-fr.ts`.
- **Barbershop vs standard:** only in the barbershop phone Agenda; the desktop calendar is unchanged.
- **Data/migrations:** none (the existing slot trigger also checks updates).
- **Verified:** tsc, eslint, check:i18n, 141 unit tests.
- **Notes / follow-ups:** optional WhatsApp/email to the client about the new time; the Today screen's next-client card has no Reporter button yet.

### 2026-11-24: Caisse pilot hardening (after tracing booking to payment in code)
- **What changed:** (1) the Caisse opens on the cart/total when started from an appointment (it opened on the service grid); (2) the sale is linked to its appointment (`transactions.appointment_id`) and the Caisse refuses an appointment that is already paid, cancelled or absent (no double charge from a back button); (3) the appointment's client is always in the client picker (the list is capped at 200); (4) a client who owes cannot be deleted (the ledger would be deleted with them); (5) "Doit X DT" shows in the Agenda list and appointment sheet; (6) the two English leftovers in the barbershop Caisse ("Sales history", "Skip") are French.
- **Where:** `pos/page.tsx`, `pos/pos-terminal.tsx`, `crm/[id]/*`, `booking/barber-agenda.tsx`, `booking/agenda-view.tsx`, `lib/barbershop-fr.ts`.
- **Barbershop vs standard:** all behind the barbershop check (appointment link, guard and picker fix included); other types unchanged.
- **Data/migrations:** none.
- **Verified:** tsc, eslint, check:i18n, 141 unit tests.
- **Notes / follow-ups:** client picker has no search by number; a fully-kridi sale marks the appointment "Payé"; `transactions.amount` keeps 2 decimals while the ledger keeps 3.

### 2026-11-24: Clients and Kridi list (phase 3f)
- **What changed:** a client's page shows the kridi balance, "Encaisser un paiement" (partial allowed, capped at the balance), "Effacer la dette" (with a confirmation) and the last entries. Clients has a Tous / Kridi switch: the Kridi list shows who owes what (biggest first, then oldest), with Call and WhatsApp; the normal list shows "Doit X DT" next to a debtor. The Today revenue tile now counts sales' received money plus repayments, and shows "Kridi donné : X" when kridi was given that day.
- **Where:** `app/(dashboard)/crm/[id]/kridi-panel.tsx` (new), `crm/[id]/page.tsx`, `crm/page.tsx`, `dashboard/barber-today.tsx`, `dashboard/today-view.tsx`, `lib/barbershop-fr.ts`.
- **Barbershop vs standard:** every change is behind the barbershop check; other business types render exactly as before.
- **Data/migrations:** none (uses `client_ledger` from 043).
- **Spec section(s):** 4.13
- **Verified:** tsc, eslint, check:i18n, 141 unit tests.
- **Notes / follow-ups:** phase 5: only the owner may forgive debt (roles). The Clients list is still a table; a phone card list is a later step.

### 2026-11-24: Caisse with kridi (phase 3e)
- **What changed:** in barbershop mode the POS is cash only (card/transfer hidden). For a client with a name and a number, a "Montant reçu" field (default = the total) lets the barber take less; the rest becomes kridi, and "Tout en kridi" sets the received amount to 0. The client's existing debt shows as "Doit X DT". `transactions.amount` stays "money really received" and the full price stays in `items`, so the day's takings only count cash in hand. Kridi needs a connection (hidden offline). If the kridi line cannot be saved, the sale is removed so nothing is half-recorded.
- **Where:** `app/(dashboard)/pos/pos-terminal.tsx`, `lib/kridi.ts` (+ `tests/unit/kridi.spec.ts`), `lib/barbershop-fr.ts`, `lib/supabase/database.types.ts`.
- **Barbershop vs standard:** all changes are behind the `barbershop` prop; other business types keep every payment method and no kridi.
- **Data/migrations:** `043_client_ledger.sql`: new table `client_ledger` (credit / payment / writeoff per client, tenant RLS). Additive only.
- **Spec section(s):** 4.13 (kridi)
- **Verified:** tsc, eslint (only pre-existing warnings), check:i18n, 141 unit tests.
- **Notes / follow-ups:** repaying and forgiving a debt, and the Kridi list, come in 3f (Clients). Until then debt can be created and seen in the Caisse only.

### 2026-11-24: Create an appointment from the phone Agenda (phase 3d)
- **What changed:** a "Nouveau RDV" button on the Agenda day view opens a sheet: service (+ supplements), barber, a free time (same slot rules as the public page, past times hidden), and the client by phone number. A known number brings back the existing client (name shown, not duplicated); a new number plus name creates one. The appointment is `confirmed`, source `manual`, with the price and `appointment_items` like a walk-in.
- **Where:** `app/(dashboard)/booking/new-appointment-sheet.tsx` (new), `agenda-view.tsx`, `barber-agenda.tsx` (also loads services and opening hours), `lib/barbershop-fr.ts`.
- **Barbershop vs standard:** only inside the barbershop phone Agenda; the desktop calendar and other business types are untouched.
- **Data/migrations:** none (the database's slot check still prevents double booking).
- **Spec section(s):** 4.3, 4.5
- **Verified:** tsc, eslint, check:i18n, 132 unit tests.
- **Notes / follow-ups:** moving or postponing an appointment ("Reporter") is not built. STATUS.md: 3c set to live.

### 2026-11-24: Agenda, Jour / Semaine switch (phase 3, part 1 follow-up)
- **What changed:** the phone Agenda has a **Jour | Semaine** switch at the top. **Semaine** is a week list (Monday to Sunday): one row per day with the number of appointments, the first three (time and client name), "+N autres", "Fermé" or "Libre"; today is outlined. Previous/next week by arrows or swipe, "Cette semaine" to come back, and the barber filter applies. Tapping a day opens it in the **Jour** view. Switching back to Jour opens today (or the first day of the week shown). The address is `/booking?v=week&d=YYYY-MM-DD`.
- **Where:** `app/(dashboard)/booking/agenda-view.tsx`, `barber-agenda.tsx`, `page.tsx`, `lib/barbershop-today.ts` (`weekStartYmd`), `lib/barbershop-fr.ts`
- **Barbershop vs standard:** phone barbershop Agenda only; computers keep the existing week table and other business types are unchanged.
- **Data/migrations:** none.
- **Spec section(s):** 4.3
- **Verified:** `tsc --noEmit`, eslint 0 errors, `test:unit` 132 pass (1 new), full `next build` run. Not tested on a phone.
- **Notes:** chosen by the owner over a sideways-scrolling full week table (hard to read and tap on a phone).

### 2026-11-24: phone Agenda, day view (phase 3, part 1: Agenda)
- **What changed:** in barbershop mode, `/booking` shows on phones (below `md`) a **day agenda**: one day as a vertical list (start/end time, client, services, barber, status), previous/next day by arrows or swipe, an "Aujourd'hui" button, a barber filter (chips), "Fermé ce jour" on closed days and a "Voir les annulés" toggle. Tapping an appointment opens a bottom sheet with its details and the actions **Terminé**, **Encaisser** (opens the Caisse with the booking, client, service and barber prefilled), **Confirmer** (pending only), **Absent**, **Annuler**, plus **Appeler** and **WhatsApp** for the client. Past days work too; bookings past their end time show "À clôturer". The screen refreshes every minute and when the app comes back to the front. The date is the `?d=YYYY-MM-DD` parameter (shareable, default today).
- **Where:** `app/(dashboard)/booking/page.tsx`, `barber-agenda.tsx` (server), `agenda-view.tsx` (client), `lib/barbershop-today.ts` (`isYmd`, `addDaysYmd`), `lib/phone.ts` (`whatsappNumber`), `lib/barbershop-fr.ts`
- **Barbershop vs standard:** gated by `isBarbershopMode`; from `md` up barbershops keep the existing week calendar, and every other business type keeps the calendar on all screen sizes, unchanged.
- **Data/migrations:** none (existing `appointments`, `employees`, `business_hours`).
- **Spec section(s):** 4.3 (day agenda, barber filter, detail sheet with status actions and Charge)
- **Verified:** `tsc --noEmit`, eslint 0 errors, `test:unit` 131 pass (3 new), full `next build` OK. Not tested on a phone.
- **Not in this PR (next, part 1b):** creating an appointment from the agenda (bottom sheet: client by number, service, barber, free time) and "Reporter" (parked idea). Then Caisse with kridi, then Clients.

### 2026-11-24: "do I already have an appointment?" on the booking page (phase 3b)
- **What changed:** on the public barbershop booking page, (1) as soon as the visitor has typed the **8th digit** of their number (any spelling, or a complete international number) a notice appears under the phone field, "Vous avez déjà un rendez-vous cette semaine", with no button to press; tapping it shows the day, time and barber; (2) a link **"Possédez-vous déjà un rendez-vous ?"** at the top right opens a sheet where the visitor enters only their number and sees their appointment(s) for the week. Only upcoming (not past), pending or confirmed appointments in the next 7 days count. It never blocks a booking.
- **Privacy rules:** the new endpoint `POST /api/book/lookup` returns only the start time and barber name of the number's own upcoming appointments (max 3): no client name, service, price or contact details. An unknown number and a number with nothing booked answer the same way. Rate limited to 20 calls / 10 min per IP and 10 calls / 10 min per number. Barbershop mode only (404 otherwise).
- **Where:** `app/api/book/lookup/route.ts`, `app/book/[slug]/my-appointments.tsx`, `barber-booking.tsx` and `.module.css`, `lib/phone.ts` (`lookupKey`), `lib/barbershop-fr.ts`
- **Barbershop vs standard:** barbershop booking page and endpoint only; the standard booking page is untouched.
- **Data/migrations:** none (uses `clients.phone_key` from migration 042).
- **Spec section(s):** 4.9, 4.5
- **Verified:** `tsc --noEmit`, eslint 0 errors, `test:unit` 128 pass (2 new for `lookupKey`), full `next build` OK. Not tested on a phone.
- **Notes / follow-ups:** the rate limiter is per server instance (see `lib/rate-limit.ts`), so it is a brake, not a hard cap.

### 2026-11-24: client identity = normalised phone number (phase 3 prep)
- **What changed:** one phone number = one client. New `lib/phone.ts` (`normalizePhone`, `samePhone`, `formatPhone`) turns every spelling (`50 300 200`, `503 00 200`, `+216 50 300 200`, `21650300200`, `0021650300200`) into `50300200`. Online booking, the walk-in sheet, POS "save as client" and the new-client form now find the client by that key and reuse the record instead of creating a duplicate (the new-client form shows "Ce numéro appartient déjà à …" with a link). In the client page, changing a number to one used by another client is refused. A booking no longer overwrites the name the barber stored. The Clients search finds a client by name or any part (3+ digits) of the number in any spelling, and shows numbers as `50 300 200`.
- **Where:** `lib/phone.ts`, `lib/client-identity.ts`, `app/api/book/route.ts`, `app/(dashboard)/dashboard/today-view.tsx`, `app/(dashboard)/pos/*`, `app/(dashboard)/crm/page.tsx`, `crm/new/*`, `crm/[id]/*`, `lib/barbershop-fr.ts`, `lib/supabase/database.types.ts`
- **Barbershop vs standard:** every behaviour change is gated by `isBarbershopMode`; other business types keep exact-text phone matching and the booking name update. The only shared change is the Clients search no longer breaks on `,` `(` `)` `%` `*` characters in the search box.
- **Data/migrations:** `042_client_phone_key.sql` adds the function `normalize_phone(text)` and a computed, indexed column `clients.phone_key`. Additive only: no existing phone or client is modified or merged; the index is not unique because a shop may already hold duplicates. **Apply before deploying this code** (the code selects `phone_key`).
- **Spec section(s):** 4.5
- **Verified:** `tsc --noEmit` clean; eslint 0 errors; `npm run test:unit` 126 pass (6 new for the normaliser); `npm test` 16 pass; `check:i18n` OK. The SQL function was run on a throwaway local Postgres 16 with 14 spellings and gives the same keys as the TypeScript version.
- **Notes / follow-ups:** CSV import (hidden in barbershop mode) still dedups on exact text. Duplicates that already exist are not merged (manual merge to come). Next: the "you already have an appointment this week" hint on the booking page and the "Possédez-vous déjà un rendez-vous ?" lookup (needs a rate-limited public endpoint and the privacy rules agreed with the owner).

### 2026-11-23: Audit fixes for phase 2 (branch `fix/barbershop-today-audit`)
- **What changed:**
  1. **Auto-refresh:** the Today list re-syncs when the server sends new data, and refreshes every minute and on returning to the tab (not while the barber is saving). Online bookings and changes from another phone now appear without reloading.
  2. **Overdue bookings:** unfinished bookings whose time has passed show **À clôturer**, leave the "restants" count, and a banner opens the first one; the tile and the next-client card no longer contradict each other.
  3. **Walk-ins with supplements:** the walk-in sheet offers supplements with the booking page's rules ("Inclus", single-choice groups), saves price, duration and `appointment_items`, and the estimate uses the total duration. If the lines cannot be saved the booking is deleted so no under-priced booking is left behind.
  4. **Empty state:** with no services the walk-in sheet explains and links to Settings → Prestations.
  - Smaller: cancelled bookings hidden behind "Voir les annulés (n)"; Escape closes the walk-in sheet and the "Plus" menu; the status page no longer says phase 2 is "in review".
- **Where:** `app/(dashboard)/dashboard/{today-view,barber-today}.tsx`, `components/layout/barber-shell.tsx`, `lib/barbershop-today.ts` (`isOverdue`, `countDoneRemaining(..., nowMs)`), `lib/barbershop-fr.ts`.
- **Barbershop vs standard:** barbershop mode only; no change for other business types.
- **Data/migrations:** none.
- **Spec section(s):** 4.2 (new rows and decisions-log entry)
- **Verified:** `tsc` clean; unit tests 120 pass (2 new for overdue counting); `npm test` 15 pass; `check:i18n` OK; lint 0 errors; full `next build` OK. **21 checks in headless Chrome at 390 px** with a temporary preview page (not committed): overdue banner and labels, counts, cancelled toggle, auto-refresh with no page reload, walk-in supplements (included item, single-choice replacement, total 115 TND / 100 min), Escape on both sheets, no-services hint and link, no sideways scroll, no script errors.
- **Notes / follow-ups:** component-level automated tests are still missing (only the calculation helpers are unit-tested; the screens are checked in a browser). Phase 3 (Agenda, Caisse, Clients) next.


### 2026-11-23: Phase 2 — phone navigation bar and "Today" screen (branch `feat/barbershop-today-shell`)
- **What changed:**
  - **Shell:** bottom tab bar on phones (Aujourd'hui · Agenda · Caisse · Clients · Plus) with a slim top bar; relabelled dark sidebar on desktop (adds Produits when the module is on); "Plus" sheet with Produits, Partager mon lien, Réglages, Se déconnecter. The dashboard language is switched to French once and the switcher is hidden.
  - **Today** replaces the dashboard for barbershops: barber filter chips; strip with done/remaining and the day's revenue; low-stock chip (only when Products is on and something is low); **next-client card** (En cours / countdown) with Terminé, Encaisser (opens the POS prefilled) and Absent; the day's timeline with tap-to-expand actions; **Client sans RDV** button and sheet (service, barber or first free, optional name/phone, next free time shown, booked as a normal appointment); a "Pour bien démarrer" checklist (barbers, hours, link); and the booking-link card.
  - Booking page: barber name cards are wider (long names no longer split mid-word), the supplements screen label says "+ 2 suppl.", and an included supplement no longer says "Inclus" twice.
- **Where:** `components/layout/barber-shell.tsx`, `app/(dashboard)/layout.tsx`, `app/(dashboard)/dashboard/{page,barber-today,today-view}.tsx`, `lib/barbershop-today.ts`, `lib/barbershop-fr.ts`, `app/book/[slug]/barber-booking.{tsx,module.css}`.
- **Barbershop vs standard:** `layout.tsx` and `dashboard/page.tsx` branch on `isBarbershopMode`; every other type keeps the existing sidebar and dashboard unchanged.
- **Data/migrations:** none. Walk-ins and status changes use existing tables (`appointments`, `clients`).
- **Spec section(s):** 4.1, 4.2 (and the decisions log)
- **Verified:** `tsc` clean; unit tests 118 pass (17 new for the shop's local day incl. daylight saving, next appointment, counts, next free time); `npm test` 15 pass; `check:i18n` OK; lint 0 errors; full `next build` OK. **Also checked in a real browser at 390 px and 1280 px** with a temporary preview page (not committed): no sideways scrolling, no script errors, walk-in estimate correct (11:10 → 11:30 with the free barber), and the supplement rules (Inclus, single-choice group, totals) behave on screen.
- **Notes / follow-ups:** "Plus" does not yet show the small Pronto mark. Reminder messages still name only the main service. The Calendar, Caisse and Clients screens keep their current layouts until phase 3.


### 2026-11-23: Phase 1c — no contradictions between services (branch `feat/barbershop-service-conflicts`)
- **What changed:**
  - **Inclut déjà** on a main service: its supplements show as "Inclus ✓" and cannot be added again; the service card on the booking page says "Inclut : barbe".
  - **Un seul choix avec** (group) on supplements: only one per group (tapping another replaces it); independent supplements combine freely.
  - **Supplements on top of an offer** (package price + extras); items already in or included by the offer cannot be added.
  - Settings → Prestations: chips for "Inclut déjà", a group selector for supplements, badges in the list, and a duplicate-name warning.
  - `/api/book` enforces the rules (`supplement_included`, `supplement_conflict`) in addition to the screen.
- **Where:** `lib/barbershop-cart.ts` (rules + `includedIdsOf`, `addOnsFor`, `toggleAddOn`), `app/api/book/route.ts`, `app/book/[slug]/{page,barber-booking}.tsx` + css, `components/settings/barbershop-services.tsx`, `app/(dashboard)/settings/{page,settings-tabs}.tsx`, `lib/barbershop-fr.ts`, `lib/supabase/database.types.ts`.
- **Barbershop vs standard:** barbershop mode only; the two new fields default to "none", so existing services behave exactly as before.
- **Data/migrations:** `041_service_includes_and_groups.sql`: `services.includes uuid[] default '{}'`, `services.exclusive_group text`. Additive. **Apply before deploying.**
- **Spec section(s):** 4.12 (rules, offers)
- **Verified:** `tsc` clean; unit tests 101 pass (14 new for includes, groups, offer + supplements, toggle behaviour); `npm test` 15 pass; `check:i18n` OK; lint 0 errors; full `next build` OK.
- **Notes / follow-ups:** "Inclut" names only services that are online-bookable. Scheduled reminders still name only the main service.


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
