-- PostgreSQL 17 regression for agent autonomy RLS, least privilege, defaults, limits, audit.
\set ON_ERROR_STOP on

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

insert into public.imobfy_agent_global_controls(user_id)
 values ('11111111-1111-4111-8111-111111111111');

insert into public.imobfy_agent_policies(user_id,domain)
 values ('11111111-1111-4111-8111-111111111111','ads'),
        ('11111111-1111-4111-8111-111111111111','financeiro');

do $$
begin
  if (select count(*) from public.imobfy_agent_policies) <> 2 then
    raise exception 'Tenant A policies should be visible'; end if;
  if not (select bool_and(mode='off' and emergency_stop) from public.imobfy_agent_policies) then
    raise exception 'Autonomy must default OFF and stopped'; end if;
  if not (select emergency_stop from public.imobfy_agent_global_controls) then
    raise exception 'Global stop should be ON by default'; end if;
  if has_table_privilege('authenticated','public.imobfy_agent_execution_audit','INSERT') or
     has_table_privilege('authenticated','public.imobfy_agent_execution_audit','UPDATE') or
     has_column_privilege('authenticated','public.imobfy_agent_policies','user_id','UPDATE') or
     has_column_privilege('authenticated','public.imobfy_agent_policies','domain','UPDATE') then
    raise exception 'Client must not insert audit or reassign policy identity'; end if;
end $$;

-- Users may configure bounded limits but policy controls still require an
-- independently verified provider binding, signature and durable audit.
update public.imobfy_agent_policies
  set mode='bounded', emergency_stop=false, max_ads_daily_budget_brl=200,
      max_ads_budget_change_pct=10
  where domain='ads';

do $$
begin
  if (select max_ads_daily_budget_brl from public.imobfy_agent_policies where domain='ads')<>200 then
    raise exception 'Allowed owner update did not persist'; end if;
end $$;

do $$
begin
  begin
    update public.imobfy_agent_policies set max_ads_budget_change_pct=100 where domain='ads';
    raise exception 'The unsafe cap update should be rejected';
  exception when check_violation then null;
  end;
  begin
    insert into public.imobfy_agent_policies
      (user_id,domain,mode,max_messages_per_day)
      values ('11111111-1111-4111-8111-111111111111','atendimento','bounded',300);
    raise exception 'Message cap above hard ceiling should be rejected';
  exception when check_violation then null;
  end;
  begin
    insert into public.imobfy_agent_policies(user_id,domain,max_transfer_brl,max_transfers_per_day_brl)
    values ('11111111-1111-4111-8111-111111111111','financeiro',100,200);
    raise exception 'Duplicate domain must not be silently accepted';
  exception when unique_violation then null;
  end;
end $$;

set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
insert into public.imobfy_agent_global_controls(user_id)
 values ('22222222-2222-4222-8222-222222222222');
insert into public.imobfy_agent_policies(user_id,domain)
 values ('22222222-2222-4222-8222-222222222222','ads');

do $$
declare changed integer;
begin
  if (select count(*) from public.imobfy_agent_policies) <> 1 then
    raise exception 'Tenant B must not read tenant A policies'; end if;
  if (select count(*) from public.imobfy_agent_global_controls) <> 1 then
    raise exception 'Tenant B must not read global stop of tenant A'; end if;
  update public.imobfy_agent_policies set mode='bounded'
    where user_id='11111111-1111-4111-8111-111111111111';
  get diagnostics changed=row_count;
  if changed <> 0 then raise exception 'Tenant B updated tenant A policies'; end if;
  begin
    insert into public.imobfy_agent_global_controls(user_id)
      values ('11111111-1111-4111-8111-111111111111');
    raise exception 'Tenant B forged tenant A global stop';
  exception when insufficient_privilege then null;
    when check_violation then null;
  end;
end $$;

reset role;
insert into public.imobfy_agent_execution_audit(user_id,domain,action_kind,status,
 idempotency_key,reason_code,summary)
values ('11111111-1111-4111-8111-111111111111','ads','ads.pause','proposed',
 'ads:example-20261118-a','READY','Campanha aguardando execução verificada'),
 ('22222222-2222-4222-8222-222222222222','financeiro','finance.reconcile','succeeded',
 'finance:example-20261118-b','SIGNED_WEBHOOK','Recebimento verificado');

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$
begin
  if (select count(*) from public.imobfy_agent_execution_audit)<>1 then
    raise exception 'Audit must remain private to its owner'; end if;
  if (select count(*) from public.imobfy_agent_execution_audit where domain='ads')<>0 then
    raise exception 'Other tenant audit leaked'; end if;
end $$;

reset role;
do $$
begin
  begin
    insert into public.imobfy_agent_execution_audit(user_id,domain,action_kind,status,
      idempotency_key,reason_code)
    values ('11111111-1111-4111-8111-111111111111','ads','ads.pause','succeeded',
      'ads:example-20261118-a','DUPLICATE');
    raise exception 'Replay key should have been denied';
  exception when unique_violation then null;
  end;
end $$;

select 'agent autonomy RLS, privilege, limits, default stop and replay regression: PASS' as result;
