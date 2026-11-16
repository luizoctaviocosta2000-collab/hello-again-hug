-- Real Supabase Storage ownership is exercised later via the HTTP API.
-- This disposable PostgreSQL 17 test only validates the SQL policy predicates.
grant select,insert,update,delete on storage.objects to authenticated;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into storage.objects(bucket_id,name)
values (
 'property-photos',
 '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg'
);
do $$
begin
  if (select count(*) from storage.objects where bucket_id='property-photos') <> 1 then
    raise exception 'Storage policy blocks legitimate user upload';
  end if;
  begin
    insert into storage.objects(bucket_id,name)
    values('property-photos',
      '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.png');
    raise exception 'STORAGE_CROSS_USER_BYPASS';
  exception when insufficient_privilege then null;
  end;
end $$;
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$
begin
  if exists(select 1 from storage.objects where bucket_id='property-photos') then
    raise exception 'Storage cross-user object readable';
  end if;
end $$;
commit;

select 'PASS: Storage RLS denies cross-tenant access to metadata and upload' as result;
