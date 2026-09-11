alter table public.commissions add column if not exists reference_month date;
update public.commissions set reference_month=date_trunc('month',coalesce(due_at,created_at))::date where reference_month is null;

create or replace function public.register_manual_vgv(p_user_id uuid,p_reference_month date,p_vgv numeric,p_commission_type text default 'captacao',p_split boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p record; gross numeric(14,2); tax numeric(14,2); net numeric(14,2); pct numeric(5,2); amount numeric(14,2); vgv_id uuid; ref_month date;
begin
  if p_vgv is null or p_vgv<=0 then raise exception 'O VGV deve ser maior que zero'; end if;
  if p_commission_type not in ('captacao','venda','ambos') then raise exception 'Tipo de comissão inválido'; end if;
  ref_month:=date_trunc('month',p_reference_month)::date; select * into p from public.profiles where id=p_user_id; if p.id is null then raise exception 'Perfil não encontrado'; end if;
  insert into public.vgv_entries(user_id,deal_id,month,reference_month,property_value,vgv) values(p_user_id,null,ref_month,ref_month,p_vgv,p_vgv) returning id into vgv_id;
  gross:=round(p_vgv*coalesce(p.default_commission_pct,6)/100,2); tax:=round(gross*coalesce(p.tax_pct,9)/100,2); net:=gross-tax;
  if p_commission_type in ('captacao','ambos') then pct:=case when p_split then 10 else coalesce(p.participation_pct,20) end; amount:=round(net*pct/100,2); insert into public.commissions(user_id,deal_id,vgv,gross_pct,tax_pct,participation_pct,role_pct,status,commission_type,property_value,brokerage_pct,gross_amount,tax_amount,net_brokerage,user_amount,notes,reference_month) values(p_user_id,null,p_vgv,coalesce(p.default_commission_pct,6),coalesce(p.tax_pct,9),pct,100,'a_receber','captacao',p_vgv,coalesce(p.default_commission_pct,6),gross,tax,net,amount,'Comissão histórica lançada junto ao VGV manual.',ref_month); end if;
  if p_commission_type in ('venda','ambos') then pct:=case when p_split then 10 else coalesce(p.participation_pct,20) end; amount:=round(net*pct/100,2); insert into public.commissions(user_id,deal_id,vgv,gross_pct,tax_pct,participation_pct,role_pct,status,commission_type,property_value,brokerage_pct,gross_amount,tax_amount,net_brokerage,user_amount,notes,reference_month) values(p_user_id,null,p_vgv,coalesce(p.default_commission_pct,6),coalesce(p.tax_pct,9),pct,100,'a_receber','venda',p_vgv,coalesce(p.default_commission_pct,6),gross,tax,net,amount,'Comissão histórica lançada junto ao VGV manual.',ref_month); end if;
  return jsonb_build_object('vgv_id',vgv_id,'gross',gross,'tax',tax,'net',net);
end; $$;

create or replace function public.generate_sale_commission()
returns trigger language plpgsql security definer set search_path=public as $$
declare p record; c record; d record; gross numeric(14,2); tax numeric(14,2); net numeric(14,2); sale_pct numeric(5,2); cap_pct numeric(5,2); sale_user_amount numeric(14,2); cap_user_amount numeric(14,2); sides text[]; ref_month date;
begin
  select * into p from public.profiles where id=new.user_id; if p.id is null then raise exception 'Perfil não encontrado'; end if;
  if new.deal_id is not null then select * into d from public.deals where id=new.deal_id and user_id=new.user_id; end if;
  sides:=case when new.deal_id is null then coalesce(new.commission_sides,array['sale']::text[]) else coalesce(d.sides,array[]::text[]) end; ref_month:=date_trunc('month',new.sold_at)::date;
  gross:=round(new.sale_value*coalesce(p.default_commission_pct,6)/100,2); tax:=round(gross*coalesce(p.tax_pct,9)/100,2); net:=gross-tax;
  if 'sale_split'=any(sides) then sale_pct:=10; elsif 'sale'=any(sides) then sale_pct:=20; else sale_pct:=null; end if;
  if sale_pct is not null then sale_user_amount:=round(net*sale_pct/100,2); insert into public.commissions(user_id,deal_id,vgv,gross_pct,tax_pct,participation_pct,role_pct,status,commission_type,sale_id,property_value,brokerage_pct,gross_amount,tax_amount,net_brokerage,user_amount,reference_month) values(new.user_id,new.deal_id,new.sale_value,coalesce(p.default_commission_pct,6),coalesce(p.tax_pct,9),sale_pct,100,'a_receber','venda',new.id,new.sale_value,coalesce(p.default_commission_pct,6),gross,tax,net,sale_user_amount,ref_month); end if;
  select * into c from public.captures where property_id=new.property_id and user_id=new.user_id and status='active' order by captured_at desc limit 1;
  if c.id is not null and ('capture'=any(sides) or 'capture_split'=any(sides)) then if 'capture_split'=any(sides) then cap_pct:=10; else cap_pct:=coalesce(c.commission_pct,20); end if; cap_user_amount:=round(net*cap_pct/100,2); insert into public.commissions(user_id,deal_id,vgv,gross_pct,tax_pct,participation_pct,role_pct,status,commission_type,capture_id,sale_id,property_value,brokerage_pct,gross_amount,tax_amount,net_brokerage,user_amount,reference_month) values(new.user_id,new.deal_id,new.sale_value,coalesce(p.default_commission_pct,6),coalesce(p.tax_pct,9),cap_pct,100,'a_receber','captacao',c.id,new.id,new.sale_value,coalesce(p.default_commission_pct,6),gross,tax,net,cap_user_amount,ref_month); end if;
  insert into public.vgv_entries(user_id,deal_id,reference_month,vgv,property_value,month) values(new.user_id,new.deal_id,ref_month,new.sale_value,new.sale_value,ref_month) on conflict(user_id,deal_id,reference_month) do update set vgv=excluded.vgv,property_value=excluded.property_value,month=excluded.month;
  return new;
end; $$;
