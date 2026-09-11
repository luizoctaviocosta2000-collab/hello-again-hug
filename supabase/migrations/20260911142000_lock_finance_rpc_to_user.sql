create or replace function public.register_manual_vgv(p_user_id uuid,p_reference_month date,p_vgv numeric,p_commission_type text default 'captacao',p_split boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p record; gross numeric(14,2); tax numeric(14,2); net numeric(14,2); pct numeric(5,2); amount numeric(14,2); vgv_id uuid; ref_month date;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Usuário não autorizado'; end if;
  if p_vgv is null or p_vgv<=0 then raise exception 'O VGV deve ser maior que zero'; end if;
  if p_commission_type not in ('captacao','venda','ambos') then raise exception 'Tipo de comissão inválido'; end if;
  ref_month:=date_trunc('month',p_reference_month)::date; select * into p from public.profiles where id=p_user_id; if p.id is null then raise exception 'Perfil não encontrado'; end if;
  insert into public.vgv_entries(user_id,deal_id,month,reference_month,property_value,vgv) values(p_user_id,null,ref_month,ref_month,p_vgv,p_vgv) returning id into vgv_id;
  gross:=round(p_vgv*coalesce(p.default_commission_pct,6)/100,2); tax:=round(gross*coalesce(p.tax_pct,9)/100,2); net:=gross-tax;
  if p_commission_type in ('captacao','ambos') then pct:=case when p_split then 10 else coalesce(p.participation_pct,20) end; amount:=round(net*pct/100,2); insert into public.commissions(user_id,deal_id,vgv,gross_pct,tax_pct,participation_pct,role_pct,status,commission_type,property_value,brokerage_pct,gross_amount,tax_amount,net_brokerage,user_amount,notes,reference_month) values(p_user_id,null,p_vgv,coalesce(p.default_commission_pct,6),coalesce(p.tax_pct,9),pct,100,'a_receber','captacao',p_vgv,coalesce(p.default_commission_pct,6),gross,tax,net,amount,'Comissão histórica lançada junto ao VGV manual.',ref_month); end if;
  if p_commission_type in ('venda','ambos') then pct:=case when p_split then 10 else coalesce(p.participation_pct,20) end; amount:=round(net*pct/100,2); insert into public.commissions(user_id,deal_id,vgv,gross_pct,tax_pct,participation_pct,role_pct,status,commission_type,property_value,brokerage_pct,gross_amount,tax_amount,net_brokerage,user_amount,notes,reference_month) values(p_user_id,null,p_vgv,coalesce(p.default_commission_pct,6),coalesce(p.tax_pct,9),pct,100,'a_receber','venda',p_vgv,coalesce(p.default_commission_pct,6),gross,tax,net,amount,'Comissão histórica lançada junto ao VGV manual.',ref_month); end if;
  return jsonb_build_object('vgv_id',vgv_id,'gross',gross,'tax',tax,'net',net);
end; $$;

create or replace function public.register_direct_sale(p_user_id uuid,p_property_id uuid,p_sale_value numeric,p_sold_at timestamptz,p_commission_sides text[] default array['sale']::text[],p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare sale_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Usuário não autorizado'; end if;
  if p_sale_value is null or p_sale_value<=0 then raise exception 'Informe um valor de venda válido'; end if;
  if p_property_id is null then raise exception 'Selecione o imóvel vendido'; end if;
  if not exists(select 1 from public.properties where id=p_property_id and user_id=p_user_id) then raise exception 'Imóvel não encontrado no seu estoque'; end if;
  if p_commission_sides is null or cardinality(p_commission_sides)=0 then raise exception 'Informe sua atuação na venda'; end if;
  insert into public.sales(user_id,deal_id,property_id,proposal_id,sale_value,sold_at,notes,commission_sides) values(p_user_id,null,p_property_id,null,p_sale_value,coalesce(p_sold_at,now()),p_notes,p_commission_sides) returning id into sale_id;
  return sale_id;
end; $$;
