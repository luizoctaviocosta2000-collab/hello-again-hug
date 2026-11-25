-- DB2 assertions: value + NULL preservation, nullability untouched, CHECK union.
do $p$
declare
  bad numeric;
  n   bigint;
begin
  -- 1) exact values, including NULL
  select count(*) into bad
  from f0test.before b
  join public.commissions c using (id)
  where c.gross_amount is distinct from b.gross_amount
     or c.tax_amount   is distinct from b.tax_amount
     or c.user_amount  is distinct from b.user_amount;
  if bad > 0 then raise exception 'FAIL preservacao: % linha(s) divergiram', bad; end if;
  raise notice 'PASS conversion preserves gross/tax/user with IS DISTINCT FROM (NULL-safe)';

  -- 2) expected business numbers, literal
  select count(*) into n from public.commissions
   where gross_amount = 30000.00 and tax_amount = 2700.00 and user_amount = 5460.00;
  if n <> 1 then raise exception 'FAIL esperado 1 linha 30000/2700/5460, achou %', n; end if;
  select count(*) into n from public.commissions
   where gross_amount = 0 and tax_amount = 0 and user_amount = 0;
  if n <> 1 then raise exception 'FAIL esperado 1 linha zerada'; end if;
  select count(*) into n from public.commissions
   where gross_amount = 6000.00 and tax_amount = 0 and user_amount = 600.00;
  if n <> 1 then raise exception 'FAIL esperado 1 linha 6000/0/600'; end if;
  select count(*) into n from public.commissions
   where gross_amount = 7407.41 and tax_amount = 703.70 and user_amount = 2234.34;
  if n <> 1 then raise exception 'FAIL arredondamento 7407.41/703.70/2234.34'; end if;
  raise notice 'PASS valores exatos: zero, fracionario e arredondamento';

  -- 3) NULL stayed NULL (never zeroed)
  select count(*) into n from public.commissions where user_amount is null;
  if n <> 1 then raise exception 'FAIL NULL de user_amount virou % valores', n; end if;
  if exists (select 1 from public.commissions where user_amount is null and gross_amount is null) then
    raise exception 'FAIL NULL propagou para gross_amount';
  end if;
  raise notice 'PASS NULL preservado como NULL (nenhuma coercao para zero)';

  -- 4) nullability and default untouched
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='commissions'
               and column_name in ('gross_amount','tax_amount','user_amount')
               and (is_nullable <> 'YES' or column_default is not null)) then
    raise exception 'FAIL nullability/default alterados nas colunas convertidas';
  end if;
  raise notice 'PASS colunas convertidas continuam anulaveis e sem default';

  -- 5) generated-ness
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='commissions'
               and column_name in ('gross_amount','tax_amount','user_amount')
               and is_generated <> 'NEVER') then
    raise exception 'FAIL colunas convertidas nao sao planas';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='commissions'
                   and column_name='net_amount' and is_generated='ALWAYS') then
    raise exception 'FAIL net_amount deveria continuar gerada';
  end if;
  raise notice 'PASS gross/tax/user planas; net_amount intocada';

  -- 6) legacy column still present and identical
  select count(*) into bad
  from f0test.before b
  join public.commissions c using (id)
  where c.gross_amount__generated_legacy is distinct from b.gross_amount
     or c.tax_amount__generated_legacy   is distinct from b.tax_amount
     or c.user_amount__generated_legacy  is distinct from b.user_amount;
  if bad > 0 then raise exception 'FAIL legacy divergiu em % linha(s)', bad; end if;
  raise notice 'PASS colunas __generated_legacy mantidas e identicas';
end $p$;

-- 7) status CHECK accepts the documented union and rejects anything else
do $s$
declare v text; n int := 0;
begin
  foreach v in array array['prevista','a_receber','recebida','cancelada',
                            'forecast','receivable','partially_received',
                            'received','cancelled','canceled'] loop
    insert into public.commissions(user_id, vgv, status)
    values ('99999999-9999-9999-9999-999999999999', 0, v);
    n := n + 1;
  end loop;
  raise notice 'PASS CHECK aceita os % valores do vocabulario unificado', n;
  delete from public.commissions
   where user_id='99999999-9999-9999-9999-999999999999' and vgv=0
     and status in ('prevista','a_receber','recebida','cancelada','forecast',
                    'receivable','partially_received','received','cancelled','canceled')
     and id not in (select id from f0test.before);

  begin
    insert into public.commissions(user_id, vgv, status)
    values ('99999999-9999-9999-9999-999999999999', 0, 'valor_invalido');
    raise exception 'FAIL CHECK aceitou valor invalido';
  exception when check_violation then
    raise notice 'PASS CHECK rejeita valor fora do vocabulario (SQLSTATE 23514)';
  end;
end $s$;
