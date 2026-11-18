-- IMOBFY Intelligence Stage Regression
-- STAGING ONLY; entire fixture is rolled back. Never on production.
begin;
set local statement_timeout='40000ms';

insert into auth.users(id,email,raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111111111','intelligence-a@imobfy.invalid','{"full_name":"Test A"}'::jsonb),
 ('22222222-2222-4222-8222-222222222222','intelligence-b@imobfy.invalid','{"full_name":"Test B"}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);

insert into public.clients(id,user_id,name) values
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Cliente de teste A');
insert into public.properties(id,user_id,title,sale_value) values
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Imóvel de teste A',500000);

insert into public.imobfy_attendance_threads(id,user_id,client_id,property_id) values
 ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444');

insert into public.imobfy_attendance_messages(user_id,thread_id,role,body) values
 ('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',
 'customer','A pergunta foi recebida e registrada manualmente.');
insert into public.imobfy_ads_daily_metrics(user_id,report_date,ad_account_id,campaign_id,campaign_name,spend_brl,impressions,clicks)
values ('11111111-1111-4111-8111-111111111111',current_date,'act_abc','cmp_abc','Campanha de teste',40.75,100,8);

insert into public.imobfy_ads_funnel_events(user_id,event_key,stage,client_id,campaign_id,ad_account_id)
values ('11111111-1111-4111-8111-111111111111','manual:test-client-a:lead','lead',
'33333333-3333-4333-8333-333333333333','cmp_abc','act_abc');

do $verify_owner$
begin
 if (select count(*) from public.imobfy_attendance_threads)<>1
 or (select count(*) from public.imobfy_attendance_messages)<>1
 or (select spend_brl from public.imobfy_ads_daily_metrics limit 1)<>40.75
 or (select count(*) from public.imobfy_ads_funnel_events)<>1
 then raise exception 'A tenant data not persisted as expected'; end if;
 if has_table_privilege('authenticated','public.imobfy_ads_funnel_events','UPDATE')
 or has_table_privilege('authenticated','public.imobfy_attendance_messages','UPDATE')
 then raise exception 'Unexpected mutable audit rows'; end if;
 begin
  insert into public.imobfy_ads_funnel_events(user_id,event_key,stage,client_id,campaign_id)
  values ('11111111-1111-4111-8111-111111111111','manual:test-client-a:lead','lead',
  '33333333-3333-4333-8333-333333333333','cmp_abc');
  raise exception 'Duplicate idempotency key accepted';
 exception when unique_violation then null; end;
 begin
  insert into public.imobfy_ads_daily_metrics(user_id,report_date,ad_account_id,campaign_id,campaign_name,spend_brl,source)
  values ('11111111-1111-4111-8111-111111111111',current_date,'act_meta','cmp_meta','Fraude Meta',1,'meta');
  raise exception 'Browser impersonated official Meta source';
 exception when insufficient_privilege then null; end;
end $verify_owner$;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
insert into public.clients(id,user_id,name)
values ('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','Cliente de teste B');

do $verify_isolation$
begin
 if (select count(*) from public.imobfy_attendance_threads)<>0
 or (select count(*) from public.imobfy_attendance_messages)<>0
 or (select count(*) from public.imobfy_ads_funnel_events)<>0
 or (select count(*) from public.imobfy_ads_daily_metrics)<>0 then
   raise exception 'Tenant B can read tenant A intelligence data';
 end if;
 begin
   insert into public.imobfy_attendance_threads(user_id,client_id)
   values ('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333');
   raise exception 'Foreign-client attendance thread inserted';
 exception when foreign_key_violation then null; end;
 begin
   insert into public.imobfy_ads_funnel_events(user_id,event_key,stage,client_id)
   values ('22222222-2222-4222-8222-222222222222','manual:foreign:lead','lead',
   '33333333-3333-4333-8333-333333333333');
   raise exception 'Foreign-client ads event inserted';
 exception when foreign_key_violation then null; end;
 begin
   insert into public.imobfy_attendance_messages(user_id,thread_id,role,body)
   values ('22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555555',
   'customer','Tentativa de acesso cruzado');
   raise exception 'Foreign thread message inserted';
 exception when foreign_key_violation then null; end;
end $verify_isolation$;

reset role;
rollback;

select
 (select count(*) from public.imobfy_attendance_threads) as attendance_after_rollback,
 (select count(*) from public.imobfy_attendance_messages) as messages_after_rollback,
 (select count(*) from public.imobfy_ads_daily_metrics) as ads_reports_after_rollback,
 (select count(*) from public.imobfy_ads_funnel_events) as ads_events_after_rollback,
 (select count(*) from auth.users) as users_after_rollback;
