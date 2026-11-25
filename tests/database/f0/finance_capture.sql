-- Capture the two AI read functions as each user, for the given phase.
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', false);
set role authenticated;
insert into f0test.result(phase, who, payload, list)
values (:'phase', 'A', public.get_ai_financial_summary(), public.get_ai_commission_summary(100))
on conflict (phase, who) do update
  set payload = excluded.payload, list = excluded.list;
reset role;

select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444', false);
set role authenticated;
insert into f0test.result(phase, who, payload, list)
values (:'phase', 'B', public.get_ai_financial_summary(), public.get_ai_commission_summary(100))
on conflict (phase, who) do update
  set payload = excluded.payload, list = excluded.list;
reset role;

select phase, who, payload from f0test.result where phase = :'phase' order by who;
