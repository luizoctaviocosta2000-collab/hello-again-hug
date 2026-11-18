-- IMOBFY Intelligence Foundation, 18 November 2026
-- Secure, tenant-scoped first-party CRM engagement and attribution data.
-- No external messages, Meta CAPI uploads, or campaign mutations are triggered.
-- This migration is FOR REVIEW and staging validation before production promotion.

do $preflight$
begin
  if to_regclass('public.imobfy_attendance_threads') is not null
    or to_regclass('public.imobfy_attendance_messages') is not null
    or to_regclass('public.imobfy_ads_daily_metrics') is not null
    or to_regclass('public.imobfy_ads_funnel_events') is not null
    or to_regclass('public.clients') is null
    or to_regclass('public.properties') is null
    or to_regclass('public.deals') is null then
    raise exception 'Intelligence foundation not applicable: tables already exist or core CRM missing';
  end if;
end $preflight$;

-- Composite references stop a user linking their own record to someone
-- else's client, property, deal or attendance thread.
create unique index if not exists imobfy_clients_tenant_fk_idx
  on public.clients (id, user_id);
create unique index if not exists imobfy_deals_tenant_fk_idx
  on public.deals (id, user_id);
create unique index if not exists imobfy_properties_tenant_fk_idx
  on public.properties (id, user_id);

create table public.imobfy_attendance_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid,
  property_id uuid,
  channel text not null default 'manual' check (channel in ('manual', 'whatsapp', 'instagram')),
  external_thread_key text,
  status text not null default 'open' check (status in ('open', 'handoff', 'paused', 'closed')),
  automation_mode text not null default 'assisted' check (automation_mode in ('assisted','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, channel, external_thread_key),
  constraint attendance_client_tenant foreign key (client_id,user_id)
    references public.clients (id,user_id) on delete cascade,
  constraint attendance_property_tenant foreign key (property_id,user_id)
    references public.properties (id,user_id) on delete set null (property_id),
  constraint attendance_manual_no_external check (channel <> 'manual' or external_thread_key is null),
  constraint attendance_external_channel_key check
    (channel = 'manual' or (external_thread_key is not null and length(external_thread_key) between 1 and 180))
);

create table public.imobfy_attendance_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null,
  role text not null check (role in ('customer','assistant_draft','agent_note')),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  source text not null default 'manual' check (source in ('manual','whatsapp','instagram')),
  external_message_key text,
  delivery_state text not null default 'internal' check (delivery_state = 'internal'),
  created_at timestamptz not null default now(),
  foreign key (thread_id,user_id) references public.imobfy_attendance_threads (id,user_id) on delete cascade,
  unique (user_id,source,external_message_key),
  constraint messages_manual_no_external check (source <> 'manual' or external_message_key is null)
);

create table public.imobfy_ads_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  ad_account_id text not null check (char_length(ad_account_id) between 1 and 80),
  campaign_id text not null check (char_length(campaign_id) between 1 and 80),
  campaign_name text not null check (char_length(campaign_name) between 1 and 180),
  spend_brl numeric(14,2) not null check (spend_brl >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  source text not null default 'manual' check (source in ('manual','meta')),
  updated_at timestamptz not null default now(),
  unique (user_id,report_date,ad_account_id,campaign_id)
);

create table public.imobfy_ads_funnel_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null check (char_length(event_key) between 8 and 180),
  stage text not null check (stage in ('lead','atendimento','qualificado','visita','proposta','venda')),
  client_id uuid,
  deal_id uuid,
  campaign_id text check (campaign_id is null or char_length(campaign_id) between 1 and 80),
  ad_account_id text check (ad_account_id is null or char_length(ad_account_id) between 1 and 80),
  source text not null default 'manual' check (source in ('manual','crm','meta')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id,event_key),
  constraint ads_event_known_customer check (client_id is not null or deal_id is not null),
  constraint ads_event_client_tenant foreign key (client_id,user_id)
    references public.clients (id,user_id) on delete cascade,
  constraint ads_event_deal_tenant foreign key (deal_id,user_id)
    references public.deals (id,user_id) on delete cascade
);

-- No public access; even authenticated cannot forge external provider data.
alter table public.imobfy_attendance_threads enable row level security;
alter table public.imobfy_attendance_messages enable row level security;
alter table public.imobfy_ads_daily_metrics enable row level security;
alter table public.imobfy_ads_funnel_events enable row level security;

