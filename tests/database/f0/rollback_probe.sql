-- DB2 rollback probe. Runs inside a transaction and rolls back, so the
-- converted schema stays in place for any later step.
begin;

-- a write made after the conversion (value diverges from the generated formula)
update public.commissions
   set user_amount = user_amount + 100
 where vgv = 500000.00 and user_amount = 5460.00;

alter table public.commissions rename column gross_amount to gross_amount__plain_legacy;
alter table public.commissions rename column tax_amount   to tax_amount__plain_legacy;
alter table public.commissions rename column user_amount  to user_amount__plain_legacy;
alter table public.commissions rename column gross_amount__generated_legacy to gross_amount;
alter table public.commissions rename column tax_amount__generated_legacy   to tax_amount;
alter table public.commissions rename column user_amount__generated_legacy  to user_amount;

do $r$
declare bad bigint; div bigint; n bigint; div_id uuid;
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='commissions'
               and column_name in ('gross_amount','tax_amount','user_amount')
               and is_generated <> 'ALWAYS') then
    raise exception 'FAIL rollback nao restaurou as colunas geradas';
  end if;

  select id into div_id from f0test.before where user_amount = 5460.00;

  select count(*) into bad
  from f0test.before b
  join public.commissions c using (id)
  where c.id <> div_id
    and (c.gross_amount is distinct from b.gross_amount
      or c.tax_amount   is distinct from b.tax_amount
      or c.user_amount  is distinct from b.user_amount);
  if bad > 0 then raise exception 'FAIL rollback perdeu % linha(s) historica(s)', bad; end if;

  select count(*) into div
  from public.commissions
  where user_amount is distinct from user_amount__plain_legacy;
  if div <> 1 then
    raise exception 'FAIL divergencia da janela nao exposta (esperado 1, achou %)', div;
  end if;

  select count(*) into n from public.commissions;
  if n <> (select count(*) from f0test.before) then
    raise exception 'FAIL contagem mudou no rollback';
  end if;

  raise notice 'PASS rollback rename-only: geradas restauradas, historico intacto';
  raise notice 'PASS divergencia pos-conversao exposta para reconciliacao (% linha)', div;
end $r$;

rollback;
