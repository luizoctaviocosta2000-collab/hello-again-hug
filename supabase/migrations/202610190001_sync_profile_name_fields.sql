-- Keep the legacy profile name and the newer full_name field synchronized.
alter table public.profiles
  add column if not exists full_name text;

update public.profiles
set full_name = nullif(btrim(name), '')
where full_name is null or btrim(full_name) = '';

update public.profiles
set name = nullif(btrim(full_name), '')
where (name is null or btrim(name) = '')
  and full_name is not null
  and btrim(full_name) <> '';

create or replace function public.sync_profile_names()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.name := coalesce(nullif(btrim(new.name), ''), nullif(btrim(new.full_name), ''), 'Corretor');
    new.full_name := coalesce(nullif(btrim(new.full_name), ''), new.name);
  else
    if new.name is distinct from old.name and new.full_name is not distinct from old.full_name then
      new.full_name := new.name;
    elsif new.full_name is distinct from old.full_name and new.name is not distinct from old.name then
      new.name := new.full_name;
    else
      new.name := coalesce(nullif(btrim(new.name), ''), nullif(btrim(new.full_name), ''), old.name, 'Corretor');
      new.full_name := coalesce(nullif(btrim(new.full_name), ''), new.name);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_names on public.profiles;
create trigger profiles_sync_names
before insert or update of name, full_name on public.profiles
for each row execute function public.sync_profile_names();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Corretor'
  );

  insert into public.profiles (id, name, full_name, email)
  values (new.id, v_name, v_name, new.email)
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;
