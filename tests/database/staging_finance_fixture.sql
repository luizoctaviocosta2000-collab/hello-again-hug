-- Minimal disposable PostgreSQL 17 fixture for migration steps 10-13.
-- NOT an exact replica of staging step 09, Supabase Auth, or PostgREST.
-- No real customers or external services.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated;

create table public.profiles(
  id uuid primary key,
  default_commission_pct numeric(5,2) not null default 6,
  tax_pct numeric(5,2) not null default 9,
  participation_pct numeric(5,2) not null default 20
);
create table public.properties(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null
);
create table public.deals(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  sides text[] not null default '{}'::text[]
);
create table public.proposals(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  deal_id uuid not null,
  property_id uuid not null,
  status text not null
);
create table public.captures(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  property_id uuid not null,
  status text not null default 'active',
  captured_at timestamptz not null default now(),
  commission_pct numeric(5,2) not null default 20
);
-- Mimics the step-09 NOT NULL constraint removed at step 10.
create table public.sales(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  deal_id uuid not null,
  property_id uuid not null,
  proposal_id uuid,
  sale_value numeric(14,2) not null,
  sold_at timestamptz not null default now(),
  notes text
);
create table public.commissions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  deal_id uuid,
  vgv numeric(14,2) not null default 0,
  gross_pct numeric(5,2) not null default 6,
  tax_pct numeric(5,2) not null default 9,
  participation_pct numeric(5,2) not null default 20,
  role_pct numeric(5,2) not null default 100,
  status text not null default 'a_receber',
  commission_type text not null,
  sale_id uuid,
  property_value numeric(14,2) not null default 0,
  brokerage_pct numeric(5,2) not null default 6,
  gross_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  net_brokerage numeric(14,2) not null default 0,
  user_amount numeric(14,2) not null default 0,
  capture_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  due_at timestamptz,
  reference_month date
);
create table public.vgv_entries(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  deal_id uuid,
  month date,
  reference_month date,
  property_value numeric(14,2) not null default 0,
  vgv numeric(14,2) not null default 0
);
create unique index vgv_entries_user_deal_month_idx
  on public.vgv_entries(user_id, deal_id, reference_month);

create table public.security_gate_marker(id bigint primary key);
create function public.set_updated_at() returns trigger
  language plpgsql as $$ begin return new; end $$;
create function public.example_privileged_trigger() returns trigger
  language plpgsql security definer set search_path=public
  as $$ begin return new; end $$;
create trigger security_gate_marker_trigger before insert on public.security_gate_marker
for each row execute function public.example_privileged_trigger();

do $$
declare t record;
begin
  for t in
    select quote_ident(n.nspname) || '.' || quote_ident(c.relname) as qualified
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p')
  loop
    execute 'alter table ' || t.qualified || ' enable row level security';
  end loop;
end $$;

-- Only the privileged RPCs should insert during the test.
insert into public.profiles (id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
insert into public.properties(id, user_id, title) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Synthetic A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Synthetic B');
