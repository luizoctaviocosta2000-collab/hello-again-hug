-- PostgreSQL lpad('1000',3,'0') TRUNCATES the input to '100'.
-- Preserve all digits after property code 999, while keeping 001..999 padded.
-- Apply immediately AFTER 202610150003_auto_generate_property_codes.sql.
-- Original historical migration remains unchanged; no existing property rows rewritten.
-- Only source SQL for the trigger function is replaced.
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
    new.property_code := 'IMB-' || lpad(next_number::text, greatest(3, length(next_number::text)), '0');
  elsif new.property_code is null or btrim(new.property_code) = '' then
    select coalesce(max(substring(property_code from '^IMB-([0-9]+)$')::integer), 0) + 1
      into next_number
    from public.properties
    where user_id = new.user_id and id <> new.id;
    new.property_code := 'IMB-' || lpad(next_number::text, greatest(3, length(next_number::text)), '0');
  else
    new.property_code := old.property_code;
  end if;

  return new;
end;
$$;

-- This is a trigger-only function; authenticated users don't need EXECUTE.
revoke all on function public.generate_property_code() from PUBLIC, anon, authenticated;
