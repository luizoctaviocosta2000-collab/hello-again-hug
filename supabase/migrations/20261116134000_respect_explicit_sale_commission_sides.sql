-- Fix: a sale marked "sale only" must not silently create a capture commission.
-- The 202610160001 migration reintroduced an unconditional capture fallback
-- whenever deal.sides was empty or deal_id was NULL, even if the user
-- explicitly selected commission_sides = ARRAY['sale'].
--
-- Retain the established configurable rates and 10% split behavior; only
-- generate captação when the resolved sides explicitly include capture or
-- capture_split. Do not rewrite previously generated commissions.
-- Apply AFTER 202610160001_fix_sale_proposal_commission_flow.sql.
-- This migration has NOT been applied to remote staging or production.

create or replace function public.generate_sale_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Trigger-only privileged function must never be directly RPC-invocable.
revoke all on function public.generate_sale_commission() from public, anon, authenticated;
