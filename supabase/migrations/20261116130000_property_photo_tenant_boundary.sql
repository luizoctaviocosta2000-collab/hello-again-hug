-- IMOBFY: close the property-photo tenant ownership boundary.
-- Deploy only AFTER 202610140001_property_photos.sql and
-- 202610150001_property_share_links.sql. Prepare this with the remaining
-- staging migrations so no vulnerable public-photo API is exposed in between.
--
-- Fail closed on mismatched existing metadata. Do not "repair" ownership,
-- delete rows, or change stored objects automatically.

-- A composite foreign key binds the property identity to its tenant,
-- including when a privileged server client bypasses RLS.
create unique index if not exists properties_id_user_id_photo_owner_unique
  on public.properties (id, user_id);

alter table public.property_photos
  add constraint property_photos_tenant_property_fk
  foreign key (property_id, user_id)
  references public.properties (id, user_id)
  on delete cascade;

alter table public.property_share_links
  add constraint property_share_links_tenant_property_fk
  foreign key (property_id, user_id)
  references public.properties (id, user_id)
  on delete cascade;

-- The current client uploader writes user UUID/property UUID/random UUID.ext.
-- Enforce that exact layout. No remote-storage object is signed here.
-- Existing nonconforming rows will block the migration for manual review.
alter table public.property_photos
  add constraint property_photos_owned_storage_path_check
  check (
    storage_path ~* (
      '^' || user_id::text || '/' || property_id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|jpeg|png|webp|avif)$'
    )
  );

-- Strengthen reads too. The composite FK already ensures the record
-- belongs to the same user as the property.
drop policy if exists "Users manage their property photos" on public.property_photos;
create policy "Users manage their property photos"
on public.property_photos for all to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.properties p
    where p.id = property_id and p.user_id = user_id
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.properties p
    where p.id = property_id and p.user_id = user_id
  )
);
