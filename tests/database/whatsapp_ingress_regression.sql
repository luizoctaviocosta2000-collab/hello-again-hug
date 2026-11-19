-- Disposable database only, after fixture + foundation + ingress migrations.
insert into imobfy_private.whatsapp_connections(phone_number_id,waba_id,user_id,enabled)
  values('123456','987654','11111111-1111-4111-8111-111111111111',true);
create function pg_temp.event(id text, sender text, body text, kind text default 'inbound')
returns jsonb language sql as $$
  select jsonb_build_object(
    'event_key','123456:wamid.'||id||':'||kind,'message_id','wamid.'||id,
    'phone_number_id','123456','waba_id','987654','kind',kind,
    'occurred_at','2026-11-19T12:00:00Z',
    'payload',jsonb_build_object('from',sender,'type','text','text',jsonb_build_object('body',body)));
$$;
select public.imobfy_accept_whatsapp_event(pg_temp.event('one','5511999990000','Olá'));
select public.imobfy_accept_whatsapp_event(pg_temp.event('one','5511999990000','Olá'));
select public.imobfy_accept_whatsapp_event(pg_temp.event('two','5511999990000','Quero falar com corretor'));
select public.imobfy_accept_whatsapp_event(pg_temp.event('three','5511999990000','SAIR'));
select public.imobfy_accept_whatsapp_event(pg_temp.event('out','5511999990000','','read'));
select public.imobfy_accept_whatsapp_event(pg_temp.event('out','5511999990000','','delivered'));
do $$
begin
  if (select count(*) from public.clients)<>1
    or (select count(*) from public.imobfy_attendance_threads)<>1
    or (select count(*) from public.imobfy_attendance_messages)<>3
    or (select count(*) from public.imobfy_whatsapp_events)<>5
    or not (select opted_out from imobfy_private.whatsapp_contacts limit 1)
    or (select status from public.imobfy_attendance_threads limit 1)<>'handoff'
    or (select automation_mode from public.imobfy_attendance_threads limit 1)<>'paused'
    then raise exception 'Dedupe / handoff / opt-out regression'; end if;
  if has_function_privilege('authenticated','public.imobfy_accept_whatsapp_event(jsonb)','execute')
    or has_function_privilege('anon','public.imobfy_accept_whatsapp_event(jsonb)','execute')
    or not has_function_privilege('service_role','public.imobfy_accept_whatsapp_event(jsonb)','execute')
    or has_column_privilege('authenticated','public.imobfy_whatsapp_events','payload','select')
    or has_schema_privilege('authenticated','imobfy_private','usage')
    then raise exception 'Ingress privilege boundary failed'; end if;
  begin
    perform public.imobfy_accept_whatsapp_event(
      pg_temp.event('bad','5511999990000','Olá') || '{"waba_id":"111111"}'::jsonb);
    raise exception 'Wrong WABA accepted';
  exception when raise_exception then
    if sqlerrm <> 'WHATSAPP_CONNECTION_NOT_ENABLED' then raise; end if;
  end;
end $$;
-- Duplicate legacy contacts require reconciliation, no third client.
insert into public.clients(user_id,name,phone) values
('11111111-1111-4111-8111-111111111111','Duplicado A','5511888880000'),
('11111111-1111-4111-8111-111111111111','Duplicado B','5511888880000');
select public.imobfy_accept_whatsapp_event(pg_temp.event('ambiguous','5511888880000','Olá'));
do $$ begin
  if (select count(*) from public.clients)<>3 or
     (select processing_state from public.imobfy_whatsapp_events where message_id='wamid.ambiguous')<>'needs_review'
    then raise exception 'Ambiguous contact duplicated'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$ begin
  if (select count(id) from public.imobfy_whatsapp_events)<>6 then raise exception 'Owner read failed'; end if;
end $$;
reset role;
insert into public.properties(id,user_id) values
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111'),
('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222');
set role authenticated;
update public.imobfy_attendance_threads set property_id='33333333-3333-4333-8333-333333333333';
do $$ begin
  begin
    update public.imobfy_attendance_threads set property_id='44444444-4444-4444-8444-444444444444';
    raise exception 'Cross-tenant property linked';
  exception when foreign_key_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$ begin
  if (select count(id) from public.imobfy_whatsapp_events)<>0 then raise exception 'Cross-tenant receipt exposure'; end if;
  begin
    perform public.imobfy_accept_whatsapp_event('{}');
    raise exception 'Browser called ingress';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
