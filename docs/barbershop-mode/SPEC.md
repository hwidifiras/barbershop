# Barbershop mode: product spec

Status: **approved; phases 0-4 live** (see [`STATUS.md`](./STATUS.md) for what is built)
Owner: product (hwidifiras) · Last updated: 2026-11-27
Companion file: [`CHANGELOG.md`](./CHANGELOG.md), the log of every change shipped under this spec.

---

## 1. Goal

When a business picks **Barbershop** during onboarding (or in Settings → General → Type), it
gets a **phone-first, modern, simpler** version of the app built for a barber standing
behind a chair, plus a **fast booking link** a client opens from an Instagram bio or a QR
code.

Every other business type (`salon`, `auto_repair`, `cafe`, `dental`, `fitness`, `massage`,
`other`) keeps **exactly today's SaaS experience**. Nothing in this spec may change what
they see or how they work.

### Non-negotiable rules

1. **Isolation.** Barbershop behaviour is selected by `businesses.type === 'barbershop'`.
   A non-barbershop business must render byte-for-byte the same screens as today.
2. **Same data, different presentation.** Barbershop mode reuses the existing tables,
   queries, API routes and business logic (booking, atomic slot allocation, POS,
   notifications). New UI wraps them; it does not fork them. New tables or columns are
   allowed only where listed in section 8.
3. **Escape hatch.** Settings has a "Barbershop mode" switch (default ON for type
   barbershop). Turning it off restores the standard layout for that shop.
4. **Documented.** Every change is added to `CHANGELOG.md` in the same pull request that
   makes it, and the matrix in section 4 is updated if a decision changes.
5. **No regressions.** `tsc`, `check:i18n`, unit and node tests stay green. Each phase adds
   a test proving a non-barbershop business is unaffected (section 10).

---

## 2. Who uses it and how

| Person | Device | Context | What they need |
|---|---|---|---|
| **Barber / owner** | Phone browser or installed PWA (manifest + service worker already exist) | Standing, one hand, often between clients, flaky signal | Who is next, start/finish a cut, add a walk-in, charge, see the day. |
| **Client** | Phone, opened from **Instagram's in-app browser** or a **QR code** | 30 seconds, no account, will abandon at friction | Pick barber, pick time, enter name and phone, done. |
| **Owner on desktop** | Laptop | Occasional: settings, reports | The standard layout, restyled but complete. |

Design targets: 360px wide, one-hand reach, tap targets of at least 48px, no horizontal
scrolling (except the desktop week grid), works on a slow connection.

---

## 3. How the mode is selected (technical gate)

- Add `type` and a derived `isBarbershop` to what `app/(dashboard)/layout.tsx` loads
  (today it selects only `id, name, slug, plan`).
- Add a small config module, `lib/vertical.ts`:
  `getVertical(business) -> { id, labels, nav, modules, theme }`. `barbershop` returns the
  new config. **Every other type returns `standard`, which is today's behaviour.**
- Pages branch once at the top (`isBarbershop ? <BarberX/> : <ExistingX/>`). The existing
  component stays untouched in the standard branch. This keeps the diff reviewable and the
  rollback trivial.
- Per-shop override: `businesses.barbershop_mode boolean` (section 8) for the escape hatch.
- Wording that changes (for example "Employees" to "Barbers") lives in translation files
  under a `barbershop.*` namespace. **French is the default and only language shown** in barbershop
  mode (dashboard and public link): the language switcher is hidden, and the notification
  language defaults to French. The other locale files stay for standard business types.
  RTL/Arabic comes **after team access** (section 9, phase 6); until then no layout may
  hard-code left/right where logical properties work.

---

## 4. Page-by-page decisions

Legend: **Keep** unchanged · **Change** same feature, new presentation · **Hide** not shown in
barbershop mode (still reachable via More or Settings where noted) · **Add** new.

### 4.1 App shell (navigation)

