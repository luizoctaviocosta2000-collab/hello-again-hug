-- Meu Imob: schema inicial para Supabase
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  avatar text,
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  neighborhood text not null,
  value numeric(14,2) not null check (value > 0),
  status text not null default 'active' check (status in ('active','negotiating','sold','cancelled','received')),
  type text not null default 'Residencial',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  property_name text not null,
  neighborhood text not null default '',
  property_value numeric(14,2) not null check (property_value > 0),
  deal_type text not null check (deal_type in ('capture','capture_split','sale','sale_split')),
  commission_percentage numeric(5,2) not null check (commission_percentage between 0 and 100),
  tax_percentage numeric(5,2) not null check (tax_percentage between 0 and 100),
  participation_percentage numeric(5,2) not null check (participation_percentage between 0 and 100),
  user_percentage numeric(5,2) not null check (user_percentage between 0 and 100),
  gross_commission numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  net_commission numeric(14,2) not null default 0,
  participation_amount numeric(14,2) not null default 0,
  user_commission numeric(14,2) not null default 0,
  status text not null default 'negotiating' check (status in ('active','negotiating','sold','cancelled','received')),
  deal_date date not null default current_date,
  received_date date,
  created_at timestamptz not null default now(),
  constraint user_partner_split_100 check (user_percentage between 0 and 100)
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  default_commission_percentage numeric(5,2) not null default 6 check (default_commission_percentage between 0 and 100),
  default_tax_percentage numeric(5,2) not null default 9 check (default_tax_percentage between 0 and 100),
  default_participation_percentage numeric(5,2) not null default 20 check (default_participation_percentage between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.deals enable row level security;
alter table public.settings enable row level security;

create policy "profiles own" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "properties own" on public.properties for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "deals own" on public.deals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "settings own" on public.settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,name,email) values(new.id,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),new.email) on conflict (id) do nothing;
  insert into public.settings(user_id) values(new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
