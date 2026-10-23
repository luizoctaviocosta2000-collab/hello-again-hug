-- Schema-only snapshot 2026-10-22: no user records. Disposable database only.
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.activities (id uuid default gen_random_uuid() not null, user_id uuid not null, client_id uuid, deal_id uuid, property_id uuid, activity_type text not null, title text not null, description text, occurred_at timestamp with time zone default now() not null, created_at timestamp with time zone default now() not null);
create table public.ai_conversations (id uuid default gen_random_uuid() not null, user_id uuid not null, title text default 'Nova conversa'::text not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.ai_messages (id uuid default gen_random_uuid() not null, user_id uuid not null, conversation_id uuid not null, role text not null, content text not null, created_at timestamp with time zone default now() not null);
create table public.ai_usage (user_id uuid not null, usage_date date not null, feature text not null, used_count integer default 0 not null, updated_at timestamp with time zone default now() not null);
create table public.appointments (id uuid default gen_random_uuid() not null, user_id uuid not null, client_id uuid, property_id uuid, deal_id uuid, title text not null, starts_at timestamp with time zone not null, ends_at timestamp with time zone, status text default 'scheduled'::text not null, notes text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.captures (id uuid default gen_random_uuid() not null, user_id uuid not null, property_id uuid not null, owner_id uuid, capture_type text default 'normal'::text not null, captured_at timestamp with time zone default now() not null, origin text, commission_pct numeric(5,2) default 20 not null, status text default 'active'::text not null, notes text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.clients (id uuid default gen_random_uuid() not null, user_id uuid not null, name text not null, email text, phone text, intent text, budget_min numeric, budget_max numeric, preferred_neighborhoods text[] default '{}'::text[] not null, property_types text[] default '{}'::text[] not null, bedrooms_min integer, notes text, status text default 'active'::text not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, state text, city text);
create table public.commission_receipts (id uuid default gen_random_uuid() not null, user_id uuid not null, commission_id uuid not null, amount numeric(14,2) default 0 not null, received_at timestamp with time zone default now() not null, notes text, created_at timestamp with time zone default now() not null);
create table public.commissions (id uuid default gen_random_uuid() not null, user_id uuid not null, deal_id uuid, property_value numeric default 0 not null, brokerage_pct numeric default 6 not null, gross_amount numeric default 0 not null, tax_pct numeric default 9 not null, tax_amount numeric default 0 not null, net_brokerage numeric default 0 not null, participation_pct numeric default 0 not null, user_amount numeric default 0 not null, status text default 'forecast'::text not null, received_at timestamp with time zone, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, due_at timestamp with time zone, paid_at timestamp with time zone, notes text, vgv numeric(14,2) default 0 not null, gross_pct numeric(5,2) default 6 not null, role_pct numeric(5,2) default 100 not null, commission_type text default 'venda'::text not null, capture_id uuid, sale_id uuid, due_date date, reference_month date);
create table public.deal_properties (id uuid default gen_random_uuid() not null, user_id uuid not null, deal_id uuid not null, property_id uuid not null, visit_status text default 'visited'::text not null, proposal_made boolean default false not null, sold boolean default false not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.deals (id uuid default gen_random_uuid() not null, user_id uuid not null, property_id uuid, client_id uuid, status text default 'new'::text not null, property_value numeric default 0 not null, brokerage_pct numeric default 6 not null, tax_pct numeric default 9 not null, participation_pct numeric default 20 not null, sides text[] default '{}'::text[] not null, notes text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, closed_at timestamp with time zone, expected_close_at timestamp with time zone, title text default 'Novo atendimento'::text not null, stage text default 'novo'::text not null, operation_value numeric(14,2) default 0 not null, sale_value numeric(14,2) default 0 not null);
create table public.owners (id uuid default gen_random_uuid() not null, user_id uuid not null, name text not null, phone text, email text, notes text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.profiles (id uuid not null, name text not null, email text not null, creci text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, default_commission_pct numeric(5,2) default 6 not null, tax_pct numeric(5,2) default 9 not null, participation_pct numeric(5,2) default 20 not null, vgv_goal numeric(14,2) default 0 not null, whatsapp_phone text, full_name text);
create table public.properties (id uuid default gen_random_uuid() not null, user_id uuid not null, title text not null, address text, neighborhood text, city text, property_type text, bedrooms integer, bathrooms integer, parking_spaces integer, area_m2 numeric, sale_value numeric default 0 not null, status text default 'active'::text not null, owner_name text, owner_phone text, notes text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, state text, asking_price numeric(14,2), property_code text, purpose text default 'venda'::text not null, address_number text, address_complement text, adress_complement text, zip_code text, suites integer, condominium_fee numeric, iptu_amount numeric, habite_se text, description text, origin text, capture_date timestamp with time zone, exclusivity boolean default false not null, commercial_notes text);
create table public.property_photos (id uuid default gen_random_uuid() not null, user_id uuid not null, property_id uuid not null, storage_path text not null, category text default 'outros'::text not null, sort_order integer default 0 not null, is_cover boolean default false not null, created_at timestamp with time zone default now() not null);
create table public.property_share_links (id uuid default gen_random_uuid() not null, property_id uuid not null, user_id uuid not null, token text not null, is_active boolean default true not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.proposals (id uuid default gen_random_uuid() not null, user_id uuid not null, deal_id uuid not null, property_id uuid not null, amount numeric(14,2) default 0 not null, status text default 'sent'::text not null, financing boolean default false not null, down_payment numeric(14,2), proposed_at timestamp with time zone default now() not null, responded_at timestamp with time zone, notes text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.sales (id uuid default gen_random_uuid() not null, user_id uuid not null, deal_id uuid, property_id uuid not null, proposal_id uuid, sale_value numeric(14,2) default 0 not null, sold_at timestamp with time zone default now() not null, notes text, created_at timestamp with time zone default now() not null, commission_sides text[] default ARRAY['sale'::text] not null);
create table public.vgv_entries (id uuid default gen_random_uuid() not null, user_id uuid not null, deal_id uuid, property_value numeric default 0 not null, month date not null, created_at timestamp with time zone default now() not null, reference_month date, vgv numeric(14,2) default 0 not null);
create table public.visit_properties (id uuid default gen_random_uuid() not null, user_id uuid not null, visit_id uuid not null, property_id uuid not null, sequence integer, visited boolean default false not null, notes text);
create table public.visits (id uuid default gen_random_uuid() not null, user_id uuid not null, deal_id uuid, client_id uuid, starts_at timestamp with time zone not null, ends_at timestamp with time zone, status text default 'scheduled'::text not null, location text, notes text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
alter table sales add constraint sales_deal_id_key UNIQUE (deal_id);
alter table commissions add constraint commissions_pkey PRIMARY KEY (id);
alter table captures add constraint captures_pkey PRIMARY KEY (id);
alter table clients add constraint clients_pkey PRIMARY KEY (id);
alter table clients add constraint clients_id_user_id_key UNIQUE (id, user_id);
alter table commission_receipts add constraint commission_receipts_pkey PRIMARY KEY (id);
alter table vgv_entries add constraint vgv_entries_pkey PRIMARY KEY (id);
alter table activities add constraint activities_pkey PRIMARY KEY (id);
alter table visits add constraint visits_pkey PRIMARY KEY (id);
alter table appointments add constraint appointments_pkey PRIMARY KEY (id);
alter table properties add constraint properties_id_user_id_key UNIQUE (id, user_id);
alter table deal_properties add constraint deal_properties_pkey PRIMARY KEY (id);
alter table visit_properties add constraint visit_properties_pkey PRIMARY KEY (id);
alter table visit_properties add constraint visit_properties_visit_id_property_id_key UNIQUE (visit_id, property_id);
alter table profiles add constraint profiles_default_commission_pct_range CHECK (((default_commission_pct >= (0)::numeric) AND (default_commission_pct <= (100)::numeric)));
alter table profiles add constraint profiles_tax_pct_range CHECK (((tax_pct >= (0)::numeric) AND (tax_pct <= (100)::numeric)));
alter table profiles add constraint profiles_participation_pct_range CHECK (((participation_pct >= (0)::numeric) AND (participation_pct <= (100)::numeric)));
alter table profiles add constraint profiles_vgv_goal_nonnegative CHECK ((vgv_goal >= (0)::numeric));
alter table ai_conversations add constraint ai_conversations_pkey PRIMARY KEY (id);
alter table deal_properties add constraint deal_properties_user_id_deal_id_property_id_key UNIQUE (user_id, deal_id, property_id);
alter table ai_messages add constraint ai_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])));
alter table ai_messages add constraint ai_messages_pkey PRIMARY KEY (id);
alter table deals add constraint deals_pkey PRIMARY KEY (id);
alter table deals add constraint deals_id_user_id_key UNIQUE (id, user_id);
alter table property_photos add constraint property_photos_pkey PRIMARY KEY (id);
alter table property_photos add constraint property_photos_property_id_storage_path_key UNIQUE (property_id, storage_path);
alter table proposals add constraint proposals_pkey PRIMARY KEY (id);
alter table properties add constraint properties_pkey PRIMARY KEY (id);
alter table property_share_links add constraint property_share_links_pkey PRIMARY KEY (id);
alter table property_share_links add constraint property_share_links_token_key UNIQUE (token);
alter table property_share_links add constraint property_share_links_property_id_key UNIQUE (property_id);
alter table deal_properties add constraint deal_properties_visit_status_check CHECK ((visit_status = ANY (ARRAY['planned'::text, 'visited'::text, 'proposal'::text, 'sold'::text, 'discarded'::text])));
alter table owners add constraint owners_pkey PRIMARY KEY (id);
alter table ai_usage add constraint ai_usage_feature_check CHECK ((feature = ANY (ARRAY['chat'::text, 'audio'::text, 'photos'::text])));
alter table ai_usage add constraint ai_usage_used_count_check CHECK ((used_count >= 0));
alter table ai_usage add constraint ai_usage_pkey PRIMARY KEY (user_id, usage_date, feature);
alter table sales add constraint sales_pkey PRIMARY KEY (id);
alter table commissions add constraint commissions_id_user_id_key UNIQUE (id, user_id);
alter table profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table activities add constraint activities_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;
alter table commissions add constraint commissions_capture_id_fkey FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE SET NULL;
alter table commissions add constraint commissions_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL;
alter table ai_conversations add constraint ai_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table ai_messages add constraint ai_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table ai_messages add constraint ai_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE;
alter table property_photos add constraint property_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table property_photos add constraint property_photos_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
alter table property_share_links add constraint property_share_links_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
alter table property_share_links add constraint property_share_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table ai_usage add constraint ai_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table commission_receipts add constraint commission_receipts_commission_owner_fkey FOREIGN KEY (commission_id, user_id) REFERENCES commissions(id, user_id) ON DELETE CASCADE;
alter table profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table properties add constraint properties_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table clients add constraint clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table deals add constraint deals_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table deals add constraint deals_property_id_user_id_fkey FOREIGN KEY (property_id, user_id) REFERENCES properties(id, user_id) ON DELETE SET NULL;
alter table deals add constraint deals_client_id_user_id_fkey FOREIGN KEY (client_id, user_id) REFERENCES clients(id, user_id) ON DELETE SET NULL;
alter table appointments add constraint appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table appointments add constraint appointments_client_id_user_id_fkey FOREIGN KEY (client_id, user_id) REFERENCES clients(id, user_id) ON DELETE SET NULL;
alter table appointments add constraint appointments_property_id_user_id_fkey FOREIGN KEY (property_id, user_id) REFERENCES properties(id, user_id) ON DELETE SET NULL;
alter table appointments add constraint appointments_deal_id_user_id_fkey FOREIGN KEY (deal_id, user_id) REFERENCES deals(id, user_id) ON DELETE SET NULL;
alter table commissions add constraint commissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table commissions add constraint commissions_deal_id_user_id_fkey FOREIGN KEY (deal_id, user_id) REFERENCES deals(id, user_id) ON DELETE SET NULL;
alter table vgv_entries add constraint vgv_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table vgv_entries add constraint vgv_entries_deal_id_user_id_fkey FOREIGN KEY (deal_id, user_id) REFERENCES deals(id, user_id) ON DELETE SET NULL;
alter table deal_properties add constraint deal_properties_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table deal_properties add constraint deal_properties_deal_id_user_id_fkey FOREIGN KEY (deal_id, user_id) REFERENCES deals(id, user_id) ON DELETE CASCADE;
alter table deal_properties add constraint deal_properties_property_id_user_id_fkey FOREIGN KEY (property_id, user_id) REFERENCES properties(id, user_id) ON DELETE CASCADE;
alter table owners add constraint owners_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table captures add constraint captures_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table captures add constraint captures_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
alter table captures add constraint captures_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE SET NULL;
alter table visits add constraint visits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table visits add constraint visits_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table visits add constraint visits_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table visit_properties add constraint visit_properties_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table visit_properties add constraint visit_properties_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE;
alter table visit_properties add constraint visit_properties_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
alter table proposals add constraint proposals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table proposals add constraint proposals_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table proposals add constraint proposals_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
alter table sales add constraint sales_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table sales add constraint sales_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
alter table sales add constraint sales_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT;
alter table sales add constraint sales_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL;
alter table commission_receipts add constraint commission_receipts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table activities add constraint activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table activities add constraint activities_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
alter table activities add constraint activities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
CREATE INDEX sales_one_per_deal_idx ON public.sales USING btree (deal_id);
CREATE INDEX properties_user_neighborhood_idx ON public.properties USING btree (user_id, neighborhood);
CREATE UNIQUE INDEX vgv_entries_user_deal_month_uidx ON public.vgv_entries USING btree (user_id, deal_id, reference_month);
CREATE INDEX deals_user_status_idx ON public.deals USING btree (user_id, status);
CREATE UNIQUE INDEX vgv_entries_user_deal_unique_idx ON public.vgv_entries USING btree (user_id, deal_id) WHERE (deal_id IS NOT NULL);
CREATE INDEX commissions_deal_user_idx ON public.commissions USING btree (deal_id, user_id);
CREATE UNIQUE INDEX commissions_user_deal_unique_idx ON public.commissions USING btree (user_id, deal_id) WHERE (deal_id IS NOT NULL);
CREATE INDEX commissions_user_sale_idx ON public.commissions USING btree (user_id, sale_id);
CREATE INDEX deal_properties_deal_id_user_id_idx ON public.deal_properties USING btree (deal_id, user_id);
CREATE INDEX deals_user_closed_idx ON public.deals USING btree (user_id, closed_at);
CREATE INDEX captures_property_user_active_idx ON public.captures USING btree (property_id, user_id, status);
CREATE INDEX activities_client_id_idx ON public.activities USING btree (client_id);
CREATE INDEX deal_properties_user_deal_idx ON public.deal_properties USING btree (user_id, deal_id);
CREATE INDEX sales_user_deal_idx ON public.sales USING btree (user_id, deal_id);
CREATE INDEX clients_user_status_idx ON public.clients USING btree (user_id, status);
CREATE INDEX commission_receipts_user_id_idx ON public.commission_receipts USING btree (user_id);
CREATE INDEX commissions_user_received_idx ON public.commissions USING btree (user_id, received_at);
CREATE INDEX appointments_deal_user_idx ON public.appointments USING btree (deal_id, user_id);
CREATE INDEX proposals_user_id_idx ON public.proposals USING btree (user_id);
CREATE INDEX visits_client_id_idx ON public.visits USING btree (client_id);
CREATE INDEX ai_messages_conversation_created_idx ON public.ai_messages USING btree (conversation_id, created_at);
CREATE INDEX visits_user_id_idx ON public.visits USING btree (user_id);
CREATE INDEX deals_user_property_idx ON public.deals USING btree (user_id, property_id);
CREATE INDEX appointments_user_id_idx ON public.appointments USING btree (user_id);
CREATE INDEX captures_user_id_idx ON public.captures USING btree (user_id);
CREATE INDEX commissions_user_due_idx ON public.commissions USING btree (user_id, due_at);
CREATE INDEX deals_user_stage_idx ON public.deals USING btree (user_id, stage);
CREATE INDEX deal_properties_user_property_idx ON public.deal_properties USING btree (user_id, property_id);
CREATE INDEX visit_properties_property_id_idx ON public.visit_properties USING btree (property_id);
CREATE INDEX appointments_user_status_idx ON public.appointments USING btree (user_id, status);
CREATE INDEX sales_proposal_id_idx ON public.sales USING btree (proposal_id);
CREATE INDEX commissions_user_id_idx ON public.commissions USING btree (user_id);
CREATE INDEX deals_user_client_idx ON public.deals USING btree (user_id, client_id);
CREATE INDEX appointments_property_user_idx ON public.appointments USING btree (property_id, user_id);
CREATE INDEX owners_user_id_idx ON public.owners USING btree (user_id);
CREATE INDEX visits_deal_id_idx ON public.visits USING btree (deal_id);
CREATE INDEX deals_user_updated_idx ON public.deals USING btree (user_id, updated_at DESC);
CREATE INDEX commissions_sale_id_idx ON public.commissions USING btree (sale_id);
CREATE INDEX deals_client_user_idx ON public.deals USING btree (client_id, user_id);
CREATE INDEX deals_user_id_idx ON public.deals USING btree (user_id);
CREATE INDEX appointments_user_starts_idx ON public.appointments USING btree (user_id, starts_at);
CREATE INDEX commission_receipts_commission_id_idx ON public.commission_receipts USING btree (commission_id);
CREATE INDEX properties_user_state_city_idx ON public.properties USING btree (user_id, state, city);
CREATE INDEX ai_messages_user_created_idx ON public.ai_messages USING btree (user_id, created_at DESC);
CREATE INDEX commissions_user_capture_idx ON public.commissions USING btree (user_id, capture_id);
CREATE INDEX properties_user_state_city_neighborhood_idx ON public.properties USING btree (user_id, state, city, neighborhood);
CREATE INDEX property_share_links_user_id_idx ON public.property_share_links USING btree (user_id);
CREATE INDEX activities_property_id_idx ON public.activities USING btree (property_id);
CREATE INDEX sales_property_id_idx ON public.sales USING btree (property_id);
CREATE INDEX commissions_capture_id_idx ON public.commissions USING btree (capture_id);
CREATE INDEX deal_properties_property_id_user_id_idx ON public.deal_properties USING btree (property_id, user_id);
CREATE INDEX property_photos_user_property_order_idx ON public.property_photos USING btree (user_id, property_id, sort_order);
CREATE INDEX activities_deal_id_idx ON public.activities USING btree (deal_id);
CREATE INDEX appointments_client_user_idx ON public.appointments USING btree (client_id, user_id);
CREATE INDEX vgv_entries_deal_user_idx ON public.vgv_entries USING btree (deal_id, user_id);
CREATE INDEX vgv_entries_user_id_idx ON public.vgv_entries USING btree (user_id);
CREATE INDEX captures_owner_id_idx ON public.captures USING btree (owner_id);
CREATE INDEX deals_property_user_idx ON public.deals USING btree (property_id, user_id);
CREATE INDEX proposals_property_id_idx ON public.proposals USING btree (property_id);
CREATE INDEX properties_user_status_idx ON public.properties USING btree (user_id, status);
CREATE INDEX ai_conversations_user_updated_idx ON public.ai_conversations USING btree (user_id, updated_at DESC);
CREATE INDEX visit_properties_user_id_idx ON public.visit_properties USING btree (user_id);
CREATE INDEX sales_user_id_idx ON public.sales USING btree (user_id);
CREATE INDEX activities_user_id_idx ON public.activities USING btree (user_id);
CREATE UNIQUE INDEX properties_user_property_code_unique ON public.properties USING btree (user_id, property_code) WHERE (property_code IS NOT NULL);
CREATE INDEX vgv_entries_user_month_idx ON public.vgv_entries USING btree (user_id, reference_month);
CREATE INDEX property_share_links_active_token_idx ON public.property_share_links USING btree (token) WHERE (is_active = true);
CREATE INDEX clients_user_state_city_idx ON public.clients USING btree (user_id, state, city);
CREATE INDEX proposals_deal_id_idx ON public.proposals USING btree (deal_id);
CREATE INDEX commissions_user_status_idx ON public.commissions USING btree (user_id, status);
CREATE INDEX clients_user_id_idx ON public.clients USING btree (user_id);
CREATE INDEX properties_user_id_idx ON public.properties USING btree (user_id);
CREATE OR REPLACE FUNCTION public.sync_closed_deal_financials()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  gross numeric;
  tax numeric;
  net numeric;
  participation numeric;
  user_amount numeric;
  closed_month date;
begin
  if new.status = 'closed' and (old.status is distinct from 'closed') then
    new.closed_at := coalesce(new.closed_at, now());
  end if;

  if new.status = 'closed' then
    gross := coalesce(new.property_value,0) * coalesce(new.brokerage_pct,6) / 100;
    tax := gross * coalesce(new.tax_pct,9) / 100;
    net := gross - tax;
    participation := coalesce(new.participation_pct,0);
    user_amount := net * participation / 100;
    closed_month := date_trunc('month', coalesce(new.closed_at,now()))::date;

    insert into public.vgv_entries(user_id,deal_id,property_value,month)
    values(new.user_id,new.id,coalesce(new.property_value,0),closed_month)
    on conflict (user_id,deal_id) where deal_id is not null
    do update set property_value=excluded.property_value, month=excluded.month;

    insert into public.commissions(user_id,deal_id,property_value,brokerage_pct,gross_amount,tax_pct,tax_amount,net_brokerage,participation_pct,user_amount,status,notes)
    values(new.user_id,new.id,coalesce(new.property_value,0),coalesce(new.brokerage_pct,6),gross,coalesce(new.tax_pct,9),tax,net,participation,user_amount,'receivable','Gerada automaticamente pelo fechamento do negócio.')
    on conflict (user_id,deal_id) where deal_id is not null
    do update set property_value=excluded.property_value, brokerage_pct=excluded.brokerage_pct, gross_amount=excluded.gross_amount, tax_pct=excluded.tax_pct, tax_amount=excluded.tax_amount, net_brokerage=excluded.net_brokerage, participation_pct=excluded.participation_pct, user_amount=excluded.user_amount;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Corretor'
  );

  insert into public.profiles (id, name, full_name, email)
  values (new.id, v_name, v_name, new.email)
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_sale_closing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.deals
  set status='closed', stage='fechado_ganho', property_id=new.property_id,
      property_value=new.sale_value, operation_value=new.sale_value,
      sale_value=new.sale_value, closed_at=new.sold_at, updated_at=now()
  where id=new.deal_id and user_id=new.user_id;

  update public.deal_properties
  set sold=(property_id=new.property_id), updated_at=now()
  where deal_id=new.deal_id and user_id=new.user_id;

  update public.properties
  set status='sold', sale_value=new.sale_value, updated_at=now()
  where id=new.property_id and user_id=new.user_id;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_accepted_proposal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if new.status in ('accepted','aceita','accepted_final') then
  update public.deals set stage='negociacao', operation_value=new.amount, sale_value=new.amount, property_id=new.property_id, property_value=new.amount, updated_at=now() where id=new.deal_id and user_id=new.user_id;
  update public.deal_properties set proposal_made=true where deal_id=new.deal_id and property_id=new.property_id and user_id=new.user_id;
 end if;
 return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.validate_proposal_property()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from public.deal_properties dp
    where dp.deal_id = new.deal_id
      and dp.property_id = new.property_id
      and dp.user_id = new.user_id
      and dp.visit_status = 'visited'
  ) then
    raise exception 'O imóvel precisa ter sido visitado antes de registrar a proposta';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_commission_receipt_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  commission_amount numeric;
  already_received numeric;
begin
  -- DELETE also serializes with inserts/updates. Cascading parent deletion is valid.
  if tg_op = 'DELETE' then
    perform 1 from public.commissions
    where id = old.commission_id and user_id = old.user_id
    for update;
    return old;
  end if;

  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'Recebimento não autorizado';
  end if;
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.commission_id is distinct from old.commission_id
       or new.user_id is distinct from old.user_id then
      raise exception using errcode = '23514', message = 'O vínculo do recebimento não pode ser alterado';
    end if;
  end if;

  -- Ownership is checked before reading any balance; serialize before summing.
  select user_amount into commission_amount
  from public.commissions
  where id = new.commission_id and user_id = new.user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Recebimento não autorizado';
  end if;
  if new.amount is null or new.amount <= 0
     or new.amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = '23514', message = 'O recebimento deve ser maior que zero e finito';
  end if;
  if commission_amount is null or commission_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = '23514', message = 'A comissão possui valor inválido';
  end if;
  select coalesce(sum(amount), 0) into already_received
  from public.commission_receipts
  where commission_id = new.commission_id and user_id = new.user_id
    and id <> new.id;
  if already_received + new.amount > commission_amount then
    raise exception using errcode = '23514', message = 'O recebimento ultrapassa o valor restante da comissão';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_sale_proposal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Venda direta (fora do funil) não precisa de negócio/proposta.
  if new.deal_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.proposals p
    where p.id = new.proposal_id
      and p.deal_id = new.deal_id
      and p.property_id = new.property_id
      and p.user_id = new.user_id
      and p.status in ('accepted','aceita','accepted_final')
  ) then
    raise exception 'A venda precisa estar vinculada a uma proposta aceita';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.register_direct_sale(p_user_id uuid, p_property_id uuid, p_sale_value numeric, p_sold_at timestamp with time zone, p_commission_sides text[] DEFAULT ARRAY['sale'::text], p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare sale_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Usuário não autorizado'; end if;
  if p_property_id is null then raise exception 'Selecione o imóvel vendido'; end if;
  if p_sale_value is null or p_sale_value <= 0 then raise exception 'Informe um valor de venda válido'; end if;
  if p_sold_at is null then raise exception 'Informe a data da venda'; end if;
  if p_commission_sides is null or cardinality(p_commission_sides) = 0 then raise exception 'Informe sua atuação na venda'; end if;
  if not exists (select 1 from public.properties where id = p_property_id and user_id = p_user_id) then raise exception 'Imóvel não encontrado no seu estoque'; end if;
  insert into public.sales(user_id,deal_id,property_id,proposal_id,sale_value,sold_at,notes,commission_sides)
  values(p_user_id,null,p_property_id,null,round(p_sale_value,2),p_sold_at,p_notes,p_commission_sides)
  returning id into sale_id;
  return sale_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.register_manual_vgv(p_user_id uuid, p_reference_month date, p_vgv numeric, p_commission_type text DEFAULT 'captacao'::text, p_split boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare p record; gross numeric(14,2); tax numeric(14,2); net numeric(14,2); pct numeric(5,2); amount numeric(14,2); vgv_id uuid; ref_month date;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Usuário não autorizado'; end if;
  if p_vgv is null or p_vgv<=0 then raise exception 'O VGV deve ser maior que zero'; end if;
  if p_commission_type not in ('captacao','venda','ambos') then raise exception 'Tipo de comissão inválido'; end if;
  ref_month:=date_trunc('month',p_reference_month)::date;
  select * into p from public.profiles where id=p_user_id;
  if p.id is null then raise exception 'Perfil não encontrado'; end if;
  insert into public.vgv_entries(user_id,deal_id,month,reference_month,property_value,vgv)
  values(p_user_id,null,ref_month,ref_month,p_vgv,p_vgv) returning id into vgv_id;
  gross:=round(p_vgv*coalesce(p.default_commission_pct,6)/100,2);
  tax:=round(gross*coalesce(p.tax_pct,9)/100,2);
  net:=gross-tax;
  if p_commission_type in ('captacao','ambos') then
    pct:=case when p_split then 10 else coalesce(p.participation_pct,20) end;
    amount:=round(net*pct/100,2);
    insert into public.commissions(user_id,deal_id,vgv,gross_pct,tax_pct,participation_pct,role_pct,status,commission_type,property_value,brokerage_pct,gross_amount,tax_amount,net_brokerage,user_amount,notes,reference_month)
    values(p_user_id,null,p_vgv,coalesce(p.default_commission_pct,6),coalesce(p.tax_pct,9),pct,100,'a_receber','captacao',p_vgv,coalesce(p.default_commission_pct,6),gross,tax,net,amount,'Comissão histórica lançada junto ao VGV manual.',ref_month);
  end if;
  if p_commission_type in ('venda','ambos') then
    pct:=case when p_split then 10 else coalesce(p.participation_pct,20) end;
    amount:=round(net*pct/100,2);
    insert into public.commissions(user_id,deal_id,vgv,gross_pct,tax_pct,participation_pct,role_pct,status,commission_type,property_value,brokerage_pct,gross_amount,tax_amount,net_brokerage,user_amount,notes,reference_month)
    values(p_user_id,null,p_vgv,coalesce(p.default_commission_pct,6),coalesce(p.tax_pct,9),pct,100,'a_receber','venda',p_vgv,coalesce(p.default_commission_pct,6),gross,tax,net,amount,'Comissão histórica lançada junto ao VGV manual.',ref_month);
  end if;
  return jsonb_build_object('vgv_id',vgv_id,'gross',gross,'tax',tax,'net',net);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_ai_commission_summary(p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.priority, x.due_date nulls last, x.created_at desc), '[]'::jsonb)
  from (
    select
      c.id,
      c.deal_id,
      c.commission_type,
      c.status,
      c.user_amount as commission_amount,
      greatest(c.user_amount - coalesce(r.received_amount,0),0) as remaining_amount,
      c.due_date,
      c.paid_at,
      c.reference_month,
      case
        when c.status in ('a_receber','receivable','partially_received')
          and c.due_date is not null
          and c.due_date < current_date then 0
        when c.status in ('a_receber','receivable','partially_received') then 1
        else 2
      end as priority,
      c.created_at
    from public.commissions c
    left join lateral (
      select coalesce(sum(cr.amount),0) as received_amount
      from public.commission_receipts cr
      where cr.commission_id = c.id
    ) r on true
    where c.user_id = auth.uid()
    order by priority, c.due_date nulls last, c.created_at desc
    limit greatest(1, least(coalesce(p_limit,20),100))
  ) x;
$function$;

CREATE OR REPLACE FUNCTION public.get_ai_vgv_summary(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with scoped as (
    select
      ve.reference_month,
      ve.vgv,
      ve.deal_id
    from public.vgv_entries ve
    where ve.user_id = auth.uid()
      and (p_from is null or ve.reference_month >= date_trunc('month', p_from)::date)
      and (p_to is null or ve.reference_month <= date_trunc('month', p_to)::date)
  ),
  monthly as (
    select reference_month, sum(vgv) as vgv
    from scoped
    group by reference_month
    order by reference_month
  )
  select jsonb_build_object(
    'vgv_total', coalesce((select sum(vgv) from scoped),0),
    'deal_count', (select count(distinct deal_id) from scoped where deal_id is not null),
    'entry_count', (select count(*) from scoped),
    'monthly', coalesce((select jsonb_agg(jsonb_build_object('reference_month', reference_month, 'vgv', vgv) order by reference_month) from monthly),'[]'::jsonb)
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_ai_financial_summary()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'total_received', coalesce(sum(
      case
        when coalesce(r.receipt_count, 0) > 0 then r.received_amount
        when c.status = 'received' then c.user_amount
        else 0
      end
    ), 0),
    'total_to_receive', coalesce(sum(case when c.status in ('a_receber','receivable','partially_received') then greatest(c.user_amount - coalesce(r.received_amount,0),0) else 0 end), 0),
    'total_open', coalesce(sum(case when c.status in ('a_receber','receivable','partially_received') then c.user_amount else 0 end), 0),
    'overdue_to_receive', coalesce(sum(case when c.status in ('a_receber','receivable','partially_received') and c.due_date is not null and c.due_date < current_date then greatest(c.user_amount - coalesce(r.received_amount,0),0) else 0 end), 0),
    'commission_count', count(c.id),
    'open_commission_count', count(c.id) filter (where c.status in ('a_receber','receivable','partially_received')),
    'received_commission_count', count(c.id) filter (where c.status = 'received')
  )
  from public.commissions c
  left join lateral (
    select coalesce(sum(cr.amount),0) as received_amount, count(*) as receipt_count
    from public.commission_receipts cr
    where cr.commission_id = c.id
  ) r on true
  where c.user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.sync_property_address_complement_alias()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    if new.address_complement is null and new.adress_complement is not null then
      new.address_complement := new.adress_complement;
    elsif new.adress_complement is null and new.address_complement is not null then
      new.adress_complement := new.address_complement;
    end if;
  else
    if new.address_complement is distinct from old.address_complement then
      new.adress_complement := new.address_complement;
    elsif new.adress_complement is distinct from old.adress_complement then
      new.address_complement := new.adress_complement;
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_property_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  next_number integer;
begin
  if new.user_id is null then
    raise exception 'user_id is required to generate a property code';
  end if;

  -- Serialize code generation for this user's inventory.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if tg_op = 'INSERT' then
    select coalesce(max(substring(property_code from '^IMB-([0-9]+)$')::integer), 0) + 1
      into next_number
    from public.properties
    where user_id = new.user_id;
    new.property_code := 'IMB-' || lpad(next_number::text, 3, '0');
  elsif new.property_code is null or btrim(new.property_code) = '' then
    select coalesce(max(substring(property_code from '^IMB-([0-9]+)$')::integer), 0) + 1
      into next_number
    from public.properties
    where user_id = new.user_id and id <> new.id;
    new.property_code := 'IMB-' || lpad(next_number::text, 3, '0');
  else
    -- Keep an existing code stable when editing other property fields.
    new.property_code := old.property_code;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_sale_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p record;
  c record;
  d record;
  gross numeric(14,2);
  tax numeric(14,2);
  net numeric(14,2);
  sale_pct numeric(5,2);
  cap_pct numeric(5,2);
  sale_user_amount numeric(14,2);
  cap_user_amount numeric(14,2);
  sides text[];
  has_explicit_sides boolean := false;
begin
  select * into p from public.profiles where id = new.user_id;
  if p.id is null then
    raise exception 'Perfil não encontrado';
  end if;

  if new.deal_id is not null then
    select * into d
    from public.deals
    where id = new.deal_id and user_id = new.user_id;
    has_explicit_sides := coalesce(array_length(d.sides, 1), 0) > 0;
  end if;

  if new.deal_id is null then
    sides := coalesce(new.commission_sides, array['sale']::text[]);
  elsif has_explicit_sides then
    sides := d.sides;
  else
    sides := coalesce(new.commission_sides, array['sale']::text[]);
  end if;

  gross := round(new.sale_value * coalesce(p.default_commission_pct, 6) / 100, 2);
  tax := round(gross * coalesce(p.tax_pct, 9) / 100, 2);
  net := gross - tax;

  if 'sale_split' = any(sides) then
    sale_pct := 10;
  elsif 'sale' = any(sides) then
    sale_pct := coalesce(p.participation_pct, 20);
  else
    sale_pct := null;
  end if;

  if sale_pct is not null then
    sale_user_amount := round(net * sale_pct / 100, 2);
    insert into public.commissions(
      user_id, deal_id, vgv, gross_pct, tax_pct, participation_pct, role_pct,
      status, commission_type, sale_id, property_value, brokerage_pct,
      gross_amount, tax_amount, net_brokerage, user_amount
    ) values (
      new.user_id, new.deal_id, new.sale_value,
      coalesce(p.default_commission_pct, 6), coalesce(p.tax_pct, 9),
      sale_pct, 100, 'a_receber', 'venda', new.id, new.sale_value,
      coalesce(p.default_commission_pct, 6), gross, tax, net, sale_user_amount
    );
  end if;

  select * into c
  from public.captures
  where property_id = new.property_id
    and user_id = new.user_id
    and status = 'active'
  order by captured_at desc
  limit 1;

  if c.id is not null and (
    'capture' = any(sides)
    or 'capture_split' = any(sides)
    or not has_explicit_sides
  ) then
    if 'capture_split' = any(sides) then
      cap_pct := 10;
    else
      cap_pct := coalesce(c.commission_pct, 20);
    end if;

    cap_user_amount := round(net * cap_pct / 100, 2);
    insert into public.commissions(
      user_id, deal_id, vgv, gross_pct, tax_pct, participation_pct, role_pct,
      status, commission_type, capture_id, sale_id, property_value, brokerage_pct,
      gross_amount, tax_amount, net_brokerage, user_amount
    ) values (
      new.user_id, new.deal_id, new.sale_value,
      coalesce(p.default_commission_pct, 6), coalesce(p.tax_pct, 9),
      cap_pct, 100, 'a_receber', 'captacao', c.id, new.id, new.sale_value,
      coalesce(p.default_commission_pct, 6), gross, tax, net, cap_user_amount
    );
  end if;

  insert into public.vgv_entries(user_id, deal_id, reference_month, vgv, property_value, month)
  values (
    new.user_id, new.deal_id, date_trunc('month', new.sold_at)::date,
    new.sale_value, new.sale_value, date_trunc('month', new.sold_at)::date
  )
  on conflict (user_id, deal_id, reference_month) do update
    set vgv = excluded.vgv,
        property_value = excluded.property_value,
        month = excluded.month;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_profile_names()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    new.name := coalesce(nullif(btrim(new.name), ''), nullif(btrim(new.full_name), ''), 'Corretor');
    new.full_name := coalesce(nullif(btrim(new.full_name), ''), new.name);
  else
    if new.name is distinct from old.name and new.full_name is not distinct from old.full_name then
      new.name := coalesce(nullif(btrim(new.name), ''), nullif(btrim(old.full_name), ''), 'Corretor');
      new.full_name := new.name;
    elsif new.full_name is distinct from old.full_name and new.name is not distinct from old.name then
      new.full_name := coalesce(nullif(btrim(new.full_name), ''), nullif(btrim(old.name), ''), 'Corretor');
      new.name := new.full_name;
    else
      new.name := coalesce(nullif(btrim(new.name), ''), nullif(btrim(new.full_name), ''), nullif(btrim(old.name), ''), 'Corretor');
      new.full_name := coalesce(nullif(btrim(new.full_name), ''), new.name);
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_feature text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_limit integer;
  v_today date := (now() at time zone 'utc')::date;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_limit := case p_feature
    when 'chat' then 60
    when 'audio' then 30
    when 'photos' then 20
    else null
  end;

  if v_limit is null then
    raise exception 'Invalid AI feature' using errcode = '22023';
  end if;

  insert into public.ai_usage (user_id, usage_date, feature, used_count, updated_at)
  values (v_user_id, v_today, p_feature, 1, now())
  on conflict (user_id, usage_date, feature)
  do update set
    used_count = public.ai_usage.used_count + 1,
    updated_at = now()
  where public.ai_usage.used_count < v_limit
  returning used_count into v_count;

  return found;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_sale_from_closed_deal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  sale_property uuid;
  sale_value numeric(14,2);
  accepted_proposal_id uuid;
begin
  if new.status = 'closed' and coalesce(old.status, '') <> 'closed' then
    sale_property := coalesce(new.property_id, (
      select dp.property_id
      from public.deal_properties dp
      where dp.deal_id = new.id
        and dp.user_id = new.user_id
        and dp.sold = true
      order by dp.updated_at desc nulls last
      limit 1
    ));
    sale_value := coalesce(nullif(new.sale_value, 0), nullif(new.property_value, 0), nullif(new.operation_value, 0), 0);

    if sale_property is null then
      raise exception 'Não é possível fechar o negócio sem imóvel vendido.';
    end if;

    select p.id
      into accepted_proposal_id
    from public.proposals p
    where p.deal_id = new.id
      and p.property_id = sale_property
      and p.user_id = new.user_id
      and p.status in ('accepted', 'aceita', 'accepted_final')
    order by p.responded_at desc nulls last, p.proposed_at desc
    limit 1;

    if accepted_proposal_id is null then
      raise exception 'Aceite uma proposta vinculada ao imóvel antes de fechar a venda.';
    end if;

    insert into public.sales(user_id, deal_id, property_id, proposal_id, sale_value, sold_at, notes)
    values (
      new.user_id,
      new.id,
      sale_property,
      accepted_proposal_id,
      sale_value,
      coalesce(new.closed_at, now()),
      new.notes
    )
    on conflict (deal_id) do nothing;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_commission_receipt_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_id uuid;
  target_user uuid;
  total_received numeric;
  commission_amount numeric;
begin
  if tg_op = 'DELETE' then
    target_id := old.commission_id;
    target_user := old.user_id;
  else
    target_id := new.commission_id;
    target_user := new.user_id;
  end if;
  select user_amount into commission_amount from public.commissions
  where id = target_id and user_id = target_user for update;
  -- Parent may already be gone during ON DELETE CASCADE.
  if not found then return coalesce(new, old); end if;
  select coalesce(sum(amount), 0) into total_received
  from public.commission_receipts
  where commission_id = target_id and user_id = target_user;
  update public.commissions
  set status = case
    when total_received >= commission_amount and commission_amount > 0 then 'received'
    when total_received > 0 then 'partially_received'
    else 'receivable'
  end,
  received_at = case
    when total_received >= commission_amount and commission_amount > 0
    then coalesce(received_at, now()) else null end
  where id = target_id and user_id = target_user;
  return coalesce(new, old);
end;
$function$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER commissions_updated_at BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_deal_properties_updated_at BEFORE UPDATE ON public.deal_properties FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sales_generate_commission AFTER INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION generate_sale_commission();
CREATE TRIGGER sales_sync_closing AFTER INSERT OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION sync_sale_closing();
CREATE TRIGGER proposal_property_validation_trigger BEFORE INSERT OR UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION validate_proposal_property();
CREATE TRIGGER accepted_proposal_sync_trigger AFTER INSERT OR UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION sync_accepted_proposal();
CREATE TRIGGER sale_proposal_validation_trigger BEFORE INSERT OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION validate_sale_proposal();
CREATE TRIGGER deals_create_sale_on_close AFTER UPDATE OF status ON public.deals FOR EACH ROW EXECUTE FUNCTION create_sale_from_closed_deal();
CREATE TRIGGER sync_property_address_complement_alias BEFORE INSERT OR UPDATE OF address_complement, adress_complement ON public.properties FOR EACH ROW EXECUTE FUNCTION sync_property_address_complement_alias();
CREATE TRIGGER generate_property_code_before_write BEFORE INSERT OR UPDATE OF property_code, user_id ON public.properties FOR EACH ROW EXECUTE FUNCTION generate_property_code();
CREATE TRIGGER profiles_sync_names BEFORE INSERT OR UPDATE OF name, full_name ON public.profiles FOR EACH ROW EXECUTE FUNCTION sync_profile_names();
CREATE TRIGGER validate_commission_receipt_amount_trigger BEFORE INSERT OR DELETE OR UPDATE ON public.commission_receipts FOR EACH ROW EXECUTE FUNCTION validate_commission_receipt_amount();
CREATE TRIGGER commission_receipt_status_trigger AFTER INSERT OR DELETE OR UPDATE ON public.commission_receipts FOR EACH ROW EXECUTE FUNCTION sync_commission_receipt_status();
alter table public.appointments enable row level security;
alter table public.deals enable row level security;
alter table public.clients enable row level security;
alter table public.vgv_entries enable row level security;
alter table public.owners enable row level security;
alter table public.captures enable row level security;
alter table public.visits enable row level security;
alter table public.visit_properties enable row level security;
alter table public.proposals enable row level security;
alter table public.commission_receipts enable row level security;
alter table public.activities enable row level security;
alter table public.deal_properties enable row level security;
alter table public.sales enable row level security;
alter table public.commissions enable row level security;
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_share_links enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.property_photos enable row level security;
alter table public.ai_usage enable row level security;
create policy appointments_own on public.appointments as PERMISSIVE for ALL to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy clients_own on public.clients as PERMISSIVE for ALL to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy commissions_own on public.commissions as PERMISSIVE for ALL to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy deals_own on public.deals as PERMISSIVE for ALL to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy profiles_own on public.profiles as PERMISSIVE for ALL to authenticated using ((( SELECT auth.uid() AS uid) = id)) with check ((( SELECT auth.uid() AS uid) = id));
create policy properties_own on public.properties as PERMISSIVE for ALL to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy vgv_entries_own on public.vgv_entries as PERMISSIVE for ALL to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy deal_properties_own on public.deal_properties as PERMISSIVE for ALL to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy activities_own_rows on public.activities as PERMISSIVE for ALL to public using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy captures_own_rows on public.captures as PERMISSIVE for ALL to public using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy commission_receipts_own_rows on public.commission_receipts as PERMISSIVE for ALL to public using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy owners_own_rows on public.owners as PERMISSIVE for ALL to public using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy proposals_own_rows on public.proposals as PERMISSIVE for ALL to public using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy sales_own_rows on public.sales as PERMISSIVE for ALL to public using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy visit_properties_own_rows on public.visit_properties as PERMISSIVE for ALL to public using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy visits_own_rows on public.visits as PERMISSIVE for ALL to public using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy ai_conversations_select_own on public.ai_conversations as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
create policy ai_conversations_insert_own on public.ai_conversations as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
create policy ai_conversations_update_own on public.ai_conversations as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy ai_conversations_delete_own on public.ai_conversations as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
create policy ai_messages_select_own on public.ai_messages as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
create policy ai_messages_insert_own on public.ai_messages as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
create policy ai_messages_update_own on public.ai_messages as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
create policy ai_messages_delete_own on public.ai_messages as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
create policy "Users manage their property photos" on public.property_photos as PERMISSIVE for ALL to authenticated using ((auth.uid() = user_id)) with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_photos.property_id) AND (p.user_id = auth.uid()))))));
create policy "Users can view their property share links" on public.property_share_links as PERMISSIVE for SELECT to authenticated using ((auth.uid() = user_id));
create policy "Users can create their property share links" on public.property_share_links as PERMISSIVE for INSERT to authenticated with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_share_links.property_id) AND (p.user_id = auth.uid()))))));
create policy "Users can update their property share links" on public.property_share_links as PERMISSIVE for UPDATE to authenticated using ((auth.uid() = user_id)) with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_share_links.property_id) AND (p.user_id = auth.uid()))))));
create policy "Users can delete their property share links" on public.property_share_links as PERMISSIVE for DELETE to authenticated using ((auth.uid() = user_id));
grant usage on schema public,auth to authenticated,anon;
grant select,insert,update,delete on all tables in schema public to authenticated;

