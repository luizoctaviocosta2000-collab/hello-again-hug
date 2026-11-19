-- DISPOSABLE DATABASE ONLY. Never run on staging or production.
\ir agent_autonomy_fixture.sql
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id), name text not null, phone text
);
create table public.properties (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id)
);
create table public.deals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id)
);
