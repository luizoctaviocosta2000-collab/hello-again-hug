-- Galeria de fotos dos imóveis e políticas por usuário.
create table if not exists public.property_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text not null,
  category text not null default 'outros',
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  unique (property_id, storage_path)
);
create index if not exists property_photos_user_property_order_idx
  on public.property_photos(user_id, property_id, sort_order);
alter table public.property_photos enable row level security;
drop policy if exists "Users manage their property photos" on public.property_photos;
create policy "Users manage their property photos" on public.property_photos
  for all to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (
    select 1 from public.properties p where p.id = property_id and p.user_id = auth.uid()
  ));
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-photos', 'property-photos', false, 12582912, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;
drop policy if exists "Users access own property photo files" on storage.objects;
create policy "Users access own property photo files" on storage.objects
for all to authenticated
using (bucket_id = 'property-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'property-photos' and (storage.foldername(name))[1] = auth.uid()::text);
