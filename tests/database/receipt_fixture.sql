-- Disposable database ONLY. Minimal contract from production metadata (2026-10-22).
-- This is not a full Supabase schema replay and must never run on a linked project.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth, public to anon, authenticated;
create table public.commissions (
  id uuid primary key, user_id uuid not null, user_amount numeric(14,2) not null,
  status text not null default 'receivable', received_at timestamptz
);
create table public.commission_receipts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  commission_id uuid not null references public.commissions(id) on delete cascade,
  amount numeric(14,2) not null default 0,
  received_at timestamptz not null default now(), notes text,
  created_at timestamptz not null default now()
);
alter table public.commissions enable row level security;
alter table public.commission_receipts enable row level security;
create policy commissions_own_rows on public.commissions for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy commission_receipts_own_rows on public.commission_receipts for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.commissions, public.commission_receipts to anon, authenticated;
insert into public.commissions(id,user_id,user_amount) values
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',100),
 ('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',100),
 ('00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',100),
 ('00000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',100);
-- Exercise replacement of both known trigger names (legacy repo and live DB).
create function public.fixture_passthrough() returns trigger language plpgsql as $$
begin return coalesce(new,old); end $$;
create trigger commission_receipts_refresh_status after insert or update or delete
 on public.commission_receipts for each row execute function public.fixture_passthrough();
create trigger commission_receipt_status_trigger after insert or update or delete
 on public.commission_receipts for each row execute function public.fixture_passthrough();
create trigger validate_commission_receipt_amount_trigger before insert or update
 on public.commission_receipts for each row execute function public.fixture_passthrough();
