-- Barbershop mode: "kridi" (a client who pays only part of a sale, or nothing, and settles later)
-- (docs/barbershop-mode/SPEC.md 4.13). One small additive ledger: a client's balance is
--   sum(credit) - sum(payment) - sum(writeoff).
--   credit    = amount left unpaid on a sale (linked to the sale)
--   payment   = money the client later handed over (partial allowed, not tied to a haircut)
--   writeoff  = the owner forgave the rest
-- Nothing existing is modified. `transactions.amount` keeps meaning "money really received".
create table if not exists public.client_ledger (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  client_id      uuid not null references public.clients(id) on delete cascade,
  kind           text not null check (kind in ('credit', 'payment', 'writeoff')),
  amount         numeric(10,3) not null check (amount > 0),
  transaction_id uuid references public.transactions(id) on delete set null,
  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists client_ledger_client_idx on public.client_ledger (business_id, client_id, created_at desc);

alter table public.client_ledger enable row level security;

drop policy if exists "tenant_access_client_ledger" on public.client_ledger;
create policy "tenant_access_client_ledger" on public.client_ledger
  for all using (business_id in (select public.my_business_ids()));
