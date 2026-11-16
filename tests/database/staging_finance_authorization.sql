-- Authorization tests of the atomic stage 10–13 SQL bundle.
-- All IDs and records are synthetic; tests run in disposable PostgreSQL 17 only.
do $$
declare r record;
begin
  if to_regprocedure('public.register_manual_vgv(uuid,date,numeric,text,boolean)') is null
     or to_regprocedure('public.register_direct_sale(uuid,uuid,numeric,timestamptz,text[],text)') is null then
    raise exception 'Protected financial RPCs not created';
  end if;
  if has_function_privilege('anon', 'public.register_manual_vgv(uuid,date,numeric,text,boolean)', 'EXECUTE')
     or has_function_privilege('anon', 'public.register_direct_sale(uuid,uuid,numeric,timestamptz,text[],text)', 'EXECUTE') then
    raise exception 'Anonymous execution is still exposed';
  end if;
  if has_function_privilege('authenticated', 'public.example_privileged_trigger()', 'EXECUTE') then
    raise exception 'Privileged trigger still has authenticated EXECUTE';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='set_updated_at'
      and 'search_path=public'=any(p.proconfig)
  ) then
    raise exception 'search_path not fixed';
  end if;
end $$;

-- Anonymous callers must be denied even if they have a UUID parameter.
begin;
set local role anon;
do $$
begin
  perform public.register_manual_vgv(
    '22222222-2222-4222-8222-222222222222', '2026-11-01', 500000
  );
  raise exception 'Anonymous invocation unexpectedly succeeded';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.register_direct_sale(
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 500000, now()
  );
  raise exception 'Anonymous direct sale unexpectedly succeeded';
exception when insufficient_privilege then null;
end $$;
rollback;

-- A signed-in user cannot impersonate another user ID in SECURITY DEFINER RPCs.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$
begin
  perform public.register_manual_vgv(
    '22222222-2222-4222-8222-222222222222', '2026-11-01', 500000
  );
  raise exception 'Manual VGV impersonation unexpectedly succeeded';
exception when others then
  if SQLERRM <> 'Usuário não autorizado' then raise; end if;
end $$;
do $$
begin
  perform public.register_direct_sale(
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 500000, now()
  );
  raise exception 'Direct-sale impersonation unexpectedly succeeded';
exception when others then
  if SQLERRM <> 'Usuário não autorizado' then raise; end if;
end $$;
do $$
begin
  perform public.register_direct_sale(
    '11111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 500000, now()
  );
  raise exception 'Foreign-property direct sale unexpectedly succeeded';
exception when others then
  if SQLERRM <> 'Imóvel não encontrado no seu estoque' then raise; end if;
end $$;
commit;

-- Positive authorized calls must still work and preserve commission precision.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select public.register_manual_vgv(
  '11111111-1111-4111-8111-111111111111', '2026-11-01', 500000,
  'venda', false
);
select public.register_direct_sale(
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  500000, now(), array['sale']::text[], 'Synthetic fixture'
);
commit;

-- Check results as the fixture/database owner, not the impersonated role.
do $$
begin
  if (select count(*) from public.vgv_entries where user_id =
    '11111111-1111-4111-8111-111111111111') <> 1
    or (select count(*) from public.commissions where user_id =
    '11111111-1111-4111-8111-111111111111') <> 1
    or (select count(*) from public.sales where user_id =
    '11111111-1111-4111-8111-111111111111') <> 1 then
    raise exception 'Authorized path failed to create expected entries';
  end if;
  if (select count(*) from public.vgv_entries where user_id =
    '22222222-2222-4222-8222-222222222222') <> 0
    or (select count(*) from public.commissions where user_id =
    '22222222-2222-4222-8222-222222222222') <> 0
    or (select count(*) from public.sales where user_id =
    '22222222-2222-4222-8222-222222222222') <> 0 then
    raise exception 'Cross-account write detected';
  end if;
  if (select user_amount from public.commissions limit 1) <> 5460.00 then
    raise exception 'Commission mismatch for synthetic 500000 VGV';
  end if;
end $$;

select 'PASS: anonymous and cross-account calls blocked; own-account financial RPCs work' as result;
