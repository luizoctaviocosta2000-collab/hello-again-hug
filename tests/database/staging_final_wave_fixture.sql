-- Disposable-only objects missing from the narrow 09-22 migration test fixtures.
-- Mirrors the relevant shape of real imobfy-testes stage 22, never run remotely.
-- Run AFTER stage 18-22 bundle and BEFORE the final stage 23-25 bundle.

alter table public.commissions
  add column received_at timestamptz,
  add column updated_at timestamptz not null default now();
alter table public.deals
  add column client_id uuid,
  add column stage text not null default 'lead';

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  phone text,
  email text,
  notes text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.commission_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  commission_id uuid not null
    constraint commission_receipts_commission_id_fkey
      references public.commissions(id) on delete cascade,
  amount numeric(14,2) not null default 0,
  received_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  deal_id uuid,
  client_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled',
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.visit_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  visit_id uuid not null references public.visits(id) on delete cascade,
  property_id uuid not null references public.properties(id),
  sequence integer,
  visited boolean not null default false,
  notes text,
  unique (visit_id,property_id)
);
alter table public.deal_properties
  add column visit_status text not null default 'pending';

alter table public.clients enable row level security;
alter table public.commission_receipts enable row level security;
alter table public.visits enable row level security;
alter table public.visit_properties enable row level security;

create policy clients_own on public.clients for all to authenticated
  using ((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy receipts_own on public.commission_receipts for all to authenticated
  using ((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy visits_own on public.visits for all to authenticated
  using ((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy visit_props_own on public.visit_properties for all to authenticated
  using ((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy deal_properties_own on public.deal_properties for all to authenticated
  using ((select auth.uid())=user_id) with check((select auth.uid())=user_id);

grant select,insert,update,delete
  on public.clients,public.commission_receipts,public.visits,
     public.visit_properties to authenticated;

-- The real pre-24 database has a status-sync trigger; stage 24 must replace it.
create function public.fixture_legacy_receipt_status()
returns trigger language plpgsql as $$
begin return coalesce(new,old); end $$;
create trigger commission_receipts_refresh_status
  after insert or update or delete on public.commission_receipts
  for each row execute function public.fixture_legacy_receipt_status();

select 'PASS: disposable client, visit and receipt schema fixture prepared' as result;
