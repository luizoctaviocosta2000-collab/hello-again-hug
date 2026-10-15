create table if not exists public.property_share_links (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id)
);

create index if not exists property_share_links_user_id_idx on public.property_share_links(user_id);
create index if not exists property_share_links_active_token_idx on public.property_share_links(token) where is_active = true;
alter table public.property_share_links enable row level security;

drop policy if exists "Users can view their property share links" on public.property_share_links;
create policy "Users can view their property share links" on public.property_share_links for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create their property share links" on public.property_share_links;
create policy "Users can create their property share links" on public.property_share_links for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.properties p where p.id = property_id and p.user_id = auth.uid()));
drop policy if exists "Users can update their property share links" on public.property_share_links;
create policy "Users can update their property share links" on public.property_share_links for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and exists (select 1 from public.properties p where p.id = property_id and p.user_id = auth.uid()));
drop policy if exists "Users can delete their property share links" on public.property_share_links;
create policy "Users can delete their property share links" on public.property_share_links for delete to authenticated using (auth.uid() = user_id);
revoke all on public.property_share_links from anon;
grant select, insert, update, delete on public.property_share_links to authenticated;