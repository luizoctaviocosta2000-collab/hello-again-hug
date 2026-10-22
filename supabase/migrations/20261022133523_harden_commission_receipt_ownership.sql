-- Reviewed against production metadata on 2026-10-22.
-- Deploy only after explicit approval; no existing financial amounts are changed.
begin;
set local lock_timeout = '5s';

-- Validation fails closed if legacy cross-owner links exist. Never repair them here.
alter table public.commissions
  add constraint commissions_id_user_id_key unique (id, user_id);
alter table public.commission_receipts
  add constraint commission_receipts_commission_owner_fkey
  foreign key (commission_id, user_id)
  references public.commissions (id, user_id) on delete cascade;
alter table public.commission_receipts
  drop constraint if exists commission_receipts_commission_id_fkey;

create or replace function public.validate_commission_receipt_amount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  commission_amount numeric;
  already_received numeric;
begin
  -- DELETE also serializes with inserts/updates. Cascading parent deletion is valid.
  if tg_op = 'DELETE' then
    perform 1 from public.commissions
    where id = old.commission_id and user_id = old.user_id
    for update;
    return old;
  end if;

  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'Recebimento não autorizado';
  end if;
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.commission_id is distinct from old.commission_id
       or new.user_id is distinct from old.user_id then
      raise exception using errcode = '23514', message = 'O vínculo do recebimento não pode ser alterado';
    end if;
  end if;

  -- Ownership is checked before reading any balance; serialize before summing.
  select user_amount into commission_amount
  from public.commissions
  where id = new.commission_id and user_id = new.user_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Recebimento não autorizado';
  end if;
  if new.amount is null or new.amount <= 0
     or new.amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = '23514', message = 'O recebimento deve ser maior que zero e finito';
  end if;
  if commission_amount is null or commission_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = '23514', message = 'A comissão possui valor inválido';
  end if;
  select coalesce(sum(amount), 0) into already_received
  from public.commission_receipts
  where commission_id = new.commission_id and user_id = new.user_id
    and id <> new.id;
  if already_received + new.amount > commission_amount then
    raise exception using errcode = '23514', message = 'O recebimento ultrapassa o valor restante da comissão';
  end if;
  return new;
end;
$$;

create or replace function public.sync_commission_receipt_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  target_user uuid;
  total_received numeric;
  commission_amount numeric;
begin
  if tg_op = 'DELETE' then
    target_id := old.commission_id;
    target_user := old.user_id;
  else
    target_id := new.commission_id;
    target_user := new.user_id;
  end if;
  select user_amount into commission_amount from public.commissions
  where id = target_id and user_id = target_user for update;
  -- Parent may already be gone during ON DELETE CASCADE.
  if not found then return coalesce(new, old); end if;
  select coalesce(sum(amount), 0) into total_received
  from public.commission_receipts
  where commission_id = target_id and user_id = target_user;
  update public.commissions
  set status = case
    when total_received >= commission_amount and commission_amount > 0 then 'received'
    when total_received > 0 then 'partially_received'
    else 'receivable'
  end,
  received_at = case
    when total_received >= commission_amount and commission_amount > 0
    then coalesce(received_at, now()) else null end
  where id = target_id and user_id = target_user;
  return coalesce(new, old);
end;
$$;

-- Normalize the historical repository trigger and the live trigger to one path.
drop trigger if exists commission_receipts_refresh_status on public.commission_receipts;
drop trigger if exists commission_receipt_status_trigger on public.commission_receipts;
drop trigger if exists validate_commission_receipt_amount_trigger on public.commission_receipts;
create trigger validate_commission_receipt_amount_trigger
  before insert or update or delete on public.commission_receipts
  for each row execute function public.validate_commission_receipt_amount();
create trigger commission_receipt_status_trigger
  after insert or update or delete on public.commission_receipts
  for each row execute function public.sync_commission_receipt_status();

-- Trigger execution does not require exposing these functions as RPCs.
revoke all on function public.validate_commission_receipt_amount() from public, anon, authenticated;
revoke all on function public.sync_commission_receipt_status() from public, anon, authenticated;
commit;
