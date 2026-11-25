-- Production has NO commissions_status_check (2026-10-22 snapshot). Simulate
-- that here so the R2 'unknown' branch can be exercised: a legacy status that
-- no repository code writes but that may exist in remote data.
alter table public.commissions drop constraint commissions_status_check;

insert into public.commissions
  (id, user_id, vgv, gross_pct, tax_pct, participation_pct, role_pct, status, commission_type, user_amount, due_date, reference_month)
values
 ('c0000000-0000-0000-0000-000000000012','33333333-3333-3333-3333-333333333333',0,6,9,20,100,'encerrada','venda',250,null,current_date);

select count(*) as commissions from public.commissions;
