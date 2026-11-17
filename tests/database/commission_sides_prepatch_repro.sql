-- Demonstrate the ORIGINAL defect before applying the fix.
-- The whole synthetic example is rolled back, leaving no rows.
begin;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.register_direct_sale(
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  500000,now(),array['sale']::text[],'before-patch-sale-only'
);
do $$
begin
  if (select count(*) from public.commissions) <> 2
     or (select count(*) from public.commissions where commission_type='venda') <> 1
     or (select count(*) from public.commissions where commission_type='captacao') <> 1 then
    raise exception 'Original capture fallback was not reproduced; review the patch assumptions';
  end if;
end $$;
rollback;
select 'PASS: old migration incorrectly generated both commissions for a sale-only direct sale' as prepatch_observation;
