alter table public.properties
  add column if not exists property_code text,
  add column if not exists purpose text not null default 'venda',
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists adress_complement text,
  add column if not exists zip_code text,
  add column if not exists suites integer,
  add column if not exists condominium_fee numeric,
  add column if not exists iptu_amount numeric,
  add column if not exists habite_se text,
  add column if not exists description text,
  add column if not exists origin text,
  add column if not exists capture_date timestamptz,
  add column if not exists exclusivity boolean not null default false,
  add column if not exists commercial_notes text;

create or replace function public.sync_property_address_complement_alias()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.address_complement is null and new.adress_complement is not null then
      new.address_complement := new.adress_complement;
    elsif new.adress_complement is null and new.address_complement is not null then
      new.adress_complement := new.address_complement;
    end if;
  else
    if new.address_complement is distinct from old.address_complement then
      new.adress_complement := new.address_complement;
    elsif new.adress_complement is distinct from old.adress_complement then
      new.address_complement := new.adress_complement;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_property_address_complement_alias on public.properties;
create trigger sync_property_address_complement_alias
before insert or update of address_complement, adress_complement
on public.properties
for each row execute function public.sync_property_address_complement_alias();

notify pgrst, 'reload schema';