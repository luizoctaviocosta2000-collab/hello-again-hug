-- Assertions for the captured indicators.
create or replace function f0test.expect(p_phase text, p_who text, p_expected jsonb)
returns void language plpgsql as $e$
declare
  got jsonb;
  k text;
  a numeric;
  b numeric;
begin
  select payload into got from f0test.result where phase = p_phase and who = p_who;
  if got is null then raise exception 'sem captura para % / %', p_phase, p_who; end if;
  for k in select jsonb_object_keys(p_expected) loop
    a := (got ->> k)::numeric;
    b := (p_expected ->> k)::numeric;
    if a is distinct from b then
      raise exception 'FAIL % / % : % = % (esperado %)', p_phase, p_who, k, a, b;
    end if;
  end loop;
end $e$;

do $a$
declare l jsonb; n bigint;
begin
  -- F0 phase MUST still undercount: this is the bug, not a fix.
  perform f0test.expect('f0','A', '{
    "total_received":2050,
    "total_to_receive":5600,
    "total_open":6000,
    "overdue_to_receive":2000,
    "commission_count":13,
    "open_commission_count":4,
    "received_commission_count":2}'::jsonb);
  raise notice 'BUG-REPRO F0: recebida/prevista/forecast invisiveis (total_received 2050, nao 2750)';

  select list into l from f0test.result where phase='f0' and who='A';
  if jsonb_array_length(l) <> 13 then raise exception 'FAIL F0 lista com % linhas', jsonb_array_length(l); end if;
  if (l -> 0) ? 'status_group' then raise exception 'FAIL F0 nao deveria expor status_group'; end if;
  if (select count(*) from jsonb_array_elements(l) e where e->>'status' = 'recebida') <> 2 then
    raise exception 'FAIL F0 nao retornou as 2 linhas recebida';
  end if;
  raise notice 'PASS F0 lista: 13 linhas, sem status_group, recebida presente mas nao contabilizada';

  -- R2 phase must be exact
  perform f0test.expect('r2','A', '{
    "total_received":2750,
    "total_to_receive":5600,
    "total_open":6000,
    "total_forecast":1500,
    "total_cancelled":11100,
    "unknown_open_amount":0,
    "overdue_to_receive":2000,
    "commission_count":13,
    "open_commission_count":4,
    "received_commission_count":4,
    "forecast_commission_count":2,
    "cancelled_commission_count":3,
    "unknown_commission_count":0,
    "null_amount_count":1,
    "inconsistent_received_count":1}'::jsonb);
  raise notice 'PASS R2: recebido 2750, previsto 1500, cancelado 11100, NULL 1';

  select list into l from f0test.result where phase='r2' and who='A';
  if jsonb_array_length(l) <> 13 then raise exception 'FAIL R2 lista com % linhas', jsonb_array_length(l); end if;

  select count(*) into n
  from (select e->>'status_group' g, count(*) c
        from jsonb_array_elements(l) e group by 1) s
  where (s.g, s.c) in (('forecast',2),('receivable',3),('partially_received',1),
                       ('received',4),('cancelled',3));
  if n <> 5 then raise exception 'FAIL distribuicao de status_group incorreta'; end if;
  raise notice 'PASS R2 grupos: forecast 2, receivable 3, partial 1, received 4, cancelled 3';

  -- tenant isolation
  perform f0test.expect('r2','B', '{
    "total_received":0,"total_open":5000,"total_to_receive":5000,
    "total_forecast":0,"total_cancelled":0,"commission_count":1}'::jsonb);
  select list into l from f0test.result where phase='r2' and who='B';
  if jsonb_array_length(l) <> 1 then raise exception 'FAIL B ve % comissoes', jsonb_array_length(l); end if;
  if (l->0->>'user_id') is not null then raise exception 'FAIL lista expoe user_id'; end if;
  if (l->0->>'commission_amount')::numeric <> 5000 then raise exception 'FAIL B nao ve a propria comissao'; end if;
  raise notice 'PASS isolamento: B ve 1 comissao (5000) e nenhum total de A';
end $a$;