| Item | Today | Barbershop mode |
|---|---|---|
| Mobile nav | Top bar with hamburger drawer (5 links + Settings) | **Change** to a bottom tab bar: **Today · Calendar · Charge · Clients · More**. Slim top bar with shop name/logo. |
| More sheet | n/a | **Add**: Products (if module on), Settings, Language, Sign out, "Share booking link". |
| Desktop nav | Dark navy sidebar | **Change** (restyle + relabel): Today, Calendar, Charge, Clients, Products, Settings. |
| Labels | Dashboard, POS, Booking, Inventory | **Change** to Today, Charge, Calendar, Products. |
| "Pronto." brand | Top of sidebar and mobile bar | **Change**: shop logo/name first. (The small Pronto mark in More is not shown yet.) |

### 4.2 Dashboard becomes **Today** (`/dashboard`)

| Element | Decision |
|---|---|
| Revenue today / Appointments today cards | **Change** to one compact strip: `done / remaining` and `revenue today`. |
| Total clients card | **Hide** (low value for the chair). |
| Low stock card | **Hide** unless Products is on and something is low, then a small alert chip linking to Products. |
| Upcoming appointments list | **Change** to a **timeline** for today (all barbers, with a barber filter chip row). |
| **Next client hero** | **Add**: client, service, time, barber, countdown, with one-tap **Terminé**, **Encaisser** (opens the POS prefilled) and **Absent**. There is no separate "Start" status in the database, so **En cours** is derived from the clock (the appointment's start and end times). |
| **+ Walk-in** button (**Client sans RDV**) | **Add**: large, always visible. Pick the service and barber (or "Premier libre"); name and phone are optional (a client is created or matched by phone). The page shows the **next free time** ("Prochain créneau : 11:30 avec firas") and books it as a normal appointment (`source: 'manual'`); the database's slot allocation prevents double-booking. |
| Recent sales list | **Hide** from Today; reachable via Charge → History. |
| **Keeping the screen current** | The list refreshes by itself every minute and whenever the barber returns to the tab, so online bookings and changes from another phone appear without reloading. |
| **Overdue bookings** | A pending/confirmed booking whose end time has passed is labelled **À clôturer**, is not counted as "restants", and a banner above the next-client card opens it so it can be marked Terminé or Absent. |
| **Cancelled bookings** | Hidden from the day's timeline; a "Voir les annulés (n)" link shows them. |
| **Walk-in supplements** | The walk-in sheet also offers the supplements, with the same rules as the booking page ("Inclus" items cannot be added; one choice per single-choice group). Price, duration and the booking's lines (`appointment_items`) are saved so the POS charges the right total. If the lines cannot be saved the booking is removed again and the barber can retry. |
| **No services yet** | The walk-in sheet explains that a service must be created first and links to Settings → Prestations. |
| **Escape key** | Closes the walk-in sheet and the "Plus" menu. |
| Onboarding checklist | **Change**: barbershop checklist of 3 steps: add barbers (and photos) → set hours → **share your link**. |
| **Share booking link card** | **Add**: copy link, QR code, "put this in your Instagram bio" tip. |

### 4.3 Calendar (`/booking`)

| Element | Decision |
|---|---|
| Week table (`min-w 700px`) | **Keep on md and up only**. **Hide** on phones. |
| **Day agenda** | **Add** and make it the phone default: vertical list of the day's appointments, swipe or arrows for prev/next day, "Today" button. |
| Barber filter | **Add**: chip row (All · Karim · Sami …), using the existing per-barber colour. |
| Drag and drop | **Keep on desktop only**. Phones use tap → "Reschedule". |
| Appointment detail | **Change** to a bottom sheet. Status actions first: Confirm · Start · Done · No-show · Cancel. **Charge** button opens POS prefilled with the client (POS already accepts `bookingContext.clientId`). |
| New appointment form | **Change** to a bottom sheet: client (search or quick-add name + phone), service, barber, time. Notes collapsed. |
| Colour legend / team colours panel | **Hide** on phones (colours appear on the chips). |
| Status values | **Keep** all six (`pending, confirmed, completed, paid, cancelled, no_show`); the UI offers the 4–5 a barber actually uses. |

### 4.4 Charge (`/pos`, `/pos/history`)

| Element | Decision |
|---|---|
| Services grid | **Change**: bigger tiles, 2 columns on phone, most-used first. |
| Barber selector | **Change**: avatar chips, default to the signed-in/selected barber. |
| Cart | **Keep** services/cart tab pattern on mobile. Cart opens as a bottom sheet with a sticky **Charge** button. |
| Payment method | **Change**: **cash only** in barbershop mode (decided 2026-11-23): the client pays at the chair. Card and transfer stay in the data model and in standard mode; they are not shown. One big **Cash received** button. |
| Discount | **Change**: collapsed under "Add discount". |
| Walk-in → save client | **Keep**, simplified to name + phone. |
| Products tab | **Hide** unless Products module is on. |
| Tip | **Add (later phase)**: quick +5% / +10% / custom. Needs a schema decision (section 8). |
| History | **Change**: card list on phone, filters collapsed. Reached from a "History" link in Charge. |

### 4.5 Clients (`/crm`, `/crm/new`, `/crm/[id]`)

| Element | Decision |
|---|---|
| List | **Change**: search first; cards on phone showing name, last visit, last service, and one-tap **Call / WhatsApp / Book**. |
| Email column, tag filter | **Hide** on phone (kept on desktop). |
| Import button | **Hide** from the list header; moved to More → Import clients. |
| New client form | **Change**: name + phone only; "More details" expander for email, birthday, tags, notes. |
| Detail: notes | **Change** label to **Cut notes** (e.g. "fade 2 on sides") and put it at the top. |
| Detail: history | **Change** to "Last cuts" (from existing appointments/transactions). |
| Detail: Telegram/Viber invite links | **Hide** into a collapsed "Notifications" section. |
| Birthday | **Keep** (drives the existing birthday message). |
| **Identity = phone number** (decided 2026-11-24) | A client is **name + phone**; the **phone number identifies them**, so the same person never exists twice. Numbers are normalised: `50 300 200`, `503 00 200`, `50300200`, `+216 50 300 200`, `21650300200`, `0021650300200` are all the same client (Tunisian numbers kept as their 8 local digits; other countries keep their country code). Every path that creates or finds a client (online booking, walk-in, POS "save as client", new client form) matches on this key and reuses the existing record. A booking never overwrites the name stored by the barber. |
| Fix a mistake | The barber can **edit the name** (and the number) on the client page; history stays attached. Changing a number to one that already belongs to another client is refused with a link to that client. |
| Search | By **name or number**, any spelling or part of the number (3+ digits). |
| Existing duplicates | Not merged automatically (the shop's data is theirs). A manual **merge** is a follow-up. The booking hint ("you already have an appointment this week") and "Possédez-vous déjà un rendez-vous ?" link are the next step and will reuse this key. |

### 4.6 Products (`/inventory`), only if the module is on

| Element | Decision |
|---|---|
| Module default | **Change**: OFF by default for barbershops (**decided 2026-11-23**). It can be turned on at any time in Settings → Modules, or by answering "Do you sell products (pomade, oil, clippers…)?" in onboarding. Turning it on adds Products to More, the Charge products tab, and the low-stock alert chip; turning it off again hides them without deleting data. |
| List | **Change**: name, price, stock; cost price, SKU, unit and category move under "Advanced". |
| Sales tab | **Keep**. |
| New product form | **Change**: name, price, stock first; the rest under "Advanced". |

### 4.7 Settings (`/settings`)

Tabs for a barbershop, in this order. Hidden items stay in the standard layout.

| Tab | Barbershop mode |
|---|---|
| **Shop** (was General) | Name, logo, brand colour, address/phone, **hours**, **booking link + QR**. Timezone and currency under "Advanced". Notification language defaults to French and moves under "Advanced". |
| **Barbers** (was Employees) | Name, **photo** (`avatar_url` exists; upload UI to add), phone, active toggle, **personal booking link**. Role and email under "Advanced". |
| **Services** | Name, duration, price, **category** (Cuts / Beard / Combo…). **Hide** the group "capacity" field (barbershop services are capacity 1). |
| **Notifications** | **Change**: WhatsApp and Telegram first (templates + triggers). SMTP / Resend / Viber move under "Advanced". |
| **Modules** | **Keep**; add a "Barbershop" preset (Bookings, Clients, Charge, Notifications). Add the **Barbershop mode on/off** switch here. |
| Billing, Account | **Keep**. |

### 4.8 Onboarding (`/onboarding`)

Keep the 3 steps (type → first service → notifications). In barbershop mode:
- Step 2 offers **starter services** to tick (Haircut, Beard trim, Haircut + beard, Kids cut,
  Shave) with editable price and duration, instead of one blank form.
- A new small question: "Do you sell products?" (sets the Products module).
- Default hours template (e.g. Tue–Sat 09:00–19:00), editable later in Settings → Shop.
- Currency **TND** and timezone **Africa/Tunis** by default (decided 2026-11-27), editable in Settings.

### 4.9 Public booking link (`/book/[slug]`): the client's experience

Target: **three screens, under 30 seconds**, inside Instagram's in-app browser.

| Element | Today | Barbershop mode |
|---|---|---|
| Order | Service → barber (only when more than 1) → date/time → contact | **Barber → service → time**, then contact. "Any barber" = first free. |
| Barber step | Initials circle | **Photo cards** (load `avatar_url`, which the page does not select today). |
| Services | Flat list | **Grouped by category**, each with duration and price. |
| Date | Native `<input type="date">` | **Swipeable 14-day strip**. |
| Time | 3-column grid | Grouped **Morning / Afternoon / Evening**, plus a **"Next available"** chip. |
| Contact | Name, phone, email (phone or email required) | **Name + phone**; email optional; **prefill** returning clients from the device. |
| CTA | Inline button | **Sticky bottom button** within thumb reach. |
| Confirmation | Check mark + notification links | Booking summary, **Add to calendar**, **Open in Maps**, **WhatsApp/Call the shop**. |
| Deep links | `/book/[slug]` | **Add** `?b=<barberId>` (per-barber links) and `?s=<serviceId>`. |
| Style | Cream background, 448px, 51 inline style blocks | New themed component using CSS variables (section 6); the standard page is untouched. |

Language: the public link is **French only** in barbershop mode (no language switcher).

In-app-browser rules: no `window.open`, no popups, no native date picker, no reliance on
clipboard reads, lightweight bundle, no login.

### 4.10 Walk-ins and appointments: one model for every shop

Shops differ (80/20, 20/80, 50/50, drifting toward appointments over time). So there are
**no separate modes**. There is **one agenda** and a few **dials** that each shop sets.

- **One timeline.** Everything is a visit on the same agenda per barber: an appointment
  (booked time) or a walk-in (starts at the **next free slot**). Walk-ins reuse the existing
  manual appointment insert and the existing atomic slot allocation, so a walk-in can never
  double-book a barber.
- **Walk-in in two taps.** "+ Walk-in" → choose barber (or "first free") → name optional →
  done. The app shows the **estimated wait** ("next free: 15:40").
- **Dial 1: online booking on/off.** A walk-in-only shop turns the public link off and still
  uses Today, Calendar and Charge. A shop that grows into appointments turns it on later;
  nothing else changes.
- **Dial 2: online share.** Shops choose how much of the day is bookable online: all slots,
  only selected hours (for example mornings), or a daily cap. The rest stays free for
  walk-ins. Phase 1 ships "all slots" with on/off; hours/cap follows.
- **Dial 3: default slot length** for walk-ins (uses the service duration).
- Nothing in the UI says "walk-in mode" or "appointment mode"; the same screens serve both.

### 4.11 Foundations for barber (team) access: build in from phase 1

Goal after the current scope: other barbers in the same shop log in and track **their own**
schedule. What exists today (checked in the database, 2026-11-23): the row-level-security
policies on every shop table use `my_business_ids()`, which returns the owner's business **and**
the business of any active employee whose `employees.user_id` matches the login. So a barber
account linked that way would see **all** of the shop's data, not only their own visits, and
there is no invite flow, role, or per-barber scoping yet. Real team access therefore needs
finer rules, and is its own phase (section 9, phase 5). To avoid rework, every phase before it
follows these rules:

1. **Barber-aware from day one:** every Today/Calendar/Charge query and component takes a
   `barberId` filter; the barber chip row and per-barber booking links ship in phase 1-3.
2. **No owner-only assumptions in new UI:** components read a `currentActor`
   (owner now, barber later) from one helper, not `business.owner_id` directly.
3. **Per-barber data model planned:** `employee_hours` and `employee_services` (and optional
   per-barber price) are designed now and created in phase 5; the public link already treats
   the barber as the first choice.
4. **Roles (phase 5):** `owner` (everything), `barber` (own schedule, own clients' notes,
   charge own visits; no settings/billing). Invite by link; links `employees.user_id`.
5. **Access rules (phase 5):** tighten the `my_business_ids()`-based policies for barber
   accounts so a barber sees only their appointments and the shop's services; owner access is
   unchanged, so standard shops are unaffected.

### 4.12 Smart services: supplements, online switch, offers (barbershop only)

Decided 2026-11-23. Barbershop mode only; standard business types are unchanged.

**Main services and supplements.** Every service has a type: **Principale** or **Supplément**
(`services.kind`). A supplement has a switch **Réservable seul** (`services.bookable_alone`, set
per supplement):
- off (default): the client can only add it to a main service. It never appears as a starting
  choice on the booking page.
- on: it also appears in the starting list and can be booked by itself.

**Booking flow.** After a client picks a main service **or an offer**, an optional screen
**"Ajouter un supplément ?"** lists the supplements (+ price, + minutes) with a running total.
Skipped when there is nothing to add, or when a stand-alone supplement was chosen. Duration and
price are summed; the booking blocks the barber for the total time.

**No contradictions (rules, decided 2026-11-23).** The client picks **exactly one** main service
(or one offer), so "Coupe", "Barbe" and "Coupe + Barbe" can never be combined: a combo is created
as its own main service. Two optional settings stop overlaps between a main service and its
supplements:
1. **Inclut déjà** (`services.includes`, on a main service): the supplements it already covers,
   for example *Coupe → inclut Barbe*. On the supplements screen they show as **Inclus ✓**
   (greyed, not selectable) and the service card on the first screen shows "Inclut : barbe". For
   an offer, the union of what its services include applies. The server refuses an included
   supplement (`supplement_included`).
2. **Un seul choix avec** (`services.exclusive_group`, on a supplement): supplements sharing the
   same group name are a single choice (for example "Soins": masque / protéines). Ticking one
   replaces the other; the server refuses two of the same group (`supplement_conflict`).
   Supplements without a group are independent and can be combined freely. Groups are explicit,
   never derived from the category.
Also: saving a service whose name already exists shows a warning in Settings.

**Online switch per service** (`services.bookable_online`, default on). Off = the service is
hidden from the **public booking page only** and refused by `/api/book`. It stays visible in the
POS and the calendar (those keep using `services.is_active`), and **existing bookings are never
touched**: the change only applies to new online bookings.

**Offers (forfaits).** A named package of services sold for one price (`offers`):
- shown on the booking page as a card with the regular total in grey with a line through it and
  the package price in the accent colour (for example ~~200~~ **120**), plus "Jusqu'au 30 novembre";
- optional start and end date; it is validated against the **visit date**, and the date strip
  greys out days outside the period; it disappears by itself once the period has passed;
- applies to **all barbers by default**; the barber can limit it to chosen barbers with chips
  (no chips selected = everyone). If the client picked "Premier disponible" and the offer is
  limited, the page names an allowed free barber itself so the booking cannot land elsewhere;
- booked as one appointment: total duration, package price, and a readable label;
- supplements can be added **on top of an offer** (total = package price + supplements, the
  regular total includes them too); a supplement the offer already contains or includes cannot
  be added again.

**Where the data lives.** `appointment_items` stores each line (name, price, duration frozen at
booking time); `appointments.items_summary` ("Coupe + Barbe") keeps screens that only read
appointments working; `appointments.offer_id` records the offer. The server (`/api/book`)
recomputes price, duration and every rule from the database via `lib/barbershop-cart.ts`; the
browser's totals are display only.

**Other screens.** Calendar and confirmation messages show the combined label. In the POS,
"Charger" from such a booking loads every line and applies the package discount so the sale
equals the booked price.

**Settings (barbershop mode).** Services tab becomes: list with type badges and an **En ligne**
switch per row, add/edit form (type segmented control, "Réservable seul" and "Un seul choix avec"
for supplements, "Inclut déjà" chips for main services, category, price, duration), and an
**Offres** section (name, tap the services, price with
"au lieu de X", optional period, "Tous les barbiers" or chosen barbers, active switch).

Not included (decided): the 💺 chair emoji and the "available barber" badge were skipped.

---

### 4.13 Kridi: pay now, rest later (barbershop only)

- One running balance per client, kept in `client_ledger` (`credit` = unpaid part of a sale, `payment` = money handed over later, `writeoff` = owner forgives). Balance = credits - payments - writeoffs.
- Only for clients with a name and a phone number. Clients with debt can still book online; only the barber sees "Doit X DT".
- Caisse: cash only. "Montant reçu" defaults to the total; the remainder becomes kridi; "Tout en kridi" sets it to 0. Needs a connection.
- `transactions.amount` = money really received; the full price stays in `items`. The day's takings therefore count only cash in hand (repayments included once 3f lands).
- Out of scope: interest, due dates, limits, automatic reminders, per-barber debts and roles.

### 4.14 Browser notifications: "Nouveau RDV" on the barber's phone (barbershop only)

Decided 2026-11-27: the first client's barber uses an iPhone; other barbers may use Android. Free, no
WhatsApp account or SMS needed.

- **What is sent:** a notification when a client books **online** ("Nouveau RDV — Ahmed · Coupe + Barbe /
  Demain à 10:30 avec Firas"). Tapping it opens the Agenda on that day. Bookings the barber makes himself
  are not notified. Nothing is sent to clients.
- **Turning it on:** Settings → Notifications → "Notifications sur ce téléphone" → "Activer les
  notifications". A test notification is sent at once. Each phone is turned on separately; "Désactiver sur
  ce téléphone" turns it off. Today shows a small banner until the phone is set up ("Plus tard" hides it
  for 7 days).
- **Android (Chrome):** works from the browser directly.
- **iPhone:** Safari only allows it from the **home-screen app**. The card shows the steps (Partager →
  "Sur l'écran d'accueil" → open from the icon → Activer). The home-screen app carries the shop's name and
  opens on Today.
- **Blocked:** if the person refused, the card explains how to allow it in the phone's settings.
- **Data:** `push_subscriptions` (migration 044), one row per phone, server-only (no direct access for
  signed-in users). `employee_id` stays empty for now (the device receives every booking); phase 5 fills it
  so a barber only hears about his own bookings. Dead subscriptions are deleted when the push service
  answers 404/410.
- **Keys:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (secret) on the Vercel project. Without
  them the card says notifications are not available and nothing is sent.
- **Later:** an evening summary ("Demain : 6 RDV") needs a scheduler; per-barber delivery comes with phase 5.

### 4.15 Recettes replaces the Caisse tab (barbershop only)

Decided 2026-11-28 with the owner: charging is a step after a visit, not a place of its own, so the tab
becomes a page about the money.

- **Bottom menu:** Aujourd'hui · Agenda · **Recettes** · Clients · Plus. The payment screen (`/pos`)
  still exists and highlights Recettes while open.
- **Paying:** "Encaisser" on a visit (Today or Agenda) opens the payment screen filled in. After paying,
  the main button goes back where the barber came from ("Retour à Aujourd'hui" / "Retour à l'agenda").
- **Recettes page:** Aujourd'hui / Semaine (Monday to Sunday) / Mois; "Encaissé" = sales' paid part +
  kridi repaid (same rule as Today); sales count, average full price per sale (paid + kridi), kridi given;
  "On vous doit X" (all open kridi) linking to the Kridi list; per barber (2+ barbers) with a bar; top 5
  services; the period's sales (30 latest) and "Voir tout l'historique" (`/pos/history`).
- **"Vente sans RDV":** floating button opening the empty payment screen, for products or a charge with
  no visit.
- No database change. Standard businesses: `/recettes` redirects to the sales history; their menu is
  unchanged.

## 5. What stays standard for everyone else

All screens listed in section 4 keep their current code path for non-barbershop types.
The existing booking page, dashboard, calendar, POS, CRM, inventory, settings, onboarding
and public booking form are not edited in the standard branch, except for shared bug fixes
recorded in the changelog.

---

## 6. Design system (barbershop theme)

- **Palette:** near-black surfaces, warm brass/copper accent, off-white text. The shop's
  `brand_color` still overrides the accent (keeps the existing `--brand` variable).
- **Type:** bold condensed display font for headings and times, a clean sans for body.
  Fonts are **self-hosted** (`next/font/local`, introduced by PR #4, which must be merged first) so builds never depend on Google.
  Tabular numerals for prices and times.
- **Shape:** 8–12px radii, strong 1px borders instead of heavy shadows, large rounded
  buttons, 48px minimum touch height.
- **Motion:** short (150–200ms) sheet and tab transitions; respect `prefers-reduced-motion`.
- **Light and dark:** both supported through CSS variables; the public booking page follows
  the shop's choice (default dark).
- **Implementation:** CSS variables and Tailwind classes, not inline `style={{}}`, so themes
  stay maintainable. Scoped under a `data-vertical="barbershop"` attribute so nothing leaks
  to other types.

---

## 7. Modules and defaults

| Module | Standard default | Barbershop default |
|---|---|---|
| bookings | on | on |
| crm | on | on |
| pos | on | on (shown as **Charge**) |
| notifications | on | on |
| inventory | on | **off** (opt-in) |

Existing barbershop-typed shops that already have modules set are **not** changed
automatically; only new onboardings get the preset.

---

## 8. Data and API changes (kept minimal)

| Change | Why | Phase |
|---|---|---|
| `businesses.barbershop_mode boolean null` (null = follow type) | Escape hatch (rule 3) | 1 |
| Upload UI + storage for `employees.avatar_url` (column exists) | Barber photos | 1 |
| Public page also selects `avatar_url` and service `category` | Photo cards, grouping | 1 |
| None for Today, Calendar, Charge, Clients | Reuse existing tables and queries | 2–3 |
| Optional `transactions.tip_amount numeric` | Tips | later |
| Optional per-barber services/hours/prices | Multi-barber shops | later |

All migrations follow the repo's grants rule (migration 037+): RLS and explicit GRANTs for
any new table; adding a column needs no new grants.

---

## 9. Phases and acceptance criteria

| Phase | Scope | Done when |
|---|---|---|
| **0** | This spec approved; `getVertical()` and `isBarbershop` plumbing; mode switch | Standard shops render identically (snapshot/route tests); barbershop flag readable in layout. |
| **1** | **Public booking link** (4.9) + barber photos + service categories + Settings → Shop link/QR | A real barbershop link books end-to-end on a 360px phone inside Instagram's browser; confirmation links work. |
| **1b** | **Smart services** (4.12): supplements, online switch, offers | Barber creates a supplement and an offer in Settings; a client books a haircut + supplement and an offer on the public link; price, duration and calendar/POS/confirmation all agree. |
| **2** | **Shell + Today** (4.1, 4.2) | Bottom nav on phone; next-client hero and walk-in button work; no horizontal scroll at 360px. |
| **3** | **Calendar day agenda + Charge + Clients** (4.3–4.5) | A full day (book, start, done, charge) can be run one-handed on a phone. |
| **4** | **Settings reorg, onboarding presets, Products** (4.6–4.8) | New barbershop signup lands on a ready-to-share setup in under 3 minutes. |
| **5** | **Team access (barber logins)**: roles, invites, RLS, per-barber hours and services, "my schedule" view (4.11) | A second barber logs in on their phone and sees and charges only their own visits; owner view unchanged; standard shops unaffected. |
| **6** | **Arabic / RTL**, then tips, no-show tracking, card/transfer or deposits if wanted | Scoped separately. |

Each phase ships behind the mode gate, as its own pull request(s), with a changelog entry.

---

## 10. Test and review plan

- `tsc --noEmit`, `npm run check:i18n`, `npm test`, `npm run test:unit` must pass.
- **Isolation tests:** for each changed route, a test renders the standard type and asserts
  the existing markup/branch is used (no barbershop component).
- Manual checks per phase at **360px, 390px, 768px, 1280px**, in Chrome and iOS Safari, and
  inside the Instagram in-app browser for the public link.
- Both Vercel projects must build the pull request preview before merge.

---

## 11. Open questions: answered 2026-11-23

All five answered; see the decisions log (section 12) and sections 4.10 and 4.11.

---

## 12. Decisions log

| Date | Decision | Section |
|---|---|---|
| 2026-11-23 | Products (inventory) module is **off by default** for barbershops and can be re-enabled any time, for example by a shop that sells clippers or other tools. Existing data is kept when it is switched off. | 4.6, 7 |
| 2026-11-23 | **Walk-ins vs appointments varies per shop** (80/20, 20/80, 50/50, drifting). One agenda and a few settings dials, no separate modes. | 4.10 |
| 2026-11-23 | **One or several barbers per shop.** Barber-aware from day one; team logins (own schedule) come right after the current scope as phase 5. | 4.11, 9 |
| 2026-11-23 | **French only** in barbershop mode (no language switcher, French notifications by default). | 3, 4.7, 4.9 |
| 2026-11-23 | **Cash only** for now: the client pays at the chair. Card/transfer hidden in barbershop mode. | 4.4 |
| 2026-11-23 | **Arabic/RTL later**, after team access. | 3, 9 |
| 2026-11-23 | **Supplements:** "Réservable seul" is a toggle **per supplement** (not shop-wide). | 4.12 |
| 2026-11-23 | **Service on/off** hides it from **online booking only**; it stays visible in the POS and calendar and existing bookings are untouched. | 4.12 |
| 2026-11-23 | **Offers** are shop-wide by default, with optional per-barber limits via simple chips; period is optional and checked against the visit date. | 4.12 |
| 2026-11-23 | The 💺 chair emoji and "available barber" badge are **skipped**. | 4.12 |
| 2026-11-23 | **Conflict rules:** one main service per booking (combos are main services); optional **Inclut déjà** on a main service (supplement shown "Inclus ✓", server refuses it); optional explicit **single-choice group** on supplements; **offers accept supplements** on top. Chosen over a full "rubriques" redesign to keep the barber's setup light. | 4.12 |
| 2026-11-23 | **Phase 2 shell:** French is forced for the whole dashboard in barbershop mode (the shell switches the dashboard language once and the switcher is hidden). **En cours** is derived from time because no in-progress status exists. | 4.1, 4.2 |

| 2026-11-23 | **Audit of phase 2** found and fixed: stale list (now auto-refreshes), overdue bookings counted as remaining, walk-ins unable to take supplements, dead-end sheet with no services; cancelled bookings hidden by default; Escape closes sheets. | 4.2 |
