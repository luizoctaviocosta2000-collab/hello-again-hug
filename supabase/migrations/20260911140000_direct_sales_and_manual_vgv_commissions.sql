alter table public.sales alter column deal_id drop not null;

create or replace function public.validate_sale_proposal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deal_id is null then return new; end if;
  if not exists (
    select 1 from public.proposals p
    where p.id = new.proposal_id
      and p.deal_id = new.deal_id
      and p.property_id = new.property_id
      and p.user_id = new.user_id
      and p.status in ('accepted','aceita','accepted_final')
  ) then raise exception 'A venda precisa estar vinculada a uma proposta aceita'; end if;
  return new;
end;
$$;

alter table public.sales add column if not exists commission_sides text[] not null default array['sale']::text[];

create or replace function public.generate_sale_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record; c record; d record;
  gross numeric(14,2); tax numeric(14,2); net numeric(14,2);
  sale_pct numeric(5,2); cap_pct numeric(5,2);
  sale_user_amount numeric(14,2); cap_user_amount numeric(14,2);
  sides text[];
begin
  select * into p from public.profiles where id = new.user_id;
  if p.id is null then raise exception 'Perfil não encontrado'; end if;
  if new.deal_id is not null then select * into d from public.deals where id = new.deal_id and user_id = new.user_id; end if;

  sides := case when new.deal_id is null then coalesce(new.commission_sides, array['sale']::text[]) else coalesce(d.sides, array[]::text[]) end;
  gross := round(new.sale_value * coalesce(p.default_commission_pct, 6) / 100, 2);
  tax := round(gross * coalesce(p.tax_pct, 9) / 100, 2);
  net := gross - tax;

  if 'sale_split' = any(sides) then sale_pct := 10;
  elsif 'sale' = any(sides) then sale_pct := 20;
  else sale_pct := null; end if;

  if sale_pct is not null then
    sale_user_amount := round(net * sale_pct / 100, 2);
    insert into public.commissions(user_id,deal_id,vgv,gross_pct,tax_pct,participation_pct,role_pct,status,commission_type,sale_id,property_value,brokerage_pct,gross_amount,tax_amount,net_brokerage,user_amount)
    values(new.user_id,new.deal_id,new.sale_value,coalesce(p.default_commission_pct,6),coalesce(p.tax_pct,9),sale_pct,100,'a_receber','venda',new.id,new.sale_value,coalesce(p.default_commission_pct,6),gross,tax,net,sale_user_amount);
  end if;

  select * into c from public.captures where property_id=new.property_id and user_id=new.user_id and status='active' order by captured_at desc limit 1;
  if c.id is not null and ('capture' = any(sides) or 'capture_split' = any(sides)) then
    if 'capture_split' = any(sides) then cap_pct := 10; else cap_pct := coalesce(c.commission_pct,20); end if;
    cap_user_amount := round(net * cap_pct / 100, 2);
    insert into public.commissions(user_id,deal_id,vgv,gross_pct,tax_pct,participation_pct,role_pct,status,commission_type,capture_id,sale_id,property_value,brokerage_pct,gross_amount,tax_amount,net_brokerage,user_amount)
    values(new.user_id,new.deal_id,new.sale_value,coalesce(p.default_commission_pct,6),coalesce(p.tax_pct,9),cap_pct,100,'a_receber','captacao',c.id,new.id,new.sale_value,coalesce(p.default_commission_pct,6),gross,tax,net,cap_user_amount);
  end if;

  insert into public.vgv_entries(user_id,deal_id,reference_month,vgv,property_value,month)
  values(new.user_id,new.deal_id,date_trunc('month',new.sold_at)::date,new.sale_value,new.sale_value,date_trunc('month',new.sold_at)::date)
  on conflict(user_id,deal_id,reference_month) do update set vgv=excluded.vgv,property_value=excluded.property_value,month=excluded.month;
  return new;
end;
$$;

