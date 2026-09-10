-- Imobfy foundation: normalize the commercial journey without breaking
-- the existing tables. New modules can migrate progressively to these relations.

create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id uuid references public.owners(id) on delete set null,
  capture_type text not null default 'normal' check (capture_type in ('normal','exclusive','shared')),
  captured_at timestamptz not null default now(),
  origin text,
  commission_pct numeric(5,2) not null default 20,
  status text not null default 'active' check (status in ('active','inactive','sold','lost')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  visit_status text not null default 'pending' check (visit_status in ('pending','scheduled','visited','cancelled')),
  visited_at timestamptz,
  proposal_made boolean not null default false,
  sold boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, property_id)
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','completed','cancelled','no_show')),
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visit_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  sequence integer,
  visited boolean not null default false,
  notes text,
  unique (visit_id, property_id)
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  amount numeric(14,2) not null default 0,
  status text not null default 'sent' check (status in ('draft','sent','countered','accepted','rejected','expired')),
  financing boolean not null default false,
  down_payment numeric(14,2),
  proposed_at timestamptz not null default now(),
  responded_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  proposal_id uuid references public.proposals(id) on delete set null,
  sale_value numeric(14,2) not null default 0,
  sold_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  unique (deal_id)
);

create table if not exists public.commission_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  commission_id uuid not null references public.commissions(id) on delete cascade,
  amount numeric(14,2) not null default 0,
  received_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  activity_type text not null check (activity_type in ('note','call','whatsapp','email','visit','proposal','follow_up','stage_change','sale')),
  title text not null,
  description text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists owners_user_id_idx on public.owners(user_id);
create index if not exists captures_user_id_idx on public.captures(user_id);
create index if not exists captures_property_id_idx on public.captures(property_id);
create index if not exists deal_properties_user_id_idx on public.deal_properties(user_id);
create index if not exists deal_properties_deal_id_idx on public.deal_properties(deal_id);
create index if not exists deal_properties_property_id_idx on public.deal_properties(property_id);
create index if not exists visits_user_id_idx on public.visits(user_id);
create index if not exists visits_deal_id_idx on public.visits(deal_id);
create index if not exists visit_properties_visit_id_idx on public.visit_properties(visit_id);
create index if not exists proposals_user_id_idx on public.proposals(user_id);
create index if not exists proposals_deal_id_idx on public.proposals(deal_id);
create index if not exists proposals_property_id_idx on public.proposals(property_id);
create index if not exists sales_user_id_idx on public.sales(user_id);
create index if not exists sales_deal_id_idx on public.sales(deal_id);
create index if not exists commission_receipts_user_id_idx on public.commission_receipts(user_id);
create index if not exists activities_user_id_idx on public.activities(user_id);
create index if not exists activities_deal_id_idx on public.activities(deal_id);
create index if not exists ai_conversations_user_id_idx on public.ai_conversations(user_id);
create index if not exists ai_messages_conversation_id_idx on public.ai_messages(conversation_id);

alter table public.owners enable row level security;
alter table public.captures enable row level security;
alter table public.deal_properties enable row level security;
alter table public.visits enable row level security;
alter table public.visit_properties enable row level security;
alter table public.proposals enable row level security;
alter table public.sales enable row level security;
alter table public.commission_receipts enable row level security;
alter table public.activities enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

do $$
begin
  create policy "owners_own_rows" on public.owners for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "captures_own_rows" on public.captures for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "deal_properties_own_rows" on public.deal_properties for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "visits_own_rows" on public.visits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "visit_properties_own_rows" on public.visit_properties for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "proposals_own_rows" on public.proposals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "sales_own_rows" on public.sales for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "commission_receipts_own_rows" on public.commission_receipts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "activities_own_rows" on public.activities for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "ai_conversations_own_rows" on public.ai_conversations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "ai_messages_own_rows" on public.ai_messages for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

-- Keep updated_at consistent for the new mutable entities.
do $$
begin
  create trigger owners_set_updated_at before update on public.owners for each row execute procedure public.set_updated_at();
  create trigger captures_set_updated_at before update on public.captures for each row execute procedure public.set_updated_at();
  create trigger deal_properties_set_updated_at before update on public.deal_properties for each row execute procedure public.set_updated_at();
  create trigger visits_set_updated_at before update on public.visits for each row execute procedure public.set_updated_at();
  create trigger proposals_set_updated_at before update on public.proposals for each row execute procedure public.set_updated_at();
  create trigger ai_conversations_set_updated_at before update on public.ai_conversations for each row execute procedure public.set_updated_at();
exception when duplicate_object then null;
end $$;
