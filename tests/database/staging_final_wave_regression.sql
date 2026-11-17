-- Stages 23–25 regression: DISPOSABLE PostgreSQL only.
-- Run after inventory-finance regression creates two synthetic Auth users.
do $check_contract$
begin
  if has_function_privilege('anon','public.consume_ai_quota(text)','EXECUTE')
    or has_table_privilege('authenticated','public.ai_usage','SELECT')
    or not has_function_privilege('authenticated','public.consume_ai_quota(text)','EXECUTE')
    or has_function_privilege('anon','public.save_visit_journey(uuid,uuid,uuid,timestamptz,timestamptz,uuid[],text,text)','EXECUTE')
  then raise exception 'Stage 23-25 privileges mismatch'; end if;
end $check_contract$;

-- This user identity is simulated by the disposable database test harness,
-- not a real Supabase session. Real Auth E2E is a separate release gate.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $quota_a$
declare n integer;
begin
  for n in 1..60 loop
    if not public.consume_ai_quota('chat') then
      raise exception 'Quota rejected a legal call %', n;
    end if;
  end loop;
  if public.consume_ai_quota('chat') then
    raise exception 'Daily quota allowed a 61st chat call';
  end if;
  begin
    perform public.consume_ai_quota('invalid');
    raise exception 'Unknown AI feature accepted';
  exception when sqlstate '22023' then null; end;
end $quota_a$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $quota_b$
begin
  if not public.consume_ai_quota('chat') then
    raise exception 'Second tenant cannot consume its own quota';
  end if;
end $quota_b$;
commit;

do $quota_verify$
begin
 if (select used_count from public.ai_usage
      where user_id='11111111-1111-4111-8111-111111111111'
        and usage_date=(now() at time zone 'utc')::date and feature='chat') <> 60
   or (select used_count from public.ai_usage
      where user_id='22222222-2222-4222-8222-222222222222'
        and usage_date=(now() at time zone 'utc')::date and feature='chat') <> 1 then
   raise exception 'Quota counts mixed across tenants';
 end if;
end $quota_verify$;

create temp table final_stage_test_visits(visit_id uuid);
grant select,insert on final_stage_test_visits to authenticated;

-- Check receipt lifecycle and visit atomicity under A's simulated JWT.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.commission_receipts(user_id,commission_id,amount)
  select user_id,id,user_amount / 2
  from public.commissions
  where user_id='11111111-1111-4111-8111-111111111111'
  order by id limit 1;

do $receipt_check$
declare commission_uuid uuid;
        expected_half numeric;
begin
  select c.id,c.user_amount / 2 into commission_uuid,expected_half
    from public.commissions c
    where c.user_id='11111111-1111-4111-8111-111111111111'
    order by c.id limit 1;
  if (select status from public.commissions where id=commission_uuid) <> 'partially_received'
    or (select sum(amount) from public.commission_receipts where commission_id=commission_uuid) <> expected_half then
    raise exception 'Partial payment not reflected in commission';
  end if;
  begin
    insert into public.commission_receipts(user_id,commission_id,amount)
      select user_id,id,user_amount
      from public.commissions where id=commission_uuid;
    raise exception 'Overpayment was incorrectly accepted';
  exception when sqlstate '23514' then null; end;
end $receipt_check$;

insert into final_stage_test_visits(visit_id)
select public.save_visit_journey(
 null,null,null,
 now()+interval '1 day',now()+interval '1 day 1 hour',
 array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[],
 'Visita sintética','Teste de autorização'
);
do $visit_check$
begin
 if (select count(*) from public.visits
      where id=(select visit_id from final_stage_test_visits)
        and status='scheduled') <> 1 then
    raise exception 'Atomic visit save failed';
 end if;
end $visit_check$;
commit;

-- B cannot read or finish A's visit, nor create a visit on A's property.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $cross_tenant$
begin
  if (select count(*) from public.visits
       where id=(select visit_id from final_stage_test_visits)) <> 0 then
    raise exception 'Tenant B can read tenant A visit';
  end if;
  begin
    perform public.finish_visit_journey(
      (select visit_id from final_stage_test_visits),'done',
      array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[]);
    raise exception 'Tenant B finished tenant A visit';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.save_visit_journey(
      null,null,null,now()+interval '1 day',null,
      array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[],null,null);
    raise exception 'Tenant B linked tenant A property';
  exception when sqlstate '42501' then null; end;
end $cross_tenant$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.finish_visit_journey(
 (select visit_id from final_stage_test_visits),'done',
 array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[]
);
select public.finish_visit_journey(
 (select visit_id from final_stage_test_visits),'done',
 array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[]
);
do $finish_verify$
begin
 if (select status from public.visits
      where id=(select visit_id from final_stage_test_visits)) <> 'done'
    or (select count(*) from public.visit_properties
      where visit_id=(select visit_id from final_stage_test_visits) and visited) <> 1 then
   raise exception 'Visit completion and idempotent retry failed';
 end if;
end $finish_verify$;
commit;

select 'PASS: quotas isolated, overpayments rejected, visits and cross-tenant denials' as result;
