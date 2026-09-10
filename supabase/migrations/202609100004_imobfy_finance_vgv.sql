-- Imobfy Phase 4: single source of truth for finance and VGV.
-- Aligns Phase 2 triggers with the canonical commission schema.

-- Phase 2 used legacy column names; keep the canonical schema from 202609090001.
-- Rebuild the sale commission trigger so closing a sale is the only source for
-- realized VGV and projected commission generation.
drop trigger if exists sales_generate_commission on public.sales;

drop function if exists public.generate_sale_commission();

create or replace function public.generate_sale_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  capture_row public.captures%rowtype;
  gross numeric(14,2);
  tax numeric(14,2);
  net numeric(14,2);
  sale_user_amount numeric(14,2);
  capture_user_amount numeric(14,2);
begin
  select * into profile_row from public.profiles where id = new.user_id;

  gross := round(new.sale_value * coalesce(profile_row.default_commission_pct, 6) / 100, 2);
  tax := round(gross * coalesce(profile_row.tax_pct, 9) / 100, 2);
  net := gross - tax;
  sale_user_amount := round(net * coalesce(profile_row.participation_pct, 20) / 100, 2);

  insert into public.commissions (
    user_id, deal_id, vgv, gross_pct, tax_pct, participation_pct, role_pct,
    status, commission_type, sale_id
  ) values (
    new.user_id, new.deal_id, new.sale_value,
    coalesce(profile_row.default_commission_pct, 6),
    coalesce(profile_row.tax_pct, 9),
    coalesce(profile_row.participation_pct, 20),
    100, 'a_receber', 'venda', new.id
  );

  select * into capture_row
  from public.captures
  where property_id = new.property_id
    and user_id = new.user_id
    and status = 'active'
  order by captured_at desc
  limit 1;

  if capture_row.id is not null then
    capture_user_amount := round(
      net * coalesce(capture_row.commission_pct, 20) / 100
      * case when capture_row.capture_type = 'shared' then 0.5 else 1 end,
      2
    );

    insert into public.commissions (
      user_id, deal_id, vgv, gross_pct, tax_pct, participation_pct, role_pct,
      status, commission_type, capture_id, sale_id
    ) values (
      new.user_id, new.deal_id, new.sale_value,
      coalesce(profile_row.default_commission_pct, 6),
      coalesce(profile_row.tax_pct, 9),
      coalesce(capture_row.commission_pct, 20)
        * case when capture_row.capture_type = 'shared' then 0.5 else 1 end,
      100, 'a_receber', 'captacao', capture_row.id, new.id
    );
  end if;

  insert into public.vgv_entries (user_id, deal_id, reference_month, vgv)
  values (
    new.user_id,
    new.deal_id,
    date_trunc('month', new.sold_at)::date,
    new.sale_value
  )
  on conflict (user_id, deal_id, reference_month)
  do update set vgv = excluded.vgv;

  return new;
end;
$$;

create trigger sales_generate_commission
after insert on public.sales
for each row execute procedure public.generate_sale_commission();

-- Commission receipt aggregation: the commission stays a_receber until a
-- receipt is recorded, and becomes received only when the total is covered.
create or replace function public.refresh_commission_receipt_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  received_total numeric(14,2);
  commission_amount numeric(14,2);
  target_id uuid;
begin
  target_id := coalesce(new.commission_id, old.commission_id);
  select coalesce(sum(amount), 0) into received_total
  from public.commission_receipts
  where commission_id = target_id;

  select user_amount into commission_amount
  from public.commissions
  where id = target_id;

  update public.commissions
  set status = case
    when received_total >= coalesce(commission_amount, 0) and commission_amount > 0 then 'recebida'
    else 'a_receber'
  end,
  received_at = case
    when received_total >= coalesce(commission_amount, 0) and commission_amount > 0 then now()
    else null
  end,
  updated_at = now()
  where id = target_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists commission_receipts_refresh_status on public.commission_receipts;
create trigger commission_receipts_refresh_status
after insert or update or delete on public.commission_receipts
for each row execute procedure public.refresh_commission_receipt_status();

create index if not exists vgv_entries_user_month_idx
  on public.vgv_entries(user_id, reference_month);
create index if not exists commissions_user_status_idx
  on public.commissions(user_id, status);
create index if not exists commissions_user_type_idx
  on public.commissions(user_id, commission_type);
