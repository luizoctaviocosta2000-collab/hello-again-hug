-- IMOBFY Autonomous Agents control plane. Review + stage before production.
-- This schema stores ONLY delegated policy and an audit receipt of backend actions.
-- It does NOT connect Meta, WhatsApp, banking or schedule any automatic payment.
-- Executor must read policies server-side and separately verify provider ownership,
-- counters, durable event reservation, mandate/consent and emergency-stop BEFORE API calls.

do $preflight$ begin
  if to_regclass('public.imobfy_agent_global_controls') is not null or
     to_regclass('public.imobfy_agent_policies') is not null or
     to_regclass('public.imobfy_agent_execution_audit') is not null
  then raise exception 'Agent autonomy schema already present, abort duplicate migration'; end if;
end $preflight$;

create table public.imobfy_agent_global_controls (
  user_id uuid primary key references auth.users(id) on delete cascade,
  emergency_stop boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.imobfy_agent_policies (
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null check(domain in ('ads','atendimento','comercial','financeiro')),
  mode text not null default 'off' check(mode in ('off','assisted','bounded')),
  emergency_stop boolean not null default true,
  max_ads_daily_budget_brl numeric(12,2) not null default 0 check(max_ads_daily_budget_brl between 0 and 10000),
  max_ads_budget_change_pct numeric(5,2) not null default 0 check(max_ads_budget_change_pct between 0 and 20),
  max_messages_per_day integer not null default 0 check(max_messages_per_day between 0 and 200),
  max_messages_per_contact_per_day integer not null default 0 check(max_messages_per_contact_per_day between 0 and 5),
  max_followups_per_day integer not null default 0 check(max_followups_per_day between 0 and 100),
  enable_preapproved_transfers boolean not null default false,
  max_transfer_brl numeric(12,2) not null default 0 check(max_transfer_brl between 0 and 5000),
  max_transfers_per_day_brl numeric(12,2) not null default 0 check(max_transfers_per_day_brl between 0 and 10000),
  updated_at timestamptz not null default now(),
  primary key (user_id,domain),
  constraint message_contact_limit check(max_messages_per_contact_per_day <= max_messages_per_day),
  constraint transfer_per_operation_limit check(max_transfer_brl <= max_transfers_per_day_brl),
  constraint relevant_limits_only check(
    (domain='ads' and max_messages_per_day=0 and max_messages_per_contact_per_day=0
       and max_followups_per_day=0 and not enable_preapproved_transfers
       and max_transfer_brl=0 and max_transfers_per_day_brl=0)
    or (domain='atendimento' and max_ads_daily_budget_brl=0 and max_ads_budget_change_pct=0
       and max_followups_per_day=0 and not enable_preapproved_transfers
       and max_transfer_brl=0 and max_transfers_per_day_brl=0)
    or (domain='comercial' and max_ads_daily_budget_brl=0 and max_ads_budget_change_pct=0
       and max_messages_per_day=0 and max_messages_per_contact_per_day=0
       and not enable_preapproved_transfers and max_transfer_brl=0 and max_transfers_per_day_brl=0)
    or (domain='financeiro' and max_ads_daily_budget_brl=0 and max_ads_budget_change_pct=0
       and max_messages_per_day=0 and max_messages_per_contact_per_day=0 and max_followups_per_day=0)
  )
);

-- Backend-only audit append / state transition. NEVER trust client-supplied
-- success or execution amounts. Public authenticated role is SELECT-only.
create table public.imobfy_agent_execution_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null check(domain in ('ads','atendimento','comercial','financeiro')),
  action_kind text not null check(action_kind in (
    'ads.pause','ads.resume','ads.adjust_budget','ads.change_creative',
    'message.reply','message.template','crm.followup','finance.reconcile','finance.bank_transfer')),
  status text not null check(status in
    ('proposed','denied','requires_approval','approved','executing','succeeded','failed','cancelled')),
  idempotency_key text not null check(length(idempotency_key) between 12 and 160),
  reason_code text not null check(length(reason_code) between 3 and 80),
  summary text not null default '' check(length(summary)<=220),
  amount_brl numeric(12,2) check(amount_brl is null or amount_brl>=0),
  provider_request_id text check(provider_request_id is null or length(provider_request_id)<=180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,idempotency_key)
);
create index imobfy_agent_audit_owner_recent_idx
  on public.imobfy_agent_execution_audit(user_id,created_at desc);

alter table public.imobfy_agent_global_controls enable row level security;
alter table public.imobfy_agent_policies enable row level security;
alter table public.imobfy_agent_execution_audit enable row level security;

create policy agent_global_select on public.imobfy_agent_global_controls
  for select to authenticated using ((select auth.uid())=user_id);
create policy agent_global_insert on public.imobfy_agent_global_controls
  for insert to authenticated with check ((select auth.uid())=user_id);
create policy agent_global_update on public.imobfy_agent_global_controls
  for update to authenticated using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

create policy agent_policy_select on public.imobfy_agent_policies
  for select to authenticated using ((select auth.uid())=user_id);
create policy agent_policy_insert on public.imobfy_agent_policies
  for insert to authenticated with check ((select auth.uid())=user_id);
create policy agent_policy_update on public.imobfy_agent_policies
  for update to authenticated using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

create policy agent_audit_select on public.imobfy_agent_execution_audit
  for select to authenticated using ((select auth.uid())=user_id);

-- Explicit least privilege, no cross-user or anonymous access.
revoke all on public.imobfy_agent_global_controls,
  public.imobfy_agent_policies,
  public.imobfy_agent_execution_audit
from public,anon,authenticated;

grant select,insert on public.imobfy_agent_global_controls to authenticated;
grant update(emergency_stop,updated_at) on public.imobfy_agent_global_controls to authenticated;

grant select,insert on public.imobfy_agent_policies to authenticated;
grant update(mode,emergency_stop,max_ads_daily_budget_brl,
  max_ads_budget_change_pct,max_messages_per_day,max_messages_per_contact_per_day,
  max_followups_per_day,enable_preapproved_transfers,max_transfer_brl,
  max_transfers_per_day_brl,updated_at)
on public.imobfy_agent_policies to authenticated;

grant select on public.imobfy_agent_execution_audit to authenticated;

do $postflight$ declare count_rls integer;
begin
  select count(*) into count_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in
      ('imobfy_agent_global_controls','imobfy_agent_policies','imobfy_agent_execution_audit')
      and c.relrowsecurity;
  if count_rls<>3 then raise exception 'Autonomy RLS missing'; end if;
  if has_table_privilege('anon','public.imobfy_agent_policies','SELECT') or
     has_table_privilege('authenticated','public.imobfy_agent_execution_audit','INSERT') or
     has_table_privilege('authenticated','public.imobfy_agent_execution_audit','UPDATE') then
    raise exception 'Autonomy exposed grants are unsafe'; end if;
end $postflight$;
