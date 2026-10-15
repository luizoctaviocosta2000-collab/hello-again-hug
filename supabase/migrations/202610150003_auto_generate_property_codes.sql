-- Backfill missing property codes in creation order, per user.
with existing_max as (
  select user_id, coalesce(max(substring(property_code from '^IMB-([0-9]+)$')::integer), 0) as max_code
  from public.properties
  group by user_id
),
missing as (
  select p.id, coalesce(m.max_code, 0) +
    row_number() over (partition by p.user_id order by p.created_at, p.id)::integer as next_code
  from public.properties p
  left join existing_max m on m.user_id = p.user_id
  where p.property_code is null or btrim(p.property_code) = ''
)
update public.properties p
set property_code = 'IMB-' || lpad(m.next_code::text, 3, '0')
from missing m
where p.id = m.id;

create or replace function public.generate_property_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  next_number integer;
begin
  if new.user_id is null then
    raise exception 'user_id is required to generate a property code';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if tg_op = 'INSERT' then
    select coalesce(max(substring(property_code from '^IMB-([0-9]+)$')::integer), 0) + 1
      into next_number
    from public.properties
    where user_id = new.user_id;
    new.property_code := 'IMB-' || lpad(next_number::text, 3, '0');
  elsif new.property_code is null or btrim(new.property_code) = '' then
    select coalesce(max(substring(property_code from '^IMB-([0-9]+)$')::integer), 0) + 1
      into next_number
    from public.properties
    where user_id = new.user_id and id <> new.id;
    new.property_code := 'IMB-' || lpad(next_number::text, 3, '0');
  else
    new.property_code := old.property_code;
  end if;

  return new;
end;
$$;

drop trigger if exists generate_property_code_before_write on public.properties;
create trigger generate_property_code_before_write
before insert or update of property_code, user_id
on public.properties
for each row execute function public.generate_property_code();

create unique index if not exists properties_user_property_code_unique
on public.properties (user_id, property_code)
where property_code is not null;

notify pgrst, 'reload schema';
