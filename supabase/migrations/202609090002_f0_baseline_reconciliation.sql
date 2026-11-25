-- =============================================================================
-- IMOBFY F0-A - baseline reconciliation (additive, reversible, NULL-preserving)
-- Intended path: supabase/migrations/202609090002_f0_baseline_reconciliation.sql
-- NOT APPLIED. Review only.
--
-- Guarantees
--   * no DROP COLUMN / DROP TABLE, no rewrite of applied history
--   * no NULL -> 0 coercion anywhere; no DEFAULT and no SET NOT NULL on the
--     converted commission columns (their nullability is left exactly as it
--     was, so production keeps NOT NULL and a generated column stays nullable)
--   * every converted value is verified with IS NOT DISTINCT FROM (NULL-safe)
--   * status CHECKs are only WIDENED, never dropped from a table that has one,
--     and never CREATED on a table that has none (production)
--   * status data is NOT rewritten here (that is R2, after a census)
-- =============================================================================
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- 0) fail closed if the legacy 20260908 baseline won --------------------------
do $guard$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles'
                   and column_name = 'default_commission_pct')
     or not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'properties'
                   and column_name = 'title') then
    raise exception
      'F0: baseline legado (20260908) detectado; esta reconciliacao exige 202609090001.';
  end if;
end $guard$;

-- 1) profiles ----------------------------------------------------------------
-- Decision R1-6: email stays nullable. name is backfilled from full_name; it is
-- NOT made NOT NULL because the chain's own later migration
-- (202610190001_sync_profile_name_fields.sql) deliberately leaves it nullable.
-- Production already declares it NOT NULL and this migration never alters it.
alter table public.profiles add column if not exists name text;
update public.profiles
   set name = full_name
 where name is null
   and full_name is not null;

-- 2) properties --------------------------------------------------------------
-- sale_value is a brand-new column on a chain-built database (never existed in
-- 202609090001), so the inline NOT NULL DEFAULT initialises it to zero the way
-- production already declares it. No historical value is overwritten.
alter table public.properties add column if not exists sale_value numeric(14,2) not null default 0;
alter table public.properties add column if not exists bathrooms integer;
alter table public.properties add column if not exists notes text;
alter table public.properties add column if not exists state text;
do $prop_check$
begin
  if exists (select 1 from pg_constraint
             where conname = 'properties_status_check'
               and conrelid = 'public.properties'::regclass) then
    alter table public.properties drop constraint properties_status_check;
    alter table public.properties add constraint properties_status_check
      check (status in ('ativo','reservado','vendido','inativo',
                        'active','reserved','sold','inactive'));
  end if;
end $prop_check$;

-- 3) clients (the live /clientes route writes these legacy columns) ----------
-- status union = canonical PT values + the three values the UI select can
-- write (active/inactive/qualified). No unobserved value is added.
alter table public.clients add column if not exists intent text;
alter table public.clients add column if not exists budget_min numeric(14,2);
alter table public.clients add column if not exists budget_max numeric(14,2);
-- brand-new array column on a chain-built database; production already declares
-- it NOT NULL DEFAULT '{}'.
alter table public.clients add column if not exists property_types text[] not null default '{}'::text[];
alter table public.clients add column if not exists bedrooms_min integer;
alter table public.clients add column if not exists state text;
alter table public.clients add column if not exists city text;
do $cli_check$
begin
  if exists (select 1 from pg_constraint
             where conname = 'clients_status_check'
               and conrelid = 'public.clients'::regclass) then
    alter table public.clients drop constraint clients_status_check;
    alter table public.clients add constraint clients_status_check
      check (status in ('novo','qualificado','negociando','cliente','inativo',
                        'active','inactive','qualified'));
  end if;
end $cli_check$;

-- 4) deals (needed by the closing triggers and by the dashboard) -------------
alter table public.deals add column if not exists status text not null default 'new';
alter table public.deals add column if not exists property_value numeric(14,2) not null default 0;
alter table public.deals add column if not exists brokerage_pct numeric(5,2) not null default 6;
alter table public.deals add column if not exists tax_pct numeric(5,2) not null default 9;
alter table public.deals add column if not exists participation_pct numeric(5,2) not null default 20;
alter table public.deals add column if not exists sides text[] not null default '{}'::text[];
alter table public.deals add column if not exists title text not null default 'Novo atendimento';
alter table public.deals add column if not exists operation_value numeric(14,2) not null default 0;
alter table public.deals add column if not exists closed_at timestamptz;
alter table public.deals add column if not exists expected_close_at timestamptz;

