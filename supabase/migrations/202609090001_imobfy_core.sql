create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  creci text,
  default_commission_pct numeric(5,2) not null default 6,
  tax_pct numeric(5,2) not null default 9,
  participation_pct numeric(5,2) not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  property_type text,
  purpose text not null default 'venda' check (purpose in ('venda','locacao','venda_locacao')),
  status text not null default 'ativo' check (status in ('ativo','reservado','vendido','inativo')),
  neighborhood text,
  city text,
  address text,
  bedrooms integer,
  suites integer,
  parking_spaces integer,
  area_m2 numeric(12,2),
  asking_price numeric(14,2),
  owner_name text,
  owner_phone text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  status text not null default 'novo' check (status in ('novo','qualificado','negociando','cliente','inativo')),
  purpose text,
  preferred_neighborhoods text[],
  min_price numeric(14,2),
  max_price numeric(14,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  stage text not null default 'novo' check (stage in ('novo','contato','visita','proposta','negociacao','fechado_ganho','fechado_perdido')),
  sale_value numeric(14,2) not null default 0,
  expected_close_date date,
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
  status text not null default 'pendente' check (status in ('pendente','confirmado','realizado','cancelado')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  vgv numeric(14,2) not null default 0,
  gross_pct numeric(5,2) not null default 6,
  tax_pct numeric(5,2) not null default 9,
  participation_pct numeric(5,2) not null default 20,
  role_pct numeric(5,2) not null default 100,
  gross_amount numeric(14,2) generated always as (round(vgv * gross_pct / 100, 2)) stored,
  tax_amount numeric(14,2) generated always as (round((vgv * gross_pct / 100) * tax_pct / 100, 2)) stored,
  net_amount numeric(14,2) generated always as (round((vgv * gross_pct / 100) * (1 - tax_pct / 100), 2)) stored,
  user_amount numeric(14,2) generated always as (round((vgv * gross_pct / 100) * (1 - tax_pct / 100) * participation_pct / 100 * role_pct / 100, 2)) stored,
  status text not null default 'prevista' check (status in ('prevista','a_receber','recebida','cancelada')),
  due_date date,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vgv_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  reference_month date not null,
  vgv numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, deal_id, reference_month)
);

create index if not exists properties_user_id_idx on public.properties(user_id);
create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists deals_user_id_idx on public.deals(user_id);
create index if not exists appointments_user_id_idx on public.appointments(user_id);
create index if not exists commissions_user_id_idx on public.commissions(user_id);
create index if not exists vgv_entries_user_id_idx on public.vgv_entries(user_id);

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.clients enable row level security;
alter table public.deals enable row level security;
alter table public.appointments enable row level security;
alter table public.commissions enable row level security;
alter table public.vgv_entries enable row level security;

do $$
begin
  create policy "profiles_own_row" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "properties_own_rows" on public.properties for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "clients_own_rows" on public.clients for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "deals_own_rows" on public.deals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "appointments_own_rows" on public.appointments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "commissions_own_rows" on public.commissions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "vgv_entries_own_rows" on public.vgv_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1), 'Corretor'), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
  create trigger properties_set_updated_at before update on public.properties for each row execute procedure public.set_updated_at();
  create trigger clients_set_updated_at before update on public.clients for each row execute procedure public.set_updated_at();
  create trigger deals_set_updated_at before update on public.deals for each row execute procedure public.set_updated_at();
  create trigger appointments_set_updated_at before update on public.appointments for each row execute procedure public.set_updated_at();
  create trigger commissions_set_updated_at before update on public.commissions for each row execute procedure public.set_updated_at();
exception when duplicate_object then null;
end $$;
