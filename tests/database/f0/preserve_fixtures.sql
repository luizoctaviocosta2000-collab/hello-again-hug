-- DB2 fixtures: generated columns with real values, rounding, zero, and a NULL
-- produced through a nullable input (disposable database only).
insert into auth.users(id, email, raw_user_meta_data)
values ('99999999-9999-9999-9999-999999999999', 'preserve@example.com',
        '{"full_name":"Preservacao"}'::jsonb);

insert into public.commissions(user_id, vgv, gross_pct, tax_pct, participation_pct, role_pct, status)
values
  ('99999999-9999-9999-9999-999999999999', 500000.00, 6, 9,    20,    100, 'a_receber'),
  ('99999999-9999-9999-9999-999999999999',      0.00, 6, 9,    20,    100, 'a_receber'),
  ('99999999-9999-9999-9999-999999999999', 100000.00, 6, 0,    10,    100, 'a_receber'),
  ('99999999-9999-9999-9999-999999999999', 123456.78, 6, 9.5,  33.33, 100, 'a_receber');

-- A generated column can only be NULL if an input is NULL. Drop the NOT NULL
-- just for this synthetic row to prove the conversion is NULL-safe.
alter table public.commissions alter column participation_pct drop not null;
insert into public.commissions(user_id, vgv, gross_pct, tax_pct, participation_pct, role_pct, status)
values ('99999999-9999-9999-9999-999999999999', 500000.00, 6, 9, null, 100, 'a_receber');

create schema if not exists f0test;
create table f0test.before as
select id, vgv, gross_amount, tax_amount, user_amount
from public.commissions
order by vgv, gross_amount;

select count(*) as fixtures, count(*) filter (where user_amount is null) as null_user_amount
from f0test.before;
