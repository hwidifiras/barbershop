# Barbershop mode: handoff (2026-11-27)

Read this first, then [`SPEC.md`](./SPEC.md), [`STATUS.md`](./STATUS.md) and [`CHANGELOG.md`](./CHANGELOG.md).

## 1. Done and live
`main` is at #32. The production Vercel project is **`barbershop-nqnu`** (we-discipline.com); ignore the `barbershop` project. Database: Supabase project `barber-managment`, migrations up to 043 applied.

| Area | What | PRs |
|---|---|---|
| Foundations, public booking | Spec, mode switch, booking link and QR, supplements, offers, no contradicting services | #5-#8 |
| Today, phone navigation | Bottom bar, next client, walk-ins | #9, #10 |
| Clients, booking page, Agenda | One phone = one client, existing-appointment lookup, day/week agenda, create from phone | #11-#16 |
| Caisse and kridi | Cash sales, partial or no payment, balances and repayments | #17-#20 |
| Postpone, client edit | "Reporter", "Modifier" button | #21, #22 |
| Phase 4 | Onboarding presets, settings reorganised, simpler Products | #24-#26 |
| Sign-in fixes | Redirect loop and first-visit error for accounts without a business | #27, #28 |
| Phone polish | Client cards, short new-client form, cut notes, postpone WhatsApp message, Caisse tiles/chips/search/history | #29-#31 |
| Reminders | One-tap WhatsApp "Rappels pour demain" on Today | #32 |

## 2. Live but not yet checked on a phone
Only "Reporter" has been confirmed by the owner. Still to check: #29-#32 and phase 4.
For #32: book for tomorrow with your own number, tap WhatsApp, reload Today; "Ouvert" must stay. Move the appointment; the WhatsApp button must come back. Saving that mark was never tested against the real database.

## 3. Planned, not built (suggested order; the owner sets priorities)
1. Phone tests above.
2. **Live client queue** (section 4): needs approval, then a spec entry.
3. Merge duplicate clients. Waiting for the rules. Proposal: the owner picks the record to keep, all visits and debts move to it, the confirmation shows both balances.
4. Limit online booking by hours or a daily number (SPEC 4.10, dial 2). Needs a database change; the owner chooses which limit.
5. Automatic reminders. Needs a scheduler, a verified WhatsApp Business account with an approved French template, template sending, `+216` numbers from `clients.phone`, and logging only after a successful send. The same job also sends thank-you, birthday and reactivation messages, so they need their own switches.
6. Caisse leftovers: cart as a bottom sheet; preselect the logged-in barber (needs phase 5).
7. Phase 5: barber logins. Write the design for approval before building (see SPEC 4.11).
8. Phase 6: Arabic / right-to-left, then extras.

## 4. Last discussion: live client queue (new request, not approved yet)
**Request:** an option the owner turns on in Settings. A client enters their phone number and sees how many clients are before them and whether their turn will come earlier or later than booked. It updates when the barber marks a client "Terminé".

**Proposed assumptions (not yet confirmed):**
- Off by default; per barber; today only; bookings and walk-ins added by the barber.
- The client sees a count and an estimated time, never other people's names.
- The page refreshes itself; no message is sent.
- "Paid" and "absent" also move the queue.
- The estimate is only as good as the barber's taps.

**Open question:** do clients only view their place, or can they also join the line from their phone without a booked time? Suggestion: view only first.

Not in `SPEC.md` yet. Related: walk-in "next free time" (SPEC 4.10) and the existing lookup `POST /api/book/lookup` (a number's own upcoming appointments). Turning the option on will need a new business setting (database change).

## 5. Known issues
- The production project has no email provider and no WhatsApp keys, so the app's booking confirmation emails are not sent (the code treats them as sent). Signup confirmation emails are a separate matter the owner chose to leave.
- No scheduler runs `/api/cron/notify`.
- GitHub Actions "Lint & Build" fails for an account reason, not the code; use the Vercel build as the check.
- PRs #1 and #2 are still open and probably stale.
- `STATUS.md` does not yet list #27-#32.

## 6. How we work
- Claude opens the pull requests; **merging only on the owner's word** (every merge deploys the live site).
- Database changes need the owner's OK and are applied **before** the code that reads them.
- Each behaviour change adds a `CHANGELOG.md` entry in the same PR.
- Barbershop changes stay behind `isBarbershopMode(business)`; the interface is French (`lib/barbershop-fr.ts`).
- Checks: `npx tsc --noEmit`, `npm run check:i18n`, `npm test`, `npm run test:unit` (set `TELEGRAM_WEBHOOK_SECRET` to any value).

## 7. On the new computer
Clone the repository, sign in yourself to GitHub (`gh auth login`), Vercel and Supabase, and set your own git name and email. Chat history and Claude's memory do not move with you, so start with:

> Read docs/barbershop-mode/HANDOFF.md, compare it with git and the open pull requests, then ask me what to do next.
