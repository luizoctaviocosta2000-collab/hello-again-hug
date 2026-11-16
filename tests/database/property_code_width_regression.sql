-- Regress the property-code limit without creating 1,000 customer records.
-- This is a disposable PostgreSQL test; temporarily seed an existing valid
-- code IMB-999 and make one authenticated-equivalent insertion.
BEGIN;

do $$
begin
  if lpad('1000',3,'0') <> '100' then
    raise exception 'PostgreSQL lpad truncation assumption changed';
  end if;
end $$;

-- Simulate a legacy user already having 999 properties, with one preexisting
-- max code. The trigger is temporarily disabled solely for this synthetic seed.
alter table public.properties disable trigger generate_property_code_before_write;
update public.properties set property_code='IMB-999'
where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
alter table public.properties enable trigger generate_property_code_before_write;

insert into public.properties(id,user_id,title)
values (
  '99999999-9999-4999-8999-999999999999',
  '11111111-1111-4111-8111-111111111111',
  'Synthetic thousandth listing'
);

do $$
begin
  if (select property_code from public.properties
      where id='99999999-9999-4999-8999-999999999999') <> 'IMB-1000'
  then
    raise exception 'Inventory property code lost digits at 1000';
  end if;
  if (select count(*) from public.properties
      where user_id='11111111-1111-4111-8111-111111111111'
      and property_code in ('IMB-999','IMB-1000')) <> 2
  then
    raise exception 'Property-code 999/1000 uniqueness/continuity mismatch';
  end if;
end $$;
ROLLBACK;

select 'PASS: codes 999 and 1000 preserve width; state reverted' as result;
