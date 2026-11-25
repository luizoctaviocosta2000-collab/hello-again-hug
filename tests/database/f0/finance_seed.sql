-- DB1 finance matrix. Statuses deliberately mix the canonical PT vocabulary,
-- the production EN vocabulary, an unknown value, a NULL amount and a zero.
delete from public.commission_receipts;
delete from public.commissions;
delete from public.vgv_entries;
delete from auth.users where id in ('33333333-3333-3333-3333-333333333333',
                                    '44444444-4444-4444-4444-444444444444');

insert into auth.users(id, email, raw_user_meta_data) values
  ('33333333-3333-3333-3333-333333333333', 'a@example.com', '{"full_name":"Usuario A"}'::jsonb),
  ('44444444-4444-4444-4444-444444444444', 'b@example.com', '{"full_name":"Usuario B"}'::jsonb);

insert into public.commissions
  (id, user_id, vgv, gross_pct, tax_pct, participation_pct, role_pct, status, commission_type, user_amount, due_date, reference_month)
values
 ('c0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333',0,6,9,20,100,'prevista',           'venda',1000,null,             current_date),
 ('c0000000-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333333',0,6,9,20,100,'forecast',           'venda', 500,null,             current_date),
 ('c0000000-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333',0,6,9,20,100,'a_receber',          'venda',2000,current_date - 10, current_date),
 ('c0000000-0000-0000-0000-000000000004','33333333-3333-3333-3333-333333333333',0,6,9,20,100,'receivable',         'venda',3000,current_date + 10, current_date),
 ('c0000000-0000-0000-0000-000000000005','33333333-3333-3333-3333-333333333333',0,6,9,20,100,'partially_received', 'venda',1000,current_date + 5,  current_date),
 ('c0000000-0000-0000-0000-000000000006','33333333-3333-3333-3333-333333333333',0,6,9,20,100,'recebida',           'venda', 700,null,             current_date),
 ('c0000000-0000-0000-0000-000000000007','33333333-3333-3333-3333-333333333333',0,6,9,20,100,'received',           'venda', 800,null,             current_date),
 ('c0000000-0000-0000-0000-000000000008','33333333-3333-3333-3333-333333333333',0,6,9,20,100,'received',           'venda', 900,null,             current_date),
 ('c0000000-0000-0000-0000-000000000009','33333333-3333-3333-3333-333333333333',0,6,9,20,100,'cancelada',          'venda',5000,null,             current_date),
 ('c0000000-0000-0000-0000-000000000010','33333333-3333-3333-3333-333333333333',0,6,9,20,100,'cancelled',          'venda',6000,null,             current_date),
 ('c0000000-0000-0000-0000-000000000011','33333333-3333-3333-3333-333333333333',0,6,9,20,100,'canceled',           'venda', 100,null,             current_date),
 ('c0000000-0000-0000-0000-000000000013','33333333-3333-3333-3333-333333333333',0,6,9,20,100,'a_receber',          'venda',null,null,             current_date),
 ('c0000000-0000-0000-0000-000000000014','33333333-3333-3333-3333-333333333333',0,6,9,20,100,'recebida',           'venda',   0,null,             current_date),
 ('c0000000-0000-0000-0000-000000000015','44444444-4444-4444-4444-444444444444',0,6,9,20,100,'receivable',         'venda',5000,current_date + 3,  current_date);

-- real receipts, inserted as user A so the ownership trigger accepts them
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
insert into public.commission_receipts(user_id, commission_id, amount) values
 ('33333333-3333-3333-3333-333333333333','c0000000-0000-0000-0000-000000000005',400.00),
 ('33333333-3333-3333-3333-333333333333','c0000000-0000-0000-0000-000000000008',850.00);

-- the receipt trigger forces a consistent status; restore the historical mix
-- (production had no such trigger before 2026-10-22, so statuses can diverge).
update public.commissions set status='received' where id='c0000000-0000-0000-0000-000000000008';
update public.commissions set status='partially_received' where id='c0000000-0000-0000-0000-000000000005';

select count(*) as commissions, count(*) filter (where user_amount is null) as null_amounts
from public.commissions;
