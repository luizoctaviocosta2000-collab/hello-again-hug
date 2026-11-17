-- STAGING BOOTSTRAP REPAIR: direct sale without deal_id must not dereference unassigned record d.
-- Derived from 20260911141000_commission_reference_month.sql; only the
-- sides assignment is changed, maintaining the rest of the historical contract.
-- Append INSIDE the same atomic transaction as steps 10-13. Never apply to production.
-- This is not intended as a permanent replacement for a reviewed versioned migration.

create or replace function public.generate_sale_commission()
returns trigger language plpgsql security definer set search_path=public as $$
declare p record; c record; d record; gross numeric(14,2); tax numeric(14,2); net numeric(14,2); sale_pct numeric(5,2); cap_pct numeric(5,2); sale_user_amount numeric(14,2); cap_user_amount numeric(14,2); sides text[]; ref_month date;
begin
  select * into p from public.profiles where id=new.user_id; if p.id is null then raise exception 'Perfil não encontrado'; end if;
  if new.deal_id is null then
    sides := coalesce(new.commission_sides, array['sale']::text[]);
  else
    select * into d from public.deals where id=new.deal_id and user_id=new.user_id;
    sides := coalesce(d.sides, array[]::text[]);
  end if;
  ref_month := date_trunc('month',new.sold_at)::date;
  gross:=round(new.sale_value*coalesce(p.default_commission_pct,6)/100,2); tax:=round(gross*coalesce(p.tax_pct,9)/100,2); net:=gross-tax;
  if 'sale_split'=any(sides) then sale_pct:=10; elsif 'sale'=any(sides) then sale_pct:=20; else sale_pct:=null; end if;
  if sale_pct is not null then sale_user_amount:=round(net*sale_pct/100,2); insert into public.commissions(user_id,deal_id,vgv,gross_pct,tax_pct,participation_pct,role_pct,status,commission_type,sale_id,property_value,brokerage_pct,gross_amount,tax_amount,net_brokerage,user_amount,reference_month) values(new.user_id,new.deal_id,new.sale_value,coalesce(p.default_commission_pct,6),coalesce(p.tax_pct,9),sale_pct,100,'a_receber','venda',new.id,new.sale_value,coalesce(p.default_commission_pct,6),gross,tax,net,sale_user_amount,ref_month); end if;
  select * into c from public.captures where property_id=new.property_id and user_id=new.user_id and status='active' order by captured_at desc limit 1;
  if c.id is not null and ('capture'=any(sides) or 'capture_split'=any(sides)) then if 'capture_split'=any(sides) then cap_pct:=10; else cap_pct:=coalesce(c.commission_pct,20); end if; cap_user_amount:=round(net*cap_pct/100,2); insert into public.commissions(user_id,deal_id,vgv,gross_pct,tax_pct,participation_pct,role_pct,status,commission_type,capture_id,sale_id,property_value,brokerage_pct,gross_amount,tax_amount,net_brokerage,user_amount,reference_month) values(new.user_id,new.deal_id,new.sale_value,coalesce(p.default_commission_pct,6),coalesce(p.tax_pct,9),cap_pct,100,'a_receber','captacao',c.id,new.id,new.sale_value,coalesce(p.default_commission_pct,6),gross,tax,net,cap_user_amount,ref_month); end if;
  insert into public.vgv_entries(user_id,deal_id,reference_month,vgv,property_value,month) values(new.user_id,new.deal_id,ref_month,new.sale_value,new.sale_value,ref_month) on conflict(user_id,deal_id,reference_month) do update set vgv=excluded.vgv,property_value=excluded.property_value,month=excluded.month;
  return new;
end; $$;
