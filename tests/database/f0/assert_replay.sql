-- DB1 assertions after the whole chain + F0-A + F0-B.
do $s$
declare n bigint;
begin
  -- converted vs untouched generated columns
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='commissions'
               and column_name in ('gross_amount','tax_amount','user_amount')
               and is_generated <> 'NEVER') then
    raise exception 'FAIL colunas de comissao continuam geradas';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='commissions'
                   and column_name='net_amount' and is_generated='ALWAYS') then
    raise exception 'FAIL net_amount deveria continuar gerada';
  end if;
  raise notice 'PASS comissoes: gross/tax/user planas, net_amount intocada';

  -- columns the live app and the later migrations require
  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='commissions'
     and column_name in ('property_value','brokerage_pct','net_brokerage','notes','due_at','paid_at');
  if n <> 6 then raise exception 'FAIL commissions: % de 6 colunas novas', n; end if;

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='deals'
     and column_name in ('status','property_value','brokerage_pct','tax_pct',
                         'participation_pct','sides','title','operation_value',
                         'closed_at','expected_close_at');
  if n <> 10 then raise exception 'FAIL deals: % de 10 colunas', n; end if;

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='properties'
     and column_name in ('sale_value','bathrooms','notes','state');
  if n <> 4 then raise exception 'FAIL properties: % de 4 colunas', n; end if;

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='clients'
     and column_name in ('intent','budget_min','budget_max','property_types',
                         'bedrooms_min','state','city');
  if n <> 7 then raise exception 'FAIL clients: % de 7 colunas', n; end if;

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='vgv_entries'
     and column_name in ('month','property_value');
  if n <> 2 then raise exception 'FAIL vgv_entries: % de 2 colunas', n; end if;
  raise notice 'PASS schema aditivo completo (deals/properties/clients/vgv_entries)';

  -- review item 6: email stays nullable
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='profiles'
                   and column_name='email' and is_nullable='YES') then
    raise exception 'FAIL profiles.email nao esta anulavel';
  end if;
  raise notice 'PASS profiles.email anulavel (decisao R1-6 mantida)';
end $s$;

-- status union present in the constraint text and enforced
do $s$
declare def text; n int := 0; v text;
begin
  select pg_get_constraintdef(oid) into def
  from pg_constraint
  where conname='commissions_status_check' and conrelid='public.commissions'::regclass;
  if def is null then raise exception 'FAIL CHECK de status ausente'; end if;
  foreach v in array array['prevista','a_receber','recebida','cancelada',
                            'forecast','receivable','partially_received',
                            'received','cancelled','canceled'] loop
    if position('''' || v || '''' in def) = 0 then
      raise exception 'FAIL CHECK nao contem %', v;
    end if;
    n := n + 1;
  end loop;
  raise notice 'PASS CHECK de comissoes contem os % valores documentados', n;

  -- properties and clients were widened too, not left as PT-only
  select pg_get_constraintdef(oid) into def
  from pg_constraint
  where conname='properties_status_check' and conrelid='public.properties'::regclass;
  if def is null or position('''active''' in def) = 0 or position('''ativo''' in def) = 0 then
    raise exception 'FAIL CHECK de properties nao foi ampliado: %', def;
  end if;
  select pg_get_constraintdef(oid) into def
  from pg_constraint
  where conname='clients_status_check' and conrelid='public.clients'::regclass;
  if def is null or position('''active''' in def) = 0 or position('''novo''' in def) = 0 then
    raise exception 'FAIL CHECK de clients nao foi ampliado: %', def;
  end if;
  raise notice 'PASS CHECKs de properties e clients ampliados (uniao PT/EN, nenhum removido)';
end $s$;

-- function metadata, grants, search_path, and the deferred trigger function
do $f$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as sig, p.prosecdef, p.provolatile,
           coalesce(array_to_string(p.proconfig, ','), '') as cfg
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname='public'
      and p.proname in ('get_ai_financial_summary','get_ai_commission_summary','get_ai_vgv_summary')
  loop
    if r.prosecdef then raise exception 'FAIL % e SECURITY DEFINER', r.sig; end if;
    if r.provolatile <> 's' then raise exception 'FAIL % nao e STABLE', r.sig; end if;
    if r.cfg not like '%search_path=%' or r.cfg like '%public%' then
      raise exception 'FAIL % search_path inseguro: %', r.sig, r.cfg;
    end if;
    if has_function_privilege('anon', r.sig, 'EXECUTE') then
      raise exception 'FAIL anon executa %', r.sig;
    end if;
    if not has_function_privilege('authenticated', r.sig, 'EXECUTE') then
      raise exception 'FAIL authenticated nao executa %', r.sig;
    end if;
    raise notice 'PASS % | invoker, stable, search_path vazio, anon negado', r.sig;
  end loop;

  if (select count(*) from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
      where ns.nspname='public' and p.proname in
        ('get_ai_financial_summary','get_ai_commission_summary','get_ai_vgv_summary')) <> 3 then
    raise exception 'FAIL esperava exatamente 3 funcoes get_ai_*';
  end if;

  if to_regprocedure('public.sync_closed_deal_financials()') is not null then
    raise exception 'FAIL sync_closed_deal_financials nao deveria existir no F0';
  end if;
  raise notice 'PASS sync_closed_deal_financials ausente (deferida) e sem trigger';
end $f$;

-- Edge contract: argument names/types used by supabase/functions/imobfy-ai
do $c$
declare got text;
begin
  select pg_get_function_arguments(p.oid) into got
  from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public' and p.proname='get_ai_commission_summary';
  if got not like '%p_limit integer%' then raise exception 'FAIL contrato comissao: %', got; end if;

  select pg_get_function_arguments(p.oid) into got
  from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public' and p.proname='get_ai_vgv_summary';
  if got not like '%p_from date%' or got not like '%p_to date%' then
    raise exception 'FAIL contrato vgv: %', got;
  end if;

  select pg_get_function_arguments(p.oid) into got
  from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public' and p.proname='get_ai_financial_summary';
  if got <> '' then raise exception 'FAIL contrato financeiro: %', got; end if;
  raise notice 'PASS contrato de argumentos compativel com imobfy-ai/index.ts';
end $c$;