create or replace function public.register_manual_vgv(p_user_id uuid,p_reference_month date,p_vgv numeric,p_commission_type text default 'captacao',p_split boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p record; gross numeric(14,2); tax numeric(14,2); net numeric(14,2); pct numeric(5,2); amount numeric(14,2); vgv_id uuid;
begin
  if p_vgv is null or p_vgv<=0 then raise exception 'O VGV deve ser maior que zero'; end if;
  if p_commission_type not in ('captacao','venda','ambos') then raise exception 'Tipo de comissão inválido'; end if;
  select * into p from public.profiles where id=p_user_id;
  if p.id is null then raise exception 'Perfil não encontrado'; end if;
  insert into public.vgv_entries(user_id,deal_id,month,reference_month,property_value,vgv)
  values(p_user_id,null,date_trunc('month',p_reference_month)::date,date_trunc('month',p_reference_month)::date,p_vgv,p_vgv) returning id into vgv_id;
  gross:=round(p_vgv*coalesce(p.default_commission_pct,6)/100,2); tax:=round(gross*coalesce(p.tax_pct,9)/100,2); net:=gross-tax;
  if p_commission_type in ('captacao','ambos') then
    pct:=case when p_split then 10 else coalesce(p.participation_pct,20) end; amount:=round(net*pct/100,2);
    insert into public.commissions(user_id,deal_id,vgv,gross_pct,tax_pct,participation_pct,role_pct,status,commission_type,property_value,brokerage_pct,gross_amount,tax_amount,net_brokerage,user_amount,notes)
    values(p_user_id,null,p_vgv,coalesce(p.default_commission_pct,6),coalesce(p.tax_pct,9),pct,100,'a_receber','captacao',p_vgv,coalesce(p.default_commission_pct,6),gross,tax,net,amount,'Comissão histórica lançada junto ao VGV manual.');
  end if;
  if p_commission_type in ('venda','ambos') then
    pct:=case when p_split then 10 else coalesce(p.participation_pct,20) end; amount:=round(net*pct/100,2);
    insert into public.commissions(user_id,deal_id,vgv,gross_pct,tax_pct,participation_pct,role_pct,status,commission_type,property_value,brokerage_pct,gross_amount,tax_amount,net_brokerage,user_amount,notes)
    values(p_user_id,null,p_vgv,coalesce(p.default_commission_pct,6),coalesce(p.tax_pct,9),pct,100,'a_receber','venda',p_vgv,coalesce(p.default_commission_pct,6),gross,tax,net,amount,'Comissão histórica lançada junto ao VGV manual.');
  end if;
  return jsonb_build_object('vgv_id',vgv_id,'gross',gross,'tax',tax,'net',net);
end;
$$;
revoke all on function public.register_manual_vgv(uuid,date,numeric,text,boolean) from public;
grant execute on function public.register_manual_vgv(uuid,date,numeric,text,boolean) to authenticated;

create or replace function public.register_direct_sale(p_user_id uuid,p_property_id uuid,p_sale_value numeric,p_sold_at timestamptz,p_commission_sides text[] default array['sale']::text[],p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare sale_id uuid;
begin
  if p_sale_value is null or p_sale_value<=0 then raise exception 'Informe um valor de venda válido'; end if;
  if p_property_id is null then raise exception 'Selecione o imóvel vendido'; end if;
  if not exists(select 1 from public.properties where id=p_property_id and user_id=p_user_id) then raise exception 'Imóvel não encontrado no seu estoque'; end if;
  if p_commission_sides is null or cardinality(p_commission_sides)=0 then raise exception 'Informe sua atuação na venda'; end if;
  insert into public.sales(user_id,deal_id,property_id,proposal_id,sale_value,sold_at,notes,commission_sides)
  values(p_user_id,null,p_property_id,null,p_sale_value,coalesce(p_sold_at,now()),p_notes,p_commission_sides) returning id into sale_id;
  return sale_id;
end;
$$;
revoke all on function public.register_direct_sale(uuid,uuid,numeric,timestamptz,text[],text) from public;
grant execute on function public.register_direct_sale(uuid,uuid,numeric,timestamptz,text[],text) to authenticated;
