-- Discardable PostgreSQL 17 fixture ONLY. Replays the original photo/share
-- migrations plus the new photo-ownership migration; never use on live Supabase.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema storage;

create table auth.users (
  id uuid primary key
);
create function auth.uid() returns uuid
  language sql stable
  as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;

create table public.properties (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  title text not null
);
alter table public.properties enable row level security;
create policy properties_own on public.properties for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Minimal implementations of the Storage objects used by the historical
-- migration. Not a replacement for real Supabase Storage integration.
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null
);
create function storage.foldername(p_path text) returns text[]
  language sql immutable as $$ select string_to_array(p_path, '/') $$;

grant usage on schema public, auth, storage to authenticated;
grant execute on function auth.uid() to authenticated;
grant select on public.properties to authenticated;
grant select on auth.users to authenticated;

insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
insert into public.properties(id,user_id,title) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Property A'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','Property C same owner'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Property B');

-- The application normally runs with Supabase default privileges.
grant select,insert,update,delete on public.properties to authenticated;
