-- Extend the step-09 synthetic finance fixture with the contract
-- expected by the historical 202610160001 closing/commission migration.
-- PostgreSQL 17 disposable database only; never run in Supabase.
alter table public.deals
  add column status text not null default 'open',
  add column property_id uuid,
  add column property_value numeric(14,2) not null default 500000,
  add column sale_value numeric(14,2) not null default 500000,
  add column operation_value numeric(14,2) not null default 500000,
  add column closed_at timestamptz,
  add column notes text;

alter table public.proposals
  add column responded_at timestamptz,
  add column proposed_at timestamptz not null default now();

create table public.deal_properties (
  user_id uuid not null,
  deal_id uuid not null,
  property_id uuid not null,
  sold boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.deals (id, user_id, property_id, sides, notes) values
  ('11111111-aaaa-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['sale']::text[],'deal-sale-only'),
  ('11111111-bbbb-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['capture']::text[],'deal-capture-only'),
  ('11111111-cccc-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array[]::text[],'deal-empty-sides');