-- 5) commissions: value-preserving conversion, per column --------------------
-- Before/after snapshot for the NULL-safe checksum.
create temporary table f0_commissions_snapshot on commit drop as
select id,
       gross_amount, tax_amount, user_amount,
       pg_catalog.pg_typeof(gross_amount) as gross_type
from public.commissions;

-- 5a) rename only the columns that are still generated
do $rename$
declare c text;
begin
  foreach c in array array['gross_amount','tax_amount','user_amount'] loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'commissions'
                 and column_name = c and is_generated = 'ALWAYS') then
      execute format('alter table public.commissions rename column %I to %I',
                     c, c || '__generated_legacy');
    end if;
  end loop;
end $rename$;

-- 5b) add the plain columns (production already has them: no-op)
alter table public.commissions add column if not exists gross_amount numeric(14,2);
alter table public.commissions add column if not exists tax_amount numeric(14,2);
alter table public.commissions add column if not exists user_amount numeric(14,2);
alter table public.commissions add column if not exists net_brokerage numeric(14,2);
alter table public.commissions add column if not exists property_value numeric(14,2);
alter table public.commissions add column if not exists brokerage_pct numeric(5,2);
alter table public.commissions add column if not exists notes text;
alter table public.commissions add column if not exists due_at timestamptz;
alter table public.commissions add column if not exists paid_at timestamptz;

-- 5c) copy the legacy value verbatim, including NULL. Never overwrite a value
--     that the converted column already holds (idempotent re-run).
do $copy$
declare c text;
begin
  foreach c in array array['gross_amount','tax_amount','user_amount'] loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'commissions'
                 and column_name = c || '__generated_legacy') then
      execute format(
        'update public.commissions set %1$I = %1$I__generated_legacy where %1$I is null',
        c);
    end if;
  end loop;
end $copy$;

-- 5d) NULL-safe checksum: count, NULL census, per-value equality
do $verify$
declare
  c        text;
  n_now    bigint;
  n_before bigint;
  bad      bigint;
  null_now bigint;
  null_bef bigint;
begin
  select count(*) into n_before from pg_temp.f0_commissions_snapshot;
  select count(*) into n_now from public.commissions;
  if n_now <> n_before then
    raise exception 'F0: contagem de comissoes divergiu (% -> %)', n_before, n_now;
  end if;

  foreach c in array array['gross_amount','tax_amount','user_amount'] loop
    execute format(
      'select count(*) from pg_temp.f0_commissions_snapshot where %I is null', c)
      into null_bef;
    execute format(
      'select count(*) from public.commissions where %I is null', c)
      into null_now;
    if null_now <> null_bef then
      raise exception 'F0: contagem de NULL divergiu em % (% -> %)', c, null_bef, null_now;
    end if;

    execute format(
      'select count(*) from pg_temp.f0_commissions_snapshot s
         join public.commissions c using (id)
        where c.%1$I is distinct from s.%1$I', c)
      into bad;
    if bad > 0 then
      raise exception 'F0: % valor(es) divergiram em %; transacao abortada', bad, c;
    end if;
  end loop;
end $verify$;

-- 5e) status CHECK: widen the existing one. Never create one where none exists.
-- Union = every value written or read by repository code, plus the documented
-- cancellation aliases. Justification per value is in the F0-R2 report.
do $com_check$
begin
  if exists (select 1 from pg_constraint
             where conname = 'commissions_status_check'
               and conrelid = 'public.commissions'::regclass) then
    alter table public.commissions drop constraint commissions_status_check;
    alter table public.commissions add constraint commissions_status_check
      check (status in ('prevista','a_receber','recebida','cancelada',
                        'forecast','receivable','partially_received',
                        'received','cancelled','canceled'));
  end if;
end $com_check$;

-- Pendency (recorded, not executed here): gross_amount / tax_amount /
-- user_amount stay NULLABLE on a chain-built database because they were
-- generated (nullable) before. Production keeps its own NOT NULL because this
-- migration never alters nullability. Re-adding NOT NULL DEFAULT 0 requires a
-- census proving zero NULLs plus an explicit business rule; it is NOT F0.

-- 6) vgv_entries -------------------------------------------------------------
alter table public.vgv_entries add column if not exists month date;
alter table public.vgv_entries add column if not exists property_value numeric(14,2);
update public.vgv_entries
   set month = reference_month
 where month is null
   and reference_month is not null;
-- month stays nullable: production has rows where reference_month is NULL, and
-- inventing a date would be a data fabrication. Pendency recorded.

commit;
