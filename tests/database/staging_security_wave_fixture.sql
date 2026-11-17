-- Build only the objects present in staging step 13 but missing from the
-- smaller finance SQL regression fixture. No real Supabase accounts or data.
-- Run AFTER disposable 10-13 bundle and BEFORE staging security wave.
delete from public.captures;
delete from public.properties;
delete from public.profiles;

create table auth.users (
  id uuid primary key
);

create table public.deal_properties (
  deal_id uuid not null,
  property_id uuid not null,
  user_id uuid not null,
  unique (deal_id,property_id,user_id)
);
alter table public.deal_properties enable row level security;
-- The real stage-13 properties table has owner-scoped RLS; replicate it.
create policy properties_own_rows on public.properties for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Staging already has both tables, with legacy owner-scoped ALL policies.
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check(role in ('user','assistant','tool')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
create policy ai_conversations_own_rows on public.ai_conversations
  for all to public using (auth.uid() = user_id) with check(auth.uid() = user_id);
create policy ai_messages_own_rows on public.ai_messages
  for all to public using (auth.uid() = user_id) with check(auth.uid() = user_id);

create schema storage;
create table storage.buckets (
  id text primary key, name text not null,
  public boolean not null,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null
);
alter table storage.objects enable row level security;
create function storage.foldername(p_path text) returns text[]
  language sql immutable as $$ select string_to_array(p_path, '/') $$;

grant usage on schema public,auth,storage to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
grant select,insert,update,delete on public.deal_properties to authenticated;

select 'PASS: disposable staging-13-shaped AI/Storage/CRM schema prepared' as result;
