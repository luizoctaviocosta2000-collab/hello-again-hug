-- Positive and negative ownership checks with disposable identities in
-- PostgreSQL. This file does not create real Supabase Auth accounts.
grant select,insert,update,delete on public.ai_conversations, public.ai_messages
  to authenticated;
grant select,insert,update,delete on public.properties to authenticated;
grant select on auth.users to authenticated;

insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
insert into public.properties(id,user_id,title) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111','Property A'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '11111111-1111-4111-8111-111111111111','Property C'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222','Property B');
insert into public.ai_conversations(id,user_id,title) values
 ('aaaaaaaa-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Chat A'),
 ('bbbbbbbb-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','Chat B');

-- FK ownership integrity must hold even when RLS is bypassed by owner role.
do $$
begin
  begin
    insert into public.ai_messages(user_id,conversation_id,role,content)
    values(
      '11111111-1111-4111-8111-111111111111',
      'bbbbbbbb-2222-4222-8222-222222222222',
      'user','cross tenant should be rejected'
    );
    raise exception 'SECURITY_BYPASS_AI_FK';
  exception when foreign_key_violation then null;
  end;
end $$;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
begin
  if (select count(*) from public.ai_conversations) <> 1 then
     raise exception 'AI conversation cross-tenant visibility';
  end if;
end $$;
insert into public.ai_messages(user_id,conversation_id,role,content)
values(
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-1111-4111-8111-111111111111',
 'user','own chat text'
);
do $$
begin
  if (select count(*) from public.ai_messages) <> 1 then
    raise exception 'Legitimate AI message not visible';
  end if;
  begin
    insert into public.ai_messages(user_id,conversation_id,role,content)
    values(
      '11111111-1111-4111-8111-111111111111',
      'bbbbbbbb-2222-4222-8222-222222222222',
      'user','must not associate with B conversation'
    );
    raise exception 'SECURITY_BYPASS_AI_CONVERSATION';
  exception when foreign_key_violation then null;
  end;
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$
begin
  if (select count(*) from public.ai_conversations) <> 1
      or exists (select 1 from public.ai_messages) then
    raise exception 'AI conversation/messages visible across tenants';
  end if;
end $$;
commit;

do $$
begin
  if exists(select 1 from pg_policies
    where schemaname='public' and tablename in('ai_messages','ai_conversations')
    and policyname in ('ai_messages_own_rows','ai_conversations_own_rows')) then
    raise exception 'Legacy overlapping RLS policies still exist';
  end if;
  if (select count(*) from public.ai_messages) <> 1 then
    raise exception 'Expected one synthetic authorized AI message';
  end if;
end $$;
select 'PASS: AI conversation/message FK and own-user policies reject cross-account inserts and reads' as result;
