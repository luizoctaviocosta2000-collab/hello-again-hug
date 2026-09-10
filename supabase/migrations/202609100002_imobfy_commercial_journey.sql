-- Imobfy Phase 2: commercial journey constraints + automatic closing foundation.

create unique index if not exists sales_one_per_deal_idx
  on public.sales(deal_id);

create or replace function public.validate_proposal_property()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.deal_properties dp
    where dp.deal_id = new.deal_id and dp.property_id = new.property_id and dp.user_id = auth.uid()
  ) then
    raise exception 'O imóvel da proposta precisa estar vinculado ao negócio.';
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_validate_property on public.proposals;
create trigger proposals_validate_property before insert or update on public.proposals
for each row execute procedure public.validate_proposal_property();

create or replace function public.sync_accepted_proposal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' then
    update public.deals
       set stage = 'negociacao', property_id = new.property_id,
           operation_value = new.amount, updated_at = now()
     where id = new.deal_id and user_id = new.user_id;

    update public.deal_properties
       set proposal_made = true, updated_at = now()
     where deal_id = new.deal_id and property_id = new.property_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_sync_accepted on public.proposals;
create trigger proposals_sync_accepted after insert or update on public.proposals
for each row execute procedure public.sync_accepted_proposal();

create or replace function public.sync_sale_closing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.deals
     set stage = 'fechado_ganho', property_id = new.property_id,
         operation_value = new.sale_value, updated_at = now()
   where id = new.deal_id and user_id = new.user_id;

  update public.deal_properties
     set sold = (property_id = new.property_id), updated_at = now()
   where deal_id = new.deal_id and user_id = new.user_id;

  update public.properties
     set status = 'sold', updated_at = now()
   where id = new.property_id and user_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists sales_sync_closing on public.sales;
create trigger sales_sync_closing after insert or update on public.sales
for each row execute procedure public.sync_sale_closing();

create or replace function public.log_sale_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activities(user_id, deal_id, property_id, activity_type, title, description, occurred_at)
  values (new.user_id, new.deal_id, new.property_id, 'sale', 'Negócio fechado', 'Venda registrada no Imobfy.', new.sold_at);
  return new;
end;
$$;

drop trigger if exists sales_log_activity on public.sales;
create trigger sales_log_activity after insert on public.sales
for each row execute procedure public.log_sale_activity();