create policy attendance_threads_select on public.imobfy_attendance_threads
  for select to authenticated using ((select auth.uid())=user_id);
create policy attendance_threads_insert_manual on public.imobfy_attendance_threads
  for insert to authenticated
  with check ((select auth.uid())=user_id and channel='manual' and automation_mode in ('assisted','paused'));
create policy attendance_threads_update on public.imobfy_attendance_threads
  for update to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy attendance_threads_delete_manual on public.imobfy_attendance_threads
  for delete to authenticated using ((select auth.uid())=user_id and channel='manual');

create policy attendance_messages_select on public.imobfy_attendance_messages
  for select to authenticated using ((select auth.uid())=user_id);
create policy attendance_messages_insert_manual on public.imobfy_attendance_messages
  for insert to authenticated
  with check ((select auth.uid())=user_id and source='manual' and delivery_state='internal');

create policy ads_daily_select on public.imobfy_ads_daily_metrics
  for select to authenticated using ((select auth.uid())=user_id);
create policy ads_daily_insert_manual on public.imobfy_ads_daily_metrics
  for insert to authenticated with check ((select auth.uid())=user_id and source='manual');
create policy ads_daily_update_manual on public.imobfy_ads_daily_metrics
  for update to authenticated
  using ((select auth.uid())=user_id and source='manual')
  with check ((select auth.uid())=user_id and source='manual');
create policy ads_daily_delete_manual on public.imobfy_ads_daily_metrics
  for delete to authenticated using ((select auth.uid())=user_id and source='manual');

create policy ads_events_select on public.imobfy_ads_funnel_events
  for select to authenticated using ((select auth.uid())=user_id);
create policy ads_events_insert_manual on public.imobfy_ads_funnel_events
  for insert to authenticated
  with check ((select auth.uid())=user_id and source='manual');

revoke all on public.imobfy_attendance_threads, public.imobfy_attendance_messages,
  public.imobfy_ads_daily_metrics, public.imobfy_ads_funnel_events from public,anon;
grant select,insert,delete on public.imobfy_attendance_threads to authenticated;
grant update (status, automation_mode, updated_at) on public.imobfy_attendance_threads to authenticated;
grant select,insert on public.imobfy_attendance_messages to authenticated;
grant select,insert,delete on public.imobfy_ads_daily_metrics to authenticated;
grant update (campaign_name,spend_brl,impressions,clicks,updated_at) on public.imobfy_ads_daily_metrics to authenticated;
grant select,insert on public.imobfy_ads_funnel_events to authenticated;

create index attendance_threads_owner_recent_idx on public.imobfy_attendance_threads (user_id,updated_at desc);
create index attendance_messages_thread_recent_idx on public.imobfy_attendance_messages (user_id,thread_id,created_at);
create index ads_daily_owner_period_idx on public.imobfy_ads_daily_metrics (user_id,report_date);
create index ads_events_owner_campaign_idx on public.imobfy_ads_funnel_events (user_id,campaign_id,occurred_at);
create index ads_events_client_tenant_idx on public.imobfy_ads_funnel_events (client_id,user_id) where client_id is not null;
create index ads_events_deal_tenant_idx on public.imobfy_ads_funnel_events (deal_id,user_id) where deal_id is not null;

-- Assert the schema is not accidentally exposed after migration.
do $postflight$
declare n integer;
begin
 select count(*) into n
 from pg_class c join pg_namespace ns on c.relnamespace=ns.oid
 where ns.nspname='public' and c.relname in
 ('imobfy_attendance_threads','imobfy_attendance_messages',
  'imobfy_ads_daily_metrics','imobfy_ads_funnel_events')
  and c.relrowsecurity;
 if n <> 4 then raise exception 'Intelligence: missing RLS tables'; end if;
 if has_table_privilege('anon','public.imobfy_ads_funnel_events','SELECT')
    or has_table_privilege('anon','public.imobfy_attendance_messages','SELECT')
    or has_table_privilege('authenticated','public.imobfy_ads_funnel_events','UPDATE')
    or has_table_privilege('authenticated','public.imobfy_attendance_messages','UPDATE')
 then raise exception 'Intelligence: grants unexpectedly broad'; end if;
end $postflight$;
