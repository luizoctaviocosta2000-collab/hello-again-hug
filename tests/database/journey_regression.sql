-- All records below are synthetic and exist only in a disposable database.
create function public.test_assert(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function public.test_error(command text, expected_state text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when others then
    if sqlstate=expected_state then return; end if;
    raise exception 'Expected %, got %: %',expected_state,sqlstate,sqlerrm;
  end;
  raise exception 'Expected rejection: %',command;
end $$;
insert into auth.users(id) values ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
insert into public.profiles(id,name,email) values
 ('10000000-0000-0000-0000-000000000001','Synthetic A','a@example.test'),
 ('10000000-0000-0000-0000-000000000002','Synthetic B','b@example.test');
insert into public.clients(id,user_id,name) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Client A'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Client B');
insert into public.properties(id,user_id,title,sale_value) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Property 1',500000),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Property 2',600000),
 ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','Foreign property',500000);
insert into public.deals(id,user_id,client_id,sides) values
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',array['sale']),
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',array['sale']);
create temp table test_visits(label text,id uuid);
grant select,insert on test_visits to authenticated;
set role authenticated;
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
insert into test_visits select 'main', public.save_visit_journey(null,'20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','2026-10-22T14:00:00Z','2026-10-22T15:00:00Z',array['30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002']::uuid[],'Meeting','Notes');
select public.test_assert((select count(*)=2 from public.deal_properties where visit_status='planned'),'save creates planned commercial links');
select public.test_error($q$insert into public.proposals(user_id,deal_id,property_id,amount) values ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',500000)$q$,'P0001');
select public.test_error($q$update public.deals set stage='fechado_ganho' where id='40000000-0000-0000-0000-000000000001'$q$,'23514');
select public.test_error($q$select public.save_visit_journey(null,null,null,now(),now()+interval '1 hour',array['30000000-0000-0000-0000-000000000003']::uuid[],null,null)$q$,'42501');
select public.test_error($q$select public.save_visit_journey(null,'20000000-0000-0000-0000-000000000002',null,now(),null,array[]::uuid[],null,null)$q$,'42501');
select public.test_error($q$select public.save_visit_journey(null,null,'40000000-0000-0000-0000-000000000001',now(),null,array[]::uuid[],null,null)$q$,'22023');
select public.test_assert((select count(*)=1 from public.visits),'failed saves do not leave visits');
update public.visit_properties set notes='Preserve me',visited=true where property_id='30000000-0000-0000-0000-000000000002';
select public.save_visit_journey((select id from test_visits where label='main'),'20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','2026-10-22T16:00:00Z','2026-10-22T17:00:00Z',array['30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001']::uuid[],'Updated','Updated');
select public.test_assert((select notes='Preserve me' and visited and sequence=1 from public.visit_properties where property_id='30000000-0000-0000-0000-000000000002'),'editing preserves visit metadata');
select public.test_error($q$select public.finish_visit_journey((select id from test_visits where label='main'),'done',array['30000000-0000-0000-0000-000000000003']::uuid[])$q$,'42501');
select public.test_assert((select status='scheduled' from public.visits),'invalid completion rolls back');
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000002';
select public.test_error($q$select public.finish_visit_journey((select id from test_visits where label='main'),'done',array[]::uuid[])$q$,'42501');
set request.jwt.claim.sub='10000000-0000-0000-0000-000000000001';
select public.finish_visit_journey((select id from test_visits where label='main'),'done',array['30000000-0000-0000-0000-000000000001']::uuid[]);
select public.finish_visit_journey((select id from test_visits where label='main'),'done',array['30000000-0000-0000-0000-000000000001']::uuid[]);
select public.test_assert((select count(*)=1 from public.visit_properties where visited),'only explicitly selected property is visited');
select public.test_assert((select visit_status='planned' from public.deal_properties where property_id='30000000-0000-0000-0000-000000000002'),'unvisited property remains planned');
insert into public.proposals(id,user_id,deal_id,property_id,amount) values ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',500000);
select public.test_error($q$insert into public.sales(user_id,deal_id,property_id,proposal_id,sale_value) values ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',500000)$q$,'P0001');
update public.proposals set status='accepted',responded_at=now() where id='50000000-0000-0000-0000-000000000001';
insert into public.sales(user_id,deal_id,property_id,proposal_id,sale_value) values ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',500000);
select public.test_assert((select status='closed' and stage='fechado_ganho' from public.deals where id='40000000-0000-0000-0000-000000000001'),'sale closes commercial journey');
select public.test_assert((select count(*)=1 and sum(user_amount)=5460 from public.commissions),'existing financial formula preserved');
select public.test_assert((select count(*)=1 and sum(vgv)=500000 from public.vgv_entries),'sale creates VGV exactly once');
insert into public.commission_receipts(user_id,commission_id,amount) select user_id,id,user_amount from public.commissions;
select public.test_assert((select status='received' from public.commissions),'receipt still works with complete schema');
insert into test_visits select 'repeat',public.save_visit_journey(null,'20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',now(),null,array['30000000-0000-0000-0000-000000000001']::uuid[],null,null);
select public.test_assert((select visit_status='visited' and sold from public.deal_properties where property_id='30000000-0000-0000-0000-000000000001'),'rescheduling preserves sold/visited history');
select public.finish_visit_journey((select id from test_visits where label='repeat'),'cancelled',array[]::uuid[]);
select public.test_assert((select not visited from public.visit_properties where visit_id=(select id from test_visits where label='repeat')),'cancellation does not mark visited');
reset role;
select public.test_assert(not has_function_privilege('anon','public.finish_visit_journey(uuid,text,uuid[])','execute'),'anonymous RPC denied');
select 'full journey regression passed' as result;
