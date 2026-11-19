-- Additive, staging review first. Requires intelligence foundation.
-- No token storage, outbound messaging or generative worker.
create schema if not exists imobfy_private;
revoke all on schema imobfy_private from public, anon, authenticated;

create table imobfy_private.whatsapp_connections (
  phone_number_id text primary key check (phone_number_id ~ '^[0-9]{6,25}$'),
  waba_id text not null check (waba_id ~ '^[0-9]{6,25}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default false
);
create table imobfy_private.whatsapp_contacts (
  user_id uuid not null references auth.users(id) on delete cascade,
  wa_id text not null check (wa_id ~ '^[0-9]{8,15}$'),
  client_id uuid not null,
  opted_out boolean not null default false,
  last_inbound_at timestamptz,
  -- Inbound does not automatically grant marketing consent.
  marketing_consent_at timestamptz,
  primary key (user_id, wa_id),
  foreign key (client_id,user_id) references public.clients(id,user_id)
);
create table public.imobfy_whatsapp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null unique,
  phone_number_id text not null,
  message_id text not null,
  kind text not null check (kind in ('inbound','sent','delivered','read','failed')),
  occurred_at timestamptz not null,
  payload jsonb not null,
  processing_state text not null default 'received'
    check (processing_state in ('received','processed','needs_review')),
  created_at timestamptz not null default now()
);
alter table imobfy_private.whatsapp_connections enable row level security;
alter table imobfy_private.whatsapp_contacts enable row level security;
alter table public.imobfy_whatsapp_events enable row level security;
revoke all on imobfy_private.whatsapp_connections, imobfy_private.whatsapp_contacts,
  public.imobfy_whatsapp_events from public, anon, authenticated;
-- Raw payload stays backend-only. Users can inspect bounded event metadata.
grant select (id,user_id,event_key,phone_number_id,message_id,kind,occurred_at,processing_state,created_at)
  on public.imobfy_whatsapp_events to authenticated;
create policy whatsapp_events_owner on public.imobfy_whatsapp_events for select
  to authenticated using ((select auth.uid())=user_id);
create index whatsapp_events_owner_recent on public.imobfy_whatsapp_events(user_id,created_at desc);

alter table public.imobfy_attendance_messages
  drop constraint imobfy_attendance_messages_delivery_state_check;
alter table public.imobfy_attendance_messages add constraint imobfy_attendance_messages_delivery_state_check
  check (delivery_state='internal' or (source='whatsapp' and role='customer' and delivery_state='received'));

-- Existing owner RLS + composite property FK also govern this new permission.
grant update (property_id) on public.imobfy_attendance_threads to authenticated;

