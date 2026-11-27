-- Barbershop mode: browser notifications ("Nouveau RDV") on the barber's phone
-- (docs/barbershop-mode/SPEC.md 4.14). One row per phone/browser that said yes.
--   endpoint, p256dh, auth = what the browser hands out when it subscribes (Web Push standard)
--   employee_id            = null: the device gets every booking of the shop (the owner today).
--                            Phase 5 (barber logins) sets it so a barber only hears about their own.
-- Nothing existing is modified.
create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  employee_id     uuid references public.employees(id) on delete set null,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);

create index if not exists push_subscriptions_business_idx on public.push_subscriptions (business_id);

alter table public.push_subscriptions enable row level security;

-- Data API privileges (repo rule, tests/migration-grants-rule.test.js): explicit grants, none for anon.
-- Server only, like notification_log: the app saves and reads subscriptions in server actions that first
-- check the shop belongs to the signed-in user, so signed-in users get no direct access and no policy.
REVOKE ALL ON public.push_subscriptions FROM anon;
REVOKE ALL ON public.push_subscriptions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO service_role;
