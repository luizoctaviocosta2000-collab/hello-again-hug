-- IMOBFY: make closing authoritative and align commission generation with closing participation.
-- 1) Closing a deal creates exactly one sale. sales(deal_id) is already unique.
create or replace function public.create_sale_from_closed_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sale_property uuid;
  sale_value numeric(14,2);
begin
  if new.status = 'closed' and coalesce(old.status, '') <> 'closed' then
    sale_property := new.property_id;
    sale_value := coalesce(new.property_value, 0);

    if sale_property is null then
      raise exception 'Não é possível fechar o negócio sem imóvel vendido.';
    end if;

    insert into public.sales(user_id, deal_id, property_id, sale_value, sold_at, notes)
    values (new.user_id, new.id, sale_property, sale_value, coalesce(new.closed_at, now()), new.notes)
    on conflict (deal_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists deals_create_sale_on_close on public.deals;
create trigger deals_create_sale_on_close
after update of status on public.deals
for each row
execute procedure public.create_sale_from_closed_deal();

-- 2) Commission generation follows the participation selected at closing.
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
  has_sides boolean;
begin
  select * into p from public.profiles where id = new.user_id;
  select * into d from public.deals where id = new.deal_id and user_id = new.user_id;

  gross := round(new.sale_value * coalesce(p.default_commission_pct, 6) / 100, 2);
  tax := round(gross * coalesce(p.tax_pct, 9) / 100, 2);
  net := gross - tax;
  has_sides := coalesce(array_length(d.sides, 1), 0) > 0;

  if has_sides and 'sale_split' = any(d.sides) then
    sale_pct := 10;
  elsif has_sides and 'sale' = any(d.sides) then
    sale_pct := 20;
  else
    sale_pct := coalesce(p.participation_pct, 20);
  end if;

  sale_user_amount := round(net * sale_pct / 100, 2);

  insert into public.commissions(
    user_id, deal_id, vgv, gross_pct, tax_pct, participation_pct, role_pct,
    status, commission_type, sale_id, property_value, brokerage_pct,
    gross_amount, tax_amount, net_brokerage, user_amount
  ) values (
    new.user_id, new.deal_id, new.sale_value, coalesce(p.default_commission_pct,6),
    coalesce(p.tax_pct,9), sale_pct, 100, 'a_receber', 'venda', new.id,
    new.sale_value, coalesce(p.default_commission_pct,6), gross, tax, net, sale_user_amount
  );

  select * into c from public.captures
  where property_id = new.property_id
    and user_id = new.user_id
    and status = 'active'
  order by captured_at desc
  limit 1;

  if c.id is not null and (not has_sides or 'capture' = any(d.sides) or 'capture_split' = any(d.sides)) then
    if has_sides and 'capture_split' = any(d.sides) then
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
      new.user_id, new.deal_id, new.sale_value, coalesce(p.default_commission_pct,6),
      coalesce(p.tax_pct,9), cap_pct, 100, 'a_receber', 'captacao', c.id, new.id,
      new.sale_value, coalesce(p.default_commission_pct,6), gross, tax, net, cap_user_amount
    );
  end if;

  insert into public.vgv_entries(user_id, deal_id, reference_month, vgv, property_value, month)
  values (
    new.user_id, new.deal_id, date_trunc('month', new.sold_at)::date,
    new.sale_value, new.sale_value, date_trunc('month', new.sold_at)::date
  )
  on conflict (user_id, deal_id, reference_month) do update
    set vgv = excluded.vgv, property_value = excluded.property_value, month = excluded.month;

  return new;
end;
$$;
