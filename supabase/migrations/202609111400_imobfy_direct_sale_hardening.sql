-- IMOBFY: harden the direct-sale RPC used by the "Lançar venda" flow.
create or replace function public.register_direct_sale(
  p_user_id uuid,
  p_property_id uuid,
  p_sale_value numeric,
  p_sold_at timestamptz,
  p_commission_sides text[] default array['sale']::text[],
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sale_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Usuário não autorizado';
  end if;
  if p_property_id is null then
    raise exception 'Selecione o imóvel vendido';
  end if;
  if p_sale_value is null or p_sale_value <= 0 then
    raise exception 'Informe um valor de venda válido';
  end if;
  if p_sold_at is null then
    raise exception 'Informe a data da venda';
  end if;
  if p_commission_sides is null or cardinality(p_commission_sides) = 0 then
    raise exception 'Informe sua atuação na venda';
  end if;
  if not exists (
    select 1 from public.properties
    where id = p_property_id and user_id = p_user_id
  ) then
    raise exception 'Imóvel não encontrado no seu estoque';
  end if;

  insert into public.sales (
    user_id, deal_id, property_id, proposal_id,
    sale_value, sold_at, notes, commission_sides
  ) values (
    p_user_id, null, p_property_id, null,
    round(p_sale_value, 2), p_sold_at, p_notes, p_commission_sides
  )
  returning id into sale_id;

  return sale_id;
end;
$$;

revoke all on function public.register_direct_sale(uuid, uuid, numeric, timestamptz, text[], text) from public;
grant execute on function public.register_direct_sale(uuid, uuid, numeric, timestamptz, text[], text) to authenticated;
