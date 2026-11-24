-- Barbershop mode: the phone number identifies a client (docs/barbershop-mode/SPEC.md 4.5).
-- Adds a computed, indexed "phone_key" so "50 300 200", "50300200" and "+216 50 300 200" are found as
-- the same client. Additive only: existing phone values and clients are NOT modified or merged.
-- Not unique on purpose: a shop may already hold duplicates that its owner must merge by hand.
-- KEEP IN SYNC with normalizePhone() in lib/phone.ts.

create or replace function public.normalize_phone(raw text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  trimmed text;
  digits  text;
begin
  if raw is null then return null; end if;
  trimmed := btrim(raw);
  digits  := regexp_replace(trimmed, '\D', '', 'g');
  if left(trimmed, 1) <> '+' and left(digits, 2) = '00' then
    digits := substr(digits, 3);
  end if;
  if left(digits, 3) = '216' and length(digits) = 11 then
    digits := substr(digits, 4);
  end if;
  if length(digits) < 6 or length(digits) > 15 then return null; end if;
  return digits;
end;
$$;

alter table public.clients
  add column if not exists phone_key text generated always as (public.normalize_phone(phone)) stored;

create index if not exists clients_business_phone_key_idx on public.clients (business_id, phone_key);
