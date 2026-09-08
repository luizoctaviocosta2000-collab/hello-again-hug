create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  creci text,
  city text,
  goal numeric(14,2) not null default 80000,
  commission_percent numeric(5,2) not null default 6,
  tax_percent numeric(5,2) not null default 9,
  participation_percent numeric(5,2) not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  neighborhood text,
  city text,
  property_type text,
  bedrooms integer,
  bathrooms integer,
  parking_spaces integer,
  area_m2 numeric(10,2),
  asking_price numeric(14,2),
  status text not null default 'active',
  owner_name text,
  owner_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  client_type text not null default 'buyer',
  preferred_neighborhood text,
  budget_min numeric(14,2),
  budget_max numeric(14,2),
  notes text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  stage text not null default 'lead',
  operation_value numeric(14,2) not null default 0,
  operation_type text not null default 'sale',
  visit_at timestamptz,
  expected_close_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  appointment_type text not null default 'follow_up',
  status text not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  operation_value numeric(14,2) not null default 0,
  commission_percent numeric(5,2) not null default 6,
  tax_percent numeric(5,2) not null default 9,
  participation_percent numeric(5,2) not null default 20,
  gross_commission numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  net_commission numeric(14,2) not null default 0,
  user_commission numeric(14,2) not null default 0,
  status text not null default 'projected',
  received_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.clients enable row level security;
alter table public.deals enable row level security;
alter table public.appointments enable row level security;
alter table public.commissions enable row level security;

do $$
begin
  create policy "profiles own row" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
  create policy "properties own rows" on public.properties for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy "clients own rows" on public.clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy "deals own rows" on public.deals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy "appointments own rows" on public.appointments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy "commissions own rows" on public.commissions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
