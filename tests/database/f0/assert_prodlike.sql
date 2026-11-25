-- Production-like probe: an unknown legacy status must be reported, never
-- counted as active and never silently dropped.
do $u$
declare l jsonb;
begin
  perform f0test.expect('prodlike','A', '{
    "total_received":2750,
    "total_open":6000,
    "total_to_receive":5600,
    "total_forecast":1500,
    "total_cancelled":11100,
    "unknown_open_amount":250,
    "commission_count":14,
    "unknown_commission_count":1,
    "cancelled_commission_count":3,
    "null_amount_count":1}'::jsonb);

  select list into l from f0test.result where phase='prodlike' and who='A';
  if (select count(*) from jsonb_array_elements(l) e where e->>'status_group' = 'unknown') <> 1 then
    raise exception 'FAIL status desconhecido nao foi exposto na lista';
  end if;
  raise notice 'PASS status desconhecido: exposto em unknown_open_amount, fora dos totais ativos';
end $u$;
