-- Test only after the historical photo/share migrations and the new guard.
-- Every row belongs to synthetic users in a disposable PostgreSQL database.
grant select,insert,update,delete on public.property_photos to authenticated;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.property_photos'::regclass
     and conname='property_photos_tenant_property_fk') then
    raise exception 'Missing photo tenant/property FK';
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.property_share_links'::regclass
     and conname='property_share_links_tenant_property_fk') then
    raise exception 'Missing share-link tenant/property FK';
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.property_photos'::regclass
     and conname='property_photos_owned_storage_path_check') then
    raise exception 'Missing photo storage path constraint';
  end if;
end $$;

-- Check integrity constraints EVEN for a service/owner role that bypasses RLS.
do $$
begin
  begin
    insert into public.property_photos(user_id,property_id,storage_path)
    values ('11111111-1111-4111-8111-111111111111',
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg');
    raise exception 'FOREIGN_PHOTO_ACCEPTED';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.property_share_links(property_id,user_id,token)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            '11111111-1111-4111-8111-111111111111',
            'synthetic-bad-cross-user-link');
    raise exception 'FOREIGN_SHARE_LINK_ACCEPTED';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.property_photos(user_id,property_id,storage_path)
    values ('11111111-1111-4111-8111-111111111111',
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            '22222222-2222-4222-8222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg');
    raise exception 'FOREIGN_PHOTO_PATH_ACCEPTED';
  exception when check_violation then null;
  end;
  begin
    insert into public.property_photos(user_id,property_id,storage_path)
    values ('11111111-1111-4111-8111-111111111111',
            'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            '11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc/dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg');
    raise exception 'SAME_USER_OTHER_PROPERTY_PATH_ACCEPTED';
  exception when check_violation then null;
  end;
end $$;

-- Legitimate A session can register an owned photo and property share.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.property_photos(user_id,property_id,storage_path)
values (
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg'
);
insert into public.property_share_links(property_id,user_id,token)
values (
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '11111111-1111-4111-8111-111111111111',
 'synthetic-valid-share-token-a'
);
do $$
begin
  if (select count(*) from public.property_photos) <> 1 then
    raise exception 'Own photo is not visible under RLS';
  end if;
end $$;
commit;

-- B cannot read A's photos/links, insert into A's property, or forge identity.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$
begin
  if exists(select 1 from public.property_photos) or exists(select 1 from public.property_share_links) then
    raise exception 'Cross-account photo or share metadata visible';
  end if;
  begin
    insert into public.property_photos(user_id,property_id,storage_path)
    values (
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.png'
    );
    raise exception 'RLS_CROSS_ACCOUNT_INSERT_ACCEPTED';
  exception when insufficient_privilege then null;
  end;
end $$;
insert into public.property_photos(user_id,property_id,storage_path)
values (
 '22222222-2222-4222-8222-222222222222',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/ffffffff-ffff-4fff-8fff-ffffffffffff.webp'
);
commit;

do $$
begin
  if (select count(*) from public.property_photos) <> 2
     or (select count(*) from public.property_share_links) <> 1 then
    raise exception 'Unexpected fixture counts after ownership checks';
  end if;
end $$;
select 'PASS: photo paths, share links, tenant FK and RLS isolation' as verification;
