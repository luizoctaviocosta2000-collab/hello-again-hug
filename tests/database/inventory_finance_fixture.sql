-- Disposable PostgreSQL 17 additions mirroring the real staging wave-17
-- columns and triggers needed for inventory, profile and sales tests.
-- Run BEFORE the inventory/finance source bundle; never apply remotely.

alter table public.properties
  add column created_at timestamptz not null default now(),
  add column status text not null default 'active';
alter table public.profiles
  add column name text not null default 'Corretor',
  add column email text not null default '';
alter table auth.users
  add column email text,
  add column raw_user_meta_data jsonb not null default '{}'::jsonb;

alter table public.deals
  add column status text not null default 'open',
  add column property_id uuid,
  add column property_value numeric(14,2) not null default 0,
  add column sale_value numeric(14,2) not null default 0,
  add column operation_value numeric(14,2) not null default 0,
  add column closed_at timestamptz,
  add column notes text,
  add column updated_at timestamptz not null default now();

alter table public.proposals
  add column responded_at timestamptz,
  add column proposed_at timestamptz not null default now();

alter table public.deal_properties
  add column sold boolean not null default false,
  add column updated_at timestamptz not null default now();

-- The real source database already has these triggers before the wave.
-- Stage-14 has created this function, and stage-20 will replace it.
create trigger deals_create_sale_on_close
after update of status on public.deals
for each row execute function public.create_sale_from_closed_deal();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public
as $$ begin return new; end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Real staging grants and owner RLS on these tables permit authenticated
-- inventory operations. Do not use these grants outside disposable tests.
create policy profiles_own on public.profiles for all to authenticated
using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy deals_own on public.deals for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy proposals_own on public.proposals for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy captures_own on public.captures for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy sales_own on public.sales for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy commissions_own on public.commissions for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy vgv_own on public.vgv_entries for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

grant select,insert,update,delete on public.properties,public.profiles,
 public.deals,public.proposals,public.captures,public.sales,public.commissions,
 public.vgv_entries to authenticated;
grant usage on schema auth to authenticated;
grant select on auth.users to authenticated;

select 'PASS: disposable stage-17 profile, inventory, commercial columns prepared' as verification;
