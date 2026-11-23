-- Barbershop mode: prevent contradictions between services (docs/barbershop-mode/SPEC.md 4.12).
--
--  * services.includes         on a MAIN service: the supplements it already covers (for example
--                              "Coupe" already includes "Barbe"). The booking page shows them as
--                              "Inclus" and they cannot be added again; the server refuses them.
--  * services.exclusive_group  on a SUPPLEMENT: supplements sharing the same group name are a
--                              single choice (for example "Soins": masque / protéines / soin).
--                              NULL = independent (can be combined with anything).
--
-- Additive only: defaults ('{}' and NULL) leave every existing service behaving as it does today.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS includes uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS exclusive_group text;
