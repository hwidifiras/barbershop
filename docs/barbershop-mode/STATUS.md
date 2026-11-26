# Barbershop mode: status at a glance

Last updated: 2026-11-26 · Full plan: [`SPEC.md`](./SPEC.md) · Every change: [`CHANGELOG.md`](./CHANGELOG.md)

| Phase | What | State |
|---|---|---|
| 0 | Spec, mode switch (`isBarbershopMode`) | Done |
| 1 | Public booking link (3 screens, French, dark), barber photos, QR + links, online on/off | Done, live |
| 1b | Smart services: supplements, per-service online switch, offers | Done, live |
| 1c | No contradictions: "Inclut déjà", single-choice groups, supplements on offers | Done, live |
| 2 | Phone navigation bar + "Today" screen | Done, live (audit fixes merged, PR #10) |
| 3a | Client identity: one phone number = one client (normalised), search by name/number, rename | Done, live (migration 042 applied) |
| 3b | Booking-page hint + "Possédez-vous déjà un rendez-vous ?" | Done, live (no migration) |
| 3c | Phone Agenda (Jour / Semaine switch, swipe, barber filter, appointment sheet with actions) | Done, live (no migration) |
| 3d | Agenda: create an appointment from the phone ("Nouveau RDV") | Done, live (no migration) |
| 3e | Caisse (cash) with kridi (partial or no payment) | Done, live (migration 043 applied) |
| 3f | Clients on phone: balance, "Encaisser un paiement", "Effacer la dette", Kridi list, "Doit X DT" badge | Done, live (no migration) |
| 3g | Agenda: "Reporter" (postpone an appointment) from the phone | Done, live (no migration) |
| 4 | Settings reorganisation, onboarding presets, Products off by default | In review: 4a and 4b live, 4c (products, photos, mode switch) in review |
| 5 | Team access: barber logins and own schedule | Not started |
| 6 | Arabic / RTL, then extras | Not started |

## How to try what is live
1. Settings → Général → set **Type d'activité** to Barbershop, save, reload.
2. Settings → Général: link, QR code, barber links and photos, "Réservation en ligne", "Mode barbershop".
3. Open `/book/<slug>` on a phone.
4. Settings → Prestations (barbershops): types, "En ligne" switches, "Inclut déjà", single-choice groups, offers.
5. Phase 2: log in on a phone. Bottom bar, the "Aujourd'hui" screen, "Client sans RDV" (with supplements), "À clôturer" for past unfinished bookings.

## Rules we keep
- Barbershop changes only apply when `isBarbershopMode(business)`; other types stay on the standard SaaS.
- The server decides prices, durations and rules; the browser only displays them.
- Apply database migrations **before** deploying code that reads them.
- Each change adds an entry to `CHANGELOG.md` in the same pull request.
