-- Barbershop mode: smart services (docs/barbershop-mode/SPEC.md section 4.12).
--
--  * services.kind            'main' | 'supplement'
--  * services.bookable_alone  a supplement may be booked on its own (otherwise it can only be
--                             added to a main service). Ignored for main services.
--  * services.bookable_online hides the service from the PUBLIC booking page only. The POS and
--                             the calendar keep using services.is_active, so a service switched
--                             off online stays visible there and existing bookings are untouched.
--  * offers                   a package of services sold for one price, optionally limited to a
--                             period and to some barbers (NULL barber_ids = every barber).
--  * appointment_items        the lines of a booking (main service, supplements or the services
--                             of an offer) with the price and duration frozen at booking time.
--  * appointments.offer_id / items_summary
--                             which offer was booked, and a readable "Coupe + Barbe" label so
--                             screens that only read appointments keep working.
--
-- Defaults keep every existing row and every non-barbershop business exactly as it is today.

-- ── services ──────────────────────────────────────────────────────────────
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS bookable_alone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bookable_online boolean NOT NULL DEFAULT true;

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_kind_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_kind_check CHECK (kind IN ('main', 'supplement'));

-- ── offers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.offers (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name         text NOT NULL,
  price        numeric(10,3) NOT NULL CHECK (price >= 0),
  service_ids  uuid[] NOT NULL CHECK (cardinality(service_ids) >= 1),
  barber_ids   uuid[],
  valid_from   date,
  valid_to     date,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_offers_business ON public.offers(business_id);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_access_offers" ON public.offers;
CREATE POLICY "tenant_access_offers" ON public.offers
  FOR ALL USING (business_id IN (SELECT public.my_business_ids()));

-- Who may touch it: signed-in staff through RLS above, and the server (service_role) for the
-- public booking page and /api/book. The public page reads offers server-side; no anon grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO service_role;

-- ── appointments: which offer, and a readable label ───────────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS items_summary text;

-- ── appointment_items ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appointment_items (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  business_id     uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_id      uuid REFERENCES public.services(id) ON DELETE SET NULL,
  name            text NOT NULL,
  price           numeric(10,3) NOT NULL DEFAULT 0,
  duration_min    integer NOT NULL DEFAULT 0,
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_items_appointment ON public.appointment_items(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_items_business ON public.appointment_items(business_id);

ALTER TABLE public.appointment_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_access_appointment_items" ON public.appointment_items;
CREATE POLICY "tenant_access_appointment_items" ON public.appointment_items
  FOR ALL USING (business_id IN (SELECT public.my_business_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_items TO service_role;