create function public.imobfy_accept_whatsapp_event(p_event jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid;
  event_id uuid;
  contact_id uuid;
  thread_id uuid;
  sender text;
  message_body text;
  message_time timestamptz;
  matches integer;
  opt_out boolean;
  handoff boolean;
begin
  -- Only service_role has EXECUTE. Mapping is administrator-provisioned after
  -- official WABA/phone ownership verification, not browser-editable.
  select user_id into owner_id from imobfy_private.whatsapp_connections
    where phone_number_id=p_event->>'phone_number_id'
      and waba_id=p_event->>'waba_id' and enabled;
  if owner_id is null then raise exception 'WHATSAPP_CONNECTION_NOT_ENABLED'; end if;
  if p_event->>'event_key' is distinct from
    (p_event->>'phone_number_id')||':'||(p_event->>'message_id')||':'||(p_event->>'kind')
    or length(p_event->>'event_key') > 240
    or (p_event->>'message_id') !~ '^wamid\.[A-Za-z0-9+/=_-]{1,174}$'
    then raise exception 'WHATSAPP_INVALID_EVENT'; end if;
  message_time := (p_event->>'occurred_at')::timestamptz;
  insert into public.imobfy_whatsapp_events(user_id,event_key,phone_number_id,message_id,kind,occurred_at,payload)
    values(owner_id,p_event->>'event_key',p_event->>'phone_number_id',p_event->>'message_id',
      p_event->>'kind',message_time,p_event->'payload')
    on conflict(event_key) do nothing returning id into event_id;
  if event_id is null then return; end if;
  if p_event->>'kind' <> 'inbound' then
    -- Append-only receipts, including out-of-order statuses. No inferred
    -- "delivered" state from API acceptance, no automatic retry on failure.
    update public.imobfy_whatsapp_events set processing_state='processed' where id=event_id;
    return;
  end if;
  sender := p_event->'payload'->>'from';
  if sender is null or sender !~ '^[0-9]{8,15}$' then raise exception 'WHATSAPP_INVALID_SENDER'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':'||sender,0));
  select client_id into contact_id from imobfy_private.whatsapp_contacts
    where user_id=owner_id and wa_id=sender;
  if contact_id is null then
    select count(*), (array_agg(id))[1] into matches,contact_id from public.clients
      where user_id=owner_id and regexp_replace(coalesce(phone,''),'[^0-9]','','g')=sender;
    -- Ambiguous or non-canonical national numbers need human reconciliation,
    -- rather than silently creating a duplicate contact.
    if matches > 1 or (matches=0 and exists (
      select 1 from public.clients where user_id=owner_id and
        right(regexp_replace(coalesce(phone,''),'[^0-9]','','g'),10)=right(sender,10)
    )) then
      update public.imobfy_whatsapp_events set processing_state='needs_review' where id=event_id;
      return;
    end if;
    if matches=0 then
      insert into public.clients(user_id,name,phone)
        values(owner_id,'Contato WhatsApp',sender) returning id into contact_id;
    end if;
    insert into imobfy_private.whatsapp_contacts(user_id,wa_id,client_id)
      values(owner_id,sender,contact_id);
  end if;
  message_body := p_event->'payload'->'text'->>'body';
  handoff := p_event->'payload'->>'type' is distinct from 'text';
  if handoff then message_body := '[Mensagem não textual recebida; revisão humana necessária]'; end if;
  if message_body is null or length(btrim(message_body))=0 or length(message_body)>4000 then
    message_body := '[Mensagem fora do limite de exibição; revisão humana necessária]';
    handoff := true;
  end if;
  opt_out := lower(btrim(message_body)) ~ '^(sair|parar|stop|cancelar|remover|descadastrar)$';
  handoff := handoff or opt_out or lower(message_body) ~ '(corretor|humano|atendente|proposta|desconto|negoci|reclama)';
  update imobfy_private.whatsapp_contacts
    set opted_out=opted_out or opt_out,
        last_inbound_at=greatest(last_inbound_at,message_time)
    where user_id=owner_id and wa_id=sender;
  insert into public.imobfy_attendance_threads(user_id,client_id,channel,external_thread_key,status,automation_mode)
    values(owner_id,contact_id,'whatsapp',(p_event->>'phone_number_id')||':'||sender,
      case when handoff then 'handoff' else 'open' end,'paused')
    on conflict(user_id,channel,external_thread_key) do update
      set updated_at=greatest(public.imobfy_attendance_threads.updated_at,message_time),
          status=case when handoff then 'handoff' else public.imobfy_attendance_threads.status end
    returning id into thread_id;
  insert into public.imobfy_attendance_messages(user_id,thread_id,role,body,source,external_message_key,delivery_state,created_at)
    values(owner_id,thread_id,'customer',message_body,'whatsapp',
      (p_event->>'phone_number_id')||':'||(p_event->>'message_id'),'received',message_time);
  update public.imobfy_whatsapp_events set processing_state='processed' where id=event_id;
end $$;
revoke all on function public.imobfy_accept_whatsapp_event(jsonb) from public,anon,authenticated;
grant execute on function public.imobfy_accept_whatsapp_event(jsonb) to service_role;
