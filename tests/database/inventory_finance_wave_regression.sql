-- Disposable PostgreSQL 17 integration tests after source steps 18–22 + PR57 correction.
-- No real users, emails, leads or business data are used in this suite.

-- Auth trigger is already wired in stage-17 fixture; new handle_new_user
-- must create both independent profiles.
insert into auth.users(id,email,raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111111111','user-a@example.invalid','{"name":"Corretor Alfa"}'::jsonb),
 ('22222222-2222-4222-8222-222222222222','user-b@example.invalid','{"full_name":"Corretora Beta"}'::jsonb);

do $$
begin
  if (select count(*) from public.profiles) <> 2 then
    raise exception 'Auth signup did not create both profiles';
  end if;
  if not exists(select 1 from public.profiles
    where id='11111111-1111-4111-8111-111111111111'
    and name='Corretor Alfa' and full_name='Corretor Alfa')
    or not exists(select 1 from public.profiles
    where id='22222222-2222-4222-8222-222222222222'
    and name='Corretora Beta' and full_name='Corretora Beta')
  then raise exception 'Signup profile names mismatch'; end if;
end $$;

-- Real client performs these writes under authenticated JWT.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.properties(id,user_id,title,address_complement)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
  'Apartamento Alfa','Fundos'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111',
  'Cobertura Alfa 2','Cobertura');
update public.properties set adress_complement='Bloco 2'
where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update public.profiles set full_name='Corretor Alfa Atualizado'
where id='11111111-1111-4111-8111-111111111111';
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
insert into public.properties(id,user_id,title)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Imóvel Beta');
do $$
begin
  if (select count(*) from public.properties) <> 1
    or (select count(*) from public.profiles) <> 1 then
    raise exception 'RLS exposes another user''s inventory or profile';
  end if;
end $$;
commit;

do $$
begin
  if (select count(*) from public.properties) <> 3 then
    raise exception 'Inventory fixture did not persist';
  end if;
  if (select property_code from public.properties
    where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 'IMB-001'
    or (select property_code from public.properties
    where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 'IMB-002'
    or (select property_code from public.properties
    where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') <> 'IMB-001' then
    raise exception 'Inventory property codes are not sequential and tenant-scoped';
  end if;
  if (select address_complement from public.properties
    where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 'Bloco 2' then
    raise exception 'Address-complement aliases not synchronized';
  end if;
  if (select name from public.profiles
    where id='11111111-1111-4111-8111-111111111111') <> 'Corretor Alfa Atualizado' then
    raise exception 'Profile name/full_name sync failed';
  end if;
end $$;

-- Capture and accepted-proposal scenario are fully synthetic.
insert into public.captures(id,user_id,property_id,status,commission_pct)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active',20);
insert into public.deals(id,user_id,property_id,status,property_value,sale_value,notes,sides)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','open',500000,500000,
 'approved-deal-scenario',array['sale']::text[]);

-- Closing without an accepted proposal must fail closed.
begin;
do $$
begin
  begin
    update public.deals set status='closed'
    where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    raise exception 'DEAL_CLOSED_WITHOUT_ACCEPTED_PROPOSAL';
  exception when others then
    if SQLERRM <> 'Aceite uma proposta vinculada ao imóvel antes de fechar a venda.' then
      raise; end if;
  end;
end $$;
commit;

insert into public.proposals(id,user_id,deal_id,property_id,status,amount)
values ('ffffffff-ffff-4fff-8fff-ffffffffffff',
 '11111111-1111-4111-8111-111111111111',
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accepted',500000);

-- User A: direct side choices and approved deal closing.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.register_direct_sale(
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',500000,now(),array['sale']::text[],'direct-sale-only'
);
select public.register_direct_sale(
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',500000,now(),array['sale','capture']::text[],'direct-both'
);
select public.register_direct_sale(
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',500000,now(),array['sale_split']::text[],'direct-sale-meiada'
);
select public.register_direct_sale(
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',500000,now(),array['capture_split']::text[],'direct-capture-meiada'
);
update public.deals set status='closed'
 where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
commit;

do $$
declare item record; sales_count int; capture_count int; total numeric;
begin
  for item in select * from (values
    ('direct-sale-only',1,0,5460.00::numeric),
    ('direct-both',1,1,10920.00::numeric),
    ('direct-sale-meiada',1,0,2730.00::numeric),
    ('direct-capture-meiada',0,1,2730.00::numeric),
    ('approved-deal-scenario',1,0,5460.00::numeric)
  ) t(label,expected_sales,expected_capture,expected_total)
  loop
    select count(*) filter(where c.commission_type='venda'),
      count(*) filter(where c.commission_type='captacao'),
      coalesce(sum(c.user_amount),0)
      into sales_count,capture_count,total
    from public.sales s join public.commissions c on c.sale_id=s.id
    where s.notes=item.label;
    if sales_count <> item.expected_sales
      or capture_count <> item.expected_capture or total<>item.expected_total then
      raise exception 'Incorrect commission for %: venda %, captacao %, value %',
        item.label,sales_count,capture_count,total;
    end if;
  end loop;
  if (select count(*) from public.sales)<>5
    or (select count(*) from public.vgv_entries)<>5
    or (select count(*) from public.commissions)<>6 then
    raise exception 'Sale/commission/VGV totals wrong';
  end if;
  if (select count(*) from public.sales s
    where s.deal_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
      and s.proposal_id='ffffffff-ffff-4fff-8fff-ffffffffffff')<>1 then
    raise exception 'Deal closing did not bind the accepted proposal';
  end if;
end $$;

select 'PASS: tenant inventory codes, profile signup, proposal gating, commission sides and VGV' as result;

-- psql-only fixture. Always revert synthetic high-code seed.
\ir property_code_width_regression.sql
