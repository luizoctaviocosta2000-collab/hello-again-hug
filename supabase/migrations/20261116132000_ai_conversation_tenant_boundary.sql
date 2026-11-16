-- Staging security guard for chat messages belonging to user-owned conversations.
-- Requires historical 202610081500_imobfy_ai_conversations.sql.
-- Existing cross-user references, if any, abort the migration. Never reassign data silently.
-- No users or messages existed in imobfy-testes at preflight 2026-11-16.

create unique index if not exists ai_conversations_id_user_id_unique_idx
  on public.ai_conversations (id, user_id);

alter table public.ai_messages
  add constraint ai_messages_conversation_tenant_fk
  foreign key (conversation_id, user_id)
  references public.ai_conversations (id, user_id)
  on delete cascade;

-- Retire permissive legacy ALL policies only after the explicit per-operation
-- tenant policies from the historical migration have been established.
do $check_ai_policies$
begin
  if (select count(*) from pg_policies
      where schemaname='public' and tablename='ai_conversations'
        and policyname in ('ai_conversations_select_own','ai_conversations_insert_own',
          'ai_conversations_update_own','ai_conversations_delete_own')) <> 4
  or (select count(*) from pg_policies
      where schemaname='public' and tablename='ai_messages'
        and policyname in ('ai_messages_select_own','ai_messages_insert_own',
          'ai_messages_update_own','ai_messages_delete_own')) <> 4 then
     raise exception 'Expected owner-scoped AI policies missing';
  end if;
end $check_ai_policies$;

drop policy if exists ai_conversations_own_rows on public.ai_conversations;
drop policy if exists ai_messages_own_rows on public.ai_messages;

-- Pre-existing chat data and newly created messages must remain owner-scoped.
do $check_ai_guard$
begin
  if not (select relrowsecurity from pg_class where oid='public.ai_messages'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.ai_conversations'::regclass) then
    raise exception 'AI table RLS not enabled';
  end if;
  if exists (
    select 1 from public.ai_messages m
    left join public.ai_conversations c on c.id=m.conversation_id and c.user_id=m.user_id
    where c.id is null
  ) then
    raise exception 'AI messages contain foreign-owner links';
  end if;
end $check_ai_guard$;
