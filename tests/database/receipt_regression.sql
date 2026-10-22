-- Uses SQL exceptions so a failure also fails psql / CI; no extension needed.
create function public.test_assert(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function public.test_error(command text, expected_state text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise exception 'Expected SQLSTATE %, got %: %',expected_state,sqlstate,sqlerrm;
  end;
  raise exception 'Expected failure but command succeeded: %',command;
end $$;
select public.test_assert((select count(*)=2 from pg_trigger where tgrelid='public.commission_receipts'::regclass and not tgisinternal),'exactly two triggers');
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select public.test_assert((select count(*)=3 from public.commissions),'RLS hides user B');
select public.test_error($q$insert into public.commission_receipts(user_id,commission_id,amount) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',10)$q$,'42501');
select public.test_error($q$insert into public.commission_receipts(user_id,commission_id,amount) values
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',10)$q$,'42501');
select public.test_error($q$insert into public.commission_receipts(user_id,commission_id,amount) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000099',10)$q$,'42501');
insert into public.commission_receipts(id,user_id,commission_id,amount) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',40);
select public.test_assert((select status='partially_received' and received_at is null from public.commissions where id='00000000-0000-0000-0000-000000000001'),'partial receipt');
select public.test_error($q$update public.commission_receipts set commission_id='00000000-0000-0000-0000-000000000003'$q$,'23514');
select public.test_error($q$update public.commission_receipts set commission_id='00000000-0000-0000-0000-000000000002'$q$,'23514');
select public.test_error($q$update public.commission_receipts set user_id='10000000-0000-0000-0000-000000000002'$q$,'42501');
select public.test_error($q$update public.commission_receipts set id='20000000-0000-0000-0000-000000000099'$q$,'23514');
select public.test_error($q$update public.commission_receipts set amount=101$q$,'23514');
select public.test_error($q$update public.commission_receipts set amount=0$q$,'23514');
select public.test_error($q$update public.commission_receipts set amount=-1$q$,'23514');
select public.test_error($q$update public.commission_receipts set amount='NaN'$q$,'23514');
select public.test_error($q$insert into public.commission_receipts(user_id,commission_id,amount) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',61)$q$,'23514');
insert into public.commission_receipts(id,user_id,commission_id,amount) values
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',60);
select public.test_assert((select status='received' and received_at is not null from public.commissions where id='00000000-0000-0000-0000-000000000001'),'full receipt');
update public.commission_receipts set amount=50 where id='20000000-0000-0000-0000-000000000002';
select public.test_assert((select status='partially_received' and received_at is null from public.commissions where id='00000000-0000-0000-0000-000000000001'),'edit reopens balance');
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
select public.test_assert((select count(*)=0 from public.commission_receipts),'RLS hides receipts from B');
update public.commission_receipts set amount=1;
delete from public.commission_receipts;
select public.test_assert((select status='receivable' from public.commissions where id='00000000-0000-0000-0000-000000000002'),'foreign commission unchanged');
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select public.test_assert((select sum(amount)=90 from public.commission_receipts),'foreign mutations affect no rows');
delete from public.commission_receipts;
select public.test_assert((select status='receivable' and received_at is null from public.commissions where id='00000000-0000-0000-0000-000000000001'),'delete all reopens balance');
insert into public.commission_receipts(user_id,commission_id,amount) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',100);
delete from public.commissions where id='00000000-0000-0000-0000-000000000003';
select public.test_assert((select count(*)=0 from public.commission_receipts),'parent cascade still works');
reset role;
set role anon;
set request.jwt.claim.sub = '';
select public.test_assert((select count(*)=0 from public.commissions),'anonymous cannot read commissions');
select public.test_error($q$insert into public.commission_receipts(user_id,commission_id,amount) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',1)$q$,'42501');
reset role;
-- FK is defense in depth even when the application trigger is bypassed by an admin.
alter table public.commission_receipts disable trigger validate_commission_receipt_amount_trigger;
select public.test_error($q$insert into public.commission_receipts(user_id,commission_id,amount) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',1)$q$,'23503');
alter table public.commission_receipts enable trigger validate_commission_receipt_amount_trigger;
select public.test_assert(not has_function_privilege('authenticated','public.sync_commission_receipt_status()','execute'),'status RPC revoked');
select public.test_assert(not has_function_privilege('anon','public.validate_commission_receipt_amount()','execute'),'validation RPC revoked');
select 'receipt regression passed' as result;
