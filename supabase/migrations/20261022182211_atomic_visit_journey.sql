begin;
set local lock_timeout = '5s';

-- One transaction for visit + itinerary + commercial links. RLS remains active.
create or replace function public.save_visit_journey(
  p_visit_id uuid, p_client_id uuid, p_deal_id uuid,
  p_starts_at timestamptz, p_ends_at timestamptz,
  p_property_ids uuid[], p_location text, p_notes text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  target uuid;
  current_status text;
  deal_client uuid;
  ids uuid[] := coalesce(p_property_ids, array[]::uuid[]);
begin
  if uid is null then raise exception using errcode='42501', message='Sessão necessária'; end if;
  if p_starts_at is null or not isfinite(p_starts_at)
    or (p_ends_at is not null and (not isfinite(p_ends_at) or p_ends_at <= p_starts_at)) then
    raise exception using errcode='22023', message='Informe um horário válido';
  end if;
  if cardinality(ids) <> (select count(distinct x) from unnest(ids) x) then
    raise exception using errcode='22023', message='Imóveis inválidos ou repetidos';
  end if;
  if p_client_id is not null and not exists(select 1 from public.clients where id=p_client_id and user_id=uid) then
    raise exception using errcode='42501', message='Cliente não autorizado';
  end if;
  if p_deal_id is not null then
    select client_id into deal_client from public.deals where id=p_deal_id and user_id=uid for key share;
    if not found then raise exception using errcode='42501', message='Negócio não autorizado'; end if;
    if deal_client is distinct from p_client_id then
      raise exception using errcode='22023', message='O cliente deve ser o mesmo do negócio';
    end if;
  end if;
  if (select count(*) from public.properties where id=any(ids) and user_id=uid) <> cardinality(ids) then
    raise exception using errcode='42501', message='Imóvel não autorizado';
  end if;
  if p_visit_id is null then
    insert into public.visits(user_id,client_id,deal_id,starts_at,ends_at,status,location,notes)
    values(uid,p_client_id,p_deal_id,p_starts_at,p_ends_at,'scheduled',nullif(btrim(p_location),''),nullif(btrim(p_notes),'')) returning id into target;
  else
    select status into current_status from public.visits where id=p_visit_id and user_id=uid for update;
    if not found then raise exception using errcode='42501', message='Visita não autorizada'; end if;
    if current_status in ('done','completed','cancelled','canceled') then
      raise exception using errcode='22023', message='Esta visita já foi encerrada';
    end if;
    target := p_visit_id;
    update public.visits set client_id=p_client_id,deal_id=p_deal_id,starts_at=p_starts_at,
      ends_at=p_ends_at,location=nullif(btrim(p_location),''),notes=nullif(btrim(p_notes),''),updated_at=now()
    where id=target and user_id=uid;
  end if;
  delete from public.visit_properties where visit_id=target and user_id=uid and not(property_id=any(ids));
  insert into public.visit_properties(user_id,visit_id,property_id,sequence)
    select uid,target,x,ordinality::integer from unnest(ids) with ordinality as item(x,ordinality)
    on conflict(visit_id,property_id) do update set sequence=excluded.sequence
    where public.visit_properties.user_id=uid;
  if p_deal_id is not null then
    insert into public.deal_properties(user_id,deal_id,property_id,visit_status)
      select uid,p_deal_id,x,'planned' from unnest(ids) x
      on conflict(user_id,deal_id,property_id) do nothing;
  end if;
  return target;
end $$;

create or replace function public.finish_visit_journey(p_visit_id uuid, p_status text, p_visited_property_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  visit_row public.visits%rowtype;
  ids uuid[] := coalesce(p_visited_property_ids,array[]::uuid[]);
begin
  if uid is null then raise exception using errcode='42501', message='Sessão necessária'; end if;
  if p_status is null or p_status not in ('done','cancelled') then
    raise exception using errcode='22023', message='Resultado de visita inválido';
  end if;
  select * into visit_row from public.visits where id=p_visit_id and user_id=uid for update;
  if not found then raise exception using errcode='42501', message='Visita não autorizada'; end if;
  if visit_row.status=p_status then return; end if; -- safe retry of the same outcome
  if visit_row.status in ('done','completed','cancelled','canceled') then
    raise exception using errcode='22023', message='Esta visita já foi encerrada';
  end if;
  if cardinality(ids) <> (select count(distinct x) from unnest(ids) x) then
    raise exception using errcode='22023', message='Imóveis inválidos ou repetidos';
  end if;
  if p_status='cancelled' and cardinality(ids)>0 then
    raise exception using errcode='22023', message='Cancelamento não registra imóveis visitados';
  end if;
  if (select count(*) from public.visit_properties vp join public.properties p on p.id=vp.property_id and p.user_id=uid
      where vp.visit_id=p_visit_id and vp.user_id=uid and vp.property_id=any(ids)) <> cardinality(ids) then
    raise exception using errcode='42501', message='Imóvel não vinculado à visita';
  end if;
  if p_status='done' then
    if exists(select 1 from public.visit_properties where visit_id=p_visit_id and user_id=uid) and cardinality(ids)=0 then
      raise exception using errcode='22023', message='Selecione os imóveis efetivamente visitados';
    end if;
    update public.visit_properties set visited=(property_id=any(ids)) where visit_id=p_visit_id and user_id=uid;
    if visit_row.deal_id is not null then
      if not exists(select 1 from public.deals where id=visit_row.deal_id and user_id=uid) then
        raise exception using errcode='42501', message='Negócio não autorizado';
      end if;
      insert into public.deal_properties(user_id,deal_id,property_id,visit_status)
        select uid,visit_row.deal_id,x,'visited' from unnest(ids) x
        on conflict(user_id,deal_id,property_id) do update set visit_status='visited',updated_at=now()
        where public.deal_properties.visit_status in ('planned','discarded');
    end if;
  end if;
  update public.visits set status=p_status,updated_at=now() where id=p_visit_id and user_id=uid;
end $$;

-- Moving a card cannot bypass the existing validated sale/accepted-proposal path.
create or replace function public.guard_deal_closing_stage()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.stage='fechado_ganho' and new.status is distinct from 'closed' then
    raise exception using errcode='23514', message='Registre a venda com proposta aceita para fechar o negócio';
  end if;
  return new;
end $$;
create trigger deal_closing_stage_guard before insert or update of stage,status on public.deals
  for each row execute function public.guard_deal_closing_stage();
revoke all on function public.guard_deal_closing_stage() from public,anon,authenticated;
revoke all on function public.save_visit_journey(uuid,uuid,uuid,timestamptz,timestamptz,uuid[],text,text) from public,anon;
revoke all on function public.finish_visit_journey(uuid,text,uuid[]) from public,anon;
grant execute on function public.save_visit_journey(uuid,uuid,uuid,timestamptz,timestamptz,uuid[],text,text) to authenticated;
grant execute on function public.finish_visit_journey(uuid,text,uuid[]) to authenticated;
commit;
