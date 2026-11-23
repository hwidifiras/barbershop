-- Barbershop mode (see docs/barbershop-mode/SPEC.md, sections 3 and 4.10).
--
-- barbershop_mode:        NULL = follow businesses.type ('barbershop' => on);
--                         true/false = explicit per-shop override (escape hatch).
-- online_booking_enabled: dial 1 of the walk-in/appointment model. false turns the
--                         public booking link off (walk-in-only shops). Default true
--                         keeps every existing business exactly as it is today.
--
-- Additive only: no existing row changes meaning, no new table, so no new grants/RLS.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS barbershop_mode boolean,
  ADD COLUMN IF NOT EXISTS online_booking_enabled boolean NOT NULL DEFAULT true;
