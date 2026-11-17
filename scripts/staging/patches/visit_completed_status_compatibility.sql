-- IMOBFY staging-only compatibility patch after historical steps 23-25.
-- Do not alter already applied source migration 25 or execute in production.
-- The real visits_status_check accepts 'completed', not 'done'.
-- Clients send the legacy action 'done': normalize persistence to 'completed'.

do $imobfy_visit_preflight$
begin
  if to_regprocedure('public.finish_visit_journey(uuid,text,uuid[])') is null
    or not exists (select 1 from pg_constraint c
      where c.conrelid='public.visits'::regclass and c.conname='visits_status_check'
        and pg_get_constraintdef(c.oid) like '%completed%')
  then raise exception 'Visit source RPC or real completed status constraint missing'; end if;
end
$imobfy_visit_preflight$;

create or replace function public.finish_visit_journey(p_visit_id uuid, p_status text, p_visited_property_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  visit_row public.visits%rowtype;
  ids uuid[] := coalesce(p_visited_property_ids,array[]::uuid[]);
  target_status text := case when p_status='done' then 'completed' else p_status end;
begin
  if uid is null then raise exception using errcode='42501', message='Sessão necessária'; end if;
  if p_status is null or p_status not in ('done','cancelled') then
    raise exception using errcode='22023', message='Resultado de visita inválido';
  end if;
  select * into visit_row from public.visits where id=p_visit_id and user_id=uid for update;
  if not found then raise exception using errcode='42501', message='Visita não autorizada'; end if;
  if visit_row.status=target_status then return; end if; -- safe retry of normalized outcome
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
  update public.visits set status=target_status,updated_at=now() where id=p_visit_id and user_id=uid;
end $$;

revoke all on function public.finish_visit_journey(uuid,text,uuid[]) from public,anon;
grant execute on function public.finish_visit_journey(uuid,text,uuid[]) to authenticated;

do $imobfy_visit_postflight$
begin
  if has_function_privilege('anon','public.finish_visit_journey(uuid,text,uuid[])','EXECUTE')
    or not has_function_privilege('authenticated','public.finish_visit_journey(uuid,text,uuid[])','EXECUTE')
    or (select prosecdef from pg_proc where oid='public.finish_visit_journey(uuid,text,uuid[])'::regprocedure)
    or position('status=target_status' in lower(
      pg_get_functiondef('public.finish_visit_journey(uuid,text,uuid[])'::regprocedure)))=0
  then raise exception 'Normalized visit function is not safely installed'; end if;
end
$imobfy_visit_postflight$;
