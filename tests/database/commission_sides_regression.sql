-- Test the explicit commission-side business rules against the actual
-- historical SQL trigger (plus the reviewed corrective migration).
-- All entities are synthetic and the database is disposable.
begin;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);

-- Direct sales with explicitly selected captação / venda / both and meiadas.
select public.register_direct_sale(
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 500000,now(),array['sale']::text[],'direct-sale-only'
);
select public.register_direct_sale(
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 500000,now(),array['capture']::text[],'direct-capture-only'
);
select public.register_direct_sale(
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 500000,now(),array['sale','capture']::text[],'direct-both'
);
select public.register_direct_sale(
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 500000,now(),array['sale_split']::text[],'direct-sale-split'
);
select public.register_direct_sale(
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 500000,now(),array['capture_split']::text[],'direct-capture-split'
);
select public.register_direct_sale(
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 500000,now(),array['sale_split','capture_split']::text[],'direct-both-split'
);

-- Deals with explicit selected sides or an empty legacy sides array.
insert into public.sales(user_id,deal_id,property_id,sale_value,sold_at,notes,commission_sides)
values ('11111111-1111-4111-8111-111111111111','11111111-aaaa-4111-8111-111111111111',
'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',500000,now(),'deal-sale-only',array['sale']::text[]);
insert into public.sales(user_id,deal_id,property_id,sale_value,sold_at,notes,commission_sides)
values ('11111111-1111-4111-8111-111111111111','11111111-bbbb-4111-8111-111111111111',
'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',500000,now(),'deal-capture-only',array['sale']::text[]);
insert into public.sales(user_id,deal_id,property_id,sale_value,sold_at,notes,commission_sides)
values ('11111111-1111-4111-8111-111111111111','11111111-cccc-4111-8111-111111111111',
'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',500000,now(),'deal-empty-sides',array['sale']::text[]);
commit;

do $$
declare
  scenario record;
  sale_count bigint;
  capture_count bigint;
  commission_total numeric;
begin
  for scenario in
    select * from (values
      ('direct-sale-only',1,0,5460.00::numeric),
      ('direct-capture-only',0,1,5460.00::numeric),
      ('direct-both',1,1,10920.00::numeric),
      ('direct-sale-split',1,0,2730.00::numeric),
      ('direct-capture-split',0,1,2730.00::numeric),
      ('direct-both-split',1,1,5460.00::numeric),
      ('deal-sale-only',1,0,5460.00::numeric),
      ('deal-capture-only',0,1,5460.00::numeric),
      ('deal-empty-sides',1,0,5460.00::numeric)
    ) v(label,expected_sale,expected_capture,expected_total)
  loop
    select count(*) filter(where c.commission_type='venda'),
           count(*) filter(where c.commission_type='captacao'),
           coalesce(sum(c.user_amount),0)
    into sale_count, capture_count, commission_total
    from public.sales s join public.commissions c on c.sale_id=s.id
    where s.notes=scenario.label;

    if sale_count <> scenario.expected_sale
       or capture_count <> scenario.expected_capture
       or commission_total <> scenario.expected_total then
      raise exception 'Wrong commission sides/amount for % (venda %, captacao %, total %)',
        scenario.label,sale_count,capture_count,commission_total;
    end if;
  end loop;
  if (select count(*) from public.sales) <> 9
     or (select count(*) from public.commissions) <> 11
     or (select count(*) from public.vgv_entries) <> 9 then
    raise exception 'Unexpected direct-sale/deal/VGV totals';
  end if;
  if position('or not has_explicit_sides' in lower(
    pg_get_functiondef('public.generate_sale_commission()'::regprocedure))) > 0 then
    raise exception 'Unsafe fallback remains in finance trigger';
  end if;
  if has_function_privilege('anon','public.generate_sale_commission()','EXECUTE')
     or has_function_privilege('authenticated','public.generate_sale_commission()','EXECUTE') then
    raise exception 'Finance trigger should not be directly exposed as an RPC';
  end if;
end $$;

select 'PASS: explicit venda/captacao/both/splits and legacy default generate correct commissions' as verification;
