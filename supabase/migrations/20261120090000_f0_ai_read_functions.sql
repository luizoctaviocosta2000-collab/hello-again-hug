-- =============================================================================
-- IMOBFY F0-B - restore the three AI read functions (structure only)
-- Intended path: supabase/migrations/20261120090000_f0_ai_read_functions.sql
-- NOT APPLIED. Review only.
--
-- Why forward-dated: the bodies read public.commission_receipts, created by
-- 202609100001. A SQL function is validated at CREATE time, so this file cannot
-- live at 202609090002. It sorts after every migration present today.
--
-- F0-CHANGE: search_path 'public' -> '' and explicit grants. The financial
-- LOGIC is untouched: this file reproduces the 2026-10-22 production bodies
-- verbatim, including the status vocabulary bug that R2 fixes. Do not report
-- the indicators as corrected until R2 is applied and tested.
-- =============================================================================
begin;
set local lock_timeout = '5s';

-- get_ai_commission_summary: body identical to journey_schema.sql (2026-10-22 snapshot);
-- only search_path changed from 'public' to '' (all objects already qualified).
CREATE OR REPLACE FUNCTION public.get_ai_commission_summary(p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
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

-- get_ai_vgv_summary: body identical to journey_schema.sql (2026-10-22 snapshot);
-- only search_path changed from 'public' to '' (all objects already qualified).
CREATE OR REPLACE FUNCTION public.get_ai_vgv_summary(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
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

-- get_ai_financial_summary: body identical to journey_schema.sql (2026-10-22 snapshot);
-- only search_path changed from 'public' to '' (all objects already qualified).
CREATE OR REPLACE FUNCTION public.get_ai_financial_summary()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
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

-- Default EXECUTE on a function is PUBLIC. Revoke it explicitly so anon
-- cannot call financial aggregates, then grant only to authenticated.
revoke all on function public.get_ai_financial_summary() from public, anon;
revoke all on function public.get_ai_commission_summary(integer) from public, anon;
revoke all on function public.get_ai_vgv_summary(date,date) from public, anon;
grant execute on function public.get_ai_financial_summary() to authenticated;
grant execute on function public.get_ai_commission_summary(integer) to authenticated;
grant execute on function public.get_ai_vgv_summary(date,date) to authenticated;

commit;
