-- Verify that an injected failure just before COMMIT removed EVERY prior step.
do $$
begin
  if to_regprocedure('public.register_manual_vgv(uuid,date,numeric,text,boolean)') is not null
     or to_regprocedure('public.register_direct_sale(uuid,uuid,numeric,timestamptz,text[],text)') is not null
     or to_regprocedure('public.validate_sale_proposal()') is not null then
    raise exception 'Atomic batch leaked a partial RPC after failure';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='sales'
      and column_name='deal_id' and is_nullable='NO'
  ) then
    raise exception 'Atomic batch left sales.deal_id nullable after failure';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='sales'
      and column_name='commission_sides'
  ) then
    raise exception 'Atomic batch left the new sales column after failure';
  end if;
  if not has_function_privilege('anon', 'public.example_privileged_trigger()', 'EXECUTE') then
    raise exception 'Atomic batch prematurely retained grant change after failure';
  end if;
end $$;
select 'PASS: late migration failure rolls back DDL, functions and grants' as result;
