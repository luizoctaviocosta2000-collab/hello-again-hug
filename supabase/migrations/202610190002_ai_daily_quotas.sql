-- Per-user daily AI quotas. Limits are enforced in SQL, not supplied by the caller.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  feature text not null check (feature in ('chat', 'audio', 'photos')),
  used_count integer not null default 0 check (used_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date, feature)
);

alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;
grant usage on schema public to authenticated;

create or replace function public.consume_ai_quota(p_feature text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer;
  v_today date := (now() at time zone 'utc')::date;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_limit := case p_feature
    when 'chat' then 60
    when 'audio' then 30
    when 'photos' then 20
    else null
  end;

  if v_limit is null then
    raise exception 'Invalid AI feature' using errcode = '22023';
  end if;

  insert into public.ai_usage (user_id, usage_date, feature, used_count, updated_at)
  values (v_user_id, v_today, p_feature, 1, now())
  on conflict (user_id, usage_date, feature)
  do update set
    used_count = public.ai_usage.used_count + 1,
    updated_at = now()
  where public.ai_usage.used_count < v_limit
  returning used_count into v_count;

  return found;
end;
$$;

revoke all on function public.consume_ai_quota(text) from public, anon;
grant execute on function public.consume_ai_quota(text) to authenticated;
