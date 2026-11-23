# Barbershop mode: product spec

Status: **draft for approval** (nothing in this document is built yet)
Owner: product (hwidifiras) · Last updated: 2026-11-23
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
  under a `barbershop.*` namespace for all five locales (en, es, fr, it, pt). RTL/Arabic is
  planned for later and out of scope here, but no layout may hard-code left/right where
  logical properties work.

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
| "Pronto." brand | Top of sidebar and mobile bar | **Change**: shop logo/name first; Pronto mark small, in More. |

### 4.2 Dashboard becomes **Today** (`/dashboard`)

| Element | Decision |
|---|---|
| Revenue today / Appointments today cards | **Change** to one compact strip: `done / remaining` and `revenue today`. |
| Total clients card | **Hide** (low value for the chair). |
| Low stock card | **Hide** unless Products is on and something is low, then a small alert chip linking to Products. |
| Upcoming appointments list | **Change** to a **timeline** for today (all barbers, with a barber filter chip row). |
| **Next client hero** | **Add**: client, service, time, barber, countdown. One-tap **Start** → **Done** → **Charge**, plus **No-show**. |
| **+ Walk-in** button | **Add**: large, always visible; creates an appointment for "now" (reuses the existing manual-appointment insert with `source: 'manual'`). |
| Recent sales list | **Hide** from Today; reachable via Charge → History. |
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
| Payment method | **Keep** cash / card / transfer; cash is the default and shown first. |
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
| **Shop** (was General) | Name, logo, brand colour, address/phone, **hours**, **booking link + QR**. Timezone and currency under "Advanced". Notification language kept. |
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

In-app-browser rules: no `window.open`, no popups, no native date picker, no reliance on
clipboard reads, lightweight bundle, no login.

---

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
| **2** | **Shell + Today** (4.1, 4.2) | Bottom nav on phone; next-client hero and walk-in button work; no horizontal scroll at 360px. |
| **3** | **Calendar day agenda + Charge + Clients** (4.3–4.5) | A full day (book, start, done, charge) can be run one-handed on a phone. |
| **4** | **Settings reorg, onboarding presets, Products** (4.6–4.8) | New barbershop signup lands on a ready-to-share setup in under 3 minutes. |
| **5** | Tips, queue, per-barber hours/prices, no-show tracking | Scoped separately. |

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

## 11. Open questions (answers change scope, not direction)

1. Walk-in-heavy or appointment-heavy shops? (Walk-ins mostly: build the queue in phase 3,
   not 5.)
2. One barber per shop, or several? (Several: per-barber hours/services move up.)
3. Which language first for barbershop copy? (Determines translation order.)
4. Payments beyond cash/card/transfer (mobile wallets, deposits against no-shows)?
5. RTL/Arabic: planned later; confirm timing so we avoid hard-coded left/right now.

---

## 12. Decisions log

| Date | Decision | Section |
|---|---|---|
| 2026-11-23 | Products (inventory) module is **off by default** for barbershops and can be re-enabled any time, for example by a shop that sells clippers or other tools. Existing data is kept when it is switched off. | 4.6, 7 |
