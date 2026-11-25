-- =============================================================================
-- IMOBFY R2 - commission status normalization for the AI indicators
-- Intended path: supabase/migrations/20261120091000_r2_status_indicators.sql
-- NOT APPLIED. Review only. Requires F0-A (constraint union) and F0-B (functions).
--
-- Scope: read logic only. No schema change, no data rewrite, no DROP.
-- Reversible: re-run F0-B to restore the previous behavior.
--
-- Why functions instead of a data backfill: making the aggregate vocabulary
-- tolerant fixes the undercount immediately for every historical row, without
-- touching customer data. A backfill can come later, after a census.
--
-- Status grouping (the single source of truth for the indicators):
--   forecast           <- 'forecast', 'prevista'
--   receivable         <- 'receivable', 'a_receber'
--   partially_received <- 'partially_received'
--   received           <- 'received', 'recebida'
--   cancelled          <- 'cancelled', 'canceled', 'cancelada'
--   unknown            <- anything else: reported, never counted as active
--
-- Money rules (documented, no NULL -> 0 coercion of stored data):
--   received            = all commission receipts of the user
--                         + user_amount of 'received' rows that have NO receipt
--                         (legacy rows added before receipts existed)
--   to_receive          = max(user_amount - receipts, 0) for receivable/partial
--   open                = user_amount for receivable/partial (gross pending)
--   forecast            = user_amount for forecast rows (reported separately)
--   cancelled           = user_amount for cancelled rows (reported, never active)
--   unknown_open_amount = user_amount for unknown rows (reported, never active)
--   A NULL user_amount contributes 0 to every money total and is counted by
--   null_amount_count, so it is visible instead of silently discarded.
-- =============================================================================
begin;
set local lock_timeout = '5s';

create or replace function public.get_ai_commission_summary(p_limit integer default 20)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.priority, x.due_date nulls last, x.created_at desc, x.id), '[]'::jsonb)
  from (
    select
      c.id,
      c.deal_id,
      c.commission_type,
      c.status,
      lower(c.status) as status_key,
      case
        when lower(c.status) in ('forecast','prevista') then 'forecast'
        when lower(c.status) in ('receivable','a_receber') then 'receivable'
        when lower(c.status) = 'partially_received' then 'partially_received'
        when lower(c.status) in ('received','recebida') then 'received'
        when lower(c.status) in ('cancelled','canceled','cancelada') then 'cancelled'
        else 'unknown'
      end as status_group,
      c.user_amount as commission_amount,
      coalesce(r.received_amount, 0) as received_amount,
      greatest(coalesce(c.user_amount, 0) - coalesce(r.received_amount, 0), 0) as remaining_amount,
      c.due_date,
      c.paid_at,
      c.reference_month,
      case
        when lower(c.status) in ('receivable','a_receber','partially_received')
             and c.due_date is not null
             and c.due_date < current_date then 0
        when lower(c.status) in ('receivable','a_receber','partially_received') then 1
        when lower(c.status) in ('forecast','prevista') then 2
        when lower(c.status) in ('received','recebida') then 3
        when lower(c.status) in ('cancelled','canceled','cancelada') then 4
        else 5
      end as priority,
      c.created_at
    from public.commissions c
    left join lateral (
      select coalesce(sum(cr.amount), 0) as received_amount
      from public.commission_receipts cr
      where cr.commission_id = c.id
        and cr.user_id = c.user_id
    ) r on true
    where c.user_id = auth.uid()
    order by priority, c.due_date nulls last, c.created_at desc, c.id
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) x;
$function$;

create or replace function public.get_ai_financial_summary()
returns jsonb
language sql
stable
set search_path to ''
as $function$
  with base as (
    select
      c.id,
      c.user_amount,
      c.due_date,
      case
        when lower(c.status) in ('forecast','prevista') then 'forecast'
        when lower(c.status) in ('receivable','a_receber') then 'receivable'
        when lower(c.status) = 'partially_received' then 'partially_received'
        when lower(c.status) in ('received','recebida') then 'received'
        when lower(c.status) in ('cancelled','canceled','cancelada') then 'cancelled'
        else 'unknown'
      end as status_group,
      coalesce(r.received_amount, 0) as received_amount,
      coalesce(r.receipt_count, 0) as receipt_count
    from public.commissions c
    left join lateral (
      select coalesce(sum(cr.amount), 0) as received_amount,
             count(*) as receipt_count
      from public.commission_receipts cr
      where cr.commission_id = c.id
        and cr.user_id = c.user_id
    ) r on true
    where c.user_id = auth.uid()
  )
  select jsonb_build_object(
    'total_received', coalesce(sum(
      case
        when receipt_count > 0 then received_amount
        when status_group = 'received' then coalesce(user_amount, 0)
        else 0
      end), 0),
    'total_to_receive', coalesce(sum(
      case when status_group in ('receivable','partially_received')
           then greatest(coalesce(user_amount, 0) - received_amount, 0)
           else 0 end), 0),
    'total_open', coalesce(sum(
      case when status_group in ('receivable','partially_received')
           then coalesce(user_amount, 0) else 0 end), 0),
    'total_forecast', coalesce(sum(
      case when status_group = 'forecast' then coalesce(user_amount, 0) else 0 end), 0),
    'total_cancelled', coalesce(sum(
      case when status_group = 'cancelled' then coalesce(user_amount, 0) else 0 end), 0),
    'unknown_open_amount', coalesce(sum(
      case when status_group = 'unknown' then coalesce(user_amount, 0) else 0 end), 0),
    'overdue_to_receive', coalesce(sum(
      case when status_group in ('receivable','partially_received')
             and due_date is not null and due_date < current_date
           then greatest(coalesce(user_amount, 0) - received_amount, 0)
           else 0 end), 0),
    'commission_count', count(id),
    'open_commission_count', count(id) filter (
      where status_group in ('receivable','partially_received')),
    'received_commission_count', count(id) filter (where status_group = 'received'),
    'forecast_commission_count', count(id) filter (where status_group = 'forecast'),
    'cancelled_commission_count', count(id) filter (where status_group = 'cancelled'),
    'unknown_commission_count', count(id) filter (where status_group = 'unknown'),
    'null_amount_count', count(id) filter (where user_amount is null),
    'inconsistent_received_count', count(id) filter (
      where status_group = 'received'
        and receipt_count > 0
        and coalesce(user_amount, 0) <> received_amount)
  )
  from base;
$function$;

-- get_ai_vgv_summary is not status-dependent: no change needed in R2.

revoke all on function public.get_ai_financial_summary() from public, anon;
revoke all on function public.get_ai_commission_summary(integer) from public, anon;
grant execute on function public.get_ai_financial_summary() to authenticated;
grant execute on function public.get_ai_commission_summary(integer) to authenticated;

commit;
