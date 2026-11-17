#!/usr/bin/env python3
"""Compose reviewed historical IMOBFY stages 23–25 for isolated staging.

Read-only generator: never connects to a database.
  python3 scripts/staging/build_final_staging_wave.py --check
  python3 scripts/staging/build_final_staging_wave.py > /tmp/stage23_25.sql
  python3 scripts/staging/build_final_staging_wave.py --managed > /tmp/stage23_25_managed.sql

--managed omits outer transaction commands because Supabase manages the
transaction for apply_migration. NEVER run this against production.
"""
from __future__ import annotations

import argparse
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = (
    "supabase/migrations/202610190002_ai_daily_quotas.sql",
    "supabase/migrations/20261022133523_harden_commission_receipt_ownership.sql",
    "supabase/migrations/20261022182211_atomic_visit_journey.sql",
)
TXN = re.compile(r"(?im)^\\s*(BEGIN|COMMIT|ROLLBACK|START TRANSACTION)\\s*;\\s*$")

PREFLIGHT = r"""
do $imobfy_final_preflight$
begin
  if to_regclass('public.profiles') is null
    or to_regclass('public.properties') is null
    or to_regclass('public.commissions') is null
    or to_regclass('public.commission_receipts') is null
    or to_regclass('public.visits') is null
    or to_regclass('public.deal_properties') is null
    or to_regclass('public.visit_properties') is null
    or to_regprocedure('public.generate_sale_commission()') is null
    or to_regprocedure('public.generate_property_code()') is null
    or to_regclass('public.ai_usage') is not null
    or to_regprocedure('public.consume_ai_quota(text)') is not null
    or to_regprocedure('public.validate_commission_receipt_amount()') is not null
    or to_regprocedure('public.save_visit_journey(uuid,uuid,uuid,timestamptz,timestamptz,uuid[],text,text)') is not null
    or exists(select 1 from auth.users)
    or exists(select 1 from public.commissions)
    or exists(select 1 from public.commission_receipts)
    or exists(select 1 from public.visits)
    or exists(select 1 from public.sales)
    or exists(select 1 from public.deals)
    or exists(select 1 from public.properties)
  then
    raise exception 'Stage 22 clean staging baseline not met; final wave not applied';
  end if;
  if not exists(select 1 from pg_constraint
      where conrelid='public.commission_receipts'::regclass
        and conname='commission_receipts_commission_id_fkey')
     or exists(select 1 from pg_trigger
      where tgrelid='public.deals'::regclass
        and tgname='deal_closing_stage_guard' and not tgisinternal) then
    raise exception 'Unexpected legacy receipt FK or visit stage guard';
  end if;
end
$imobfy_final_preflight$;
"""

FINAL_GUARD = r"""
-- The definer quota function does not rely on an attacker-controlled schema.
alter function public.consume_ai_quota(text) set search_path = '';

do $imobfy_final_guard$
declare
  fn oid;
begin
  if to_regclass('public.ai_usage') is null
    or to_regprocedure('public.consume_ai_quota(text)') is null
    or to_regprocedure('public.validate_commission_receipt_amount()') is null
    or to_regprocedure('public.sync_commission_receipt_status()') is null
    or to_regprocedure('public.save_visit_journey(uuid,uuid,uuid,timestamptz,timestamptz,uuid[],text,text)') is null
    or to_regprocedure('public.finish_visit_journey(uuid,text,uuid[])') is null
  then raise exception 'Missing quota, receipt or visit objects'; end if;

  if not (select relrowsecurity from pg_class where oid='public.ai_usage'::regclass)
    or has_table_privilege('anon','public.ai_usage','SELECT')
    or has_table_privilege('authenticated','public.ai_usage','SELECT')
    or has_function_privilege('anon','public.consume_ai_quota(text)','EXECUTE')
    or not has_function_privilege('authenticated','public.consume_ai_quota(text)','EXECUTE')
    or not (select prosecdef from pg_proc
       where oid='public.consume_ai_quota(text)'::regprocedure)
  then raise exception 'Quota exposure or privilege mismatch'; end if;

  if not exists(select 1 from pg_constraint
       where conrelid='public.commission_receipts'::regclass
         and conname='commission_receipts_commission_owner_fkey')
    or exists(select 1 from pg_constraint
       where conrelid='public.commission_receipts'::regclass
         and conname='commission_receipts_commission_id_fkey')
    or (select count(*) from pg_trigger
        where tgrelid='public.commission_receipts'::regclass
          and tgname in ('validate_commission_receipt_amount_trigger',
                         'commission_receipt_status_trigger')
          and not tgisinternal) <> 2
  then raise exception 'Receipt security/trigger mismatch'; end if;

  foreach fn in array array[
     to_regprocedure('public.validate_commission_receipt_amount()'),
     to_regprocedure('public.sync_commission_receipt_status()'),
     to_regprocedure('public.guard_deal_closing_stage()')
  ] loop
    if fn is null or has_function_privilege('anon',fn,'EXECUTE')
       or has_function_privilege('authenticated',fn,'EXECUTE') then
      raise exception 'Internal trigger exposed to API: %', fn;
    end if;
  end loop;

  if has_function_privilege('anon',
      'public.save_visit_journey(uuid,uuid,uuid,timestamptz,timestamptz,uuid[],text,text)','EXECUTE')
    or has_function_privilege('anon','public.finish_visit_journey(uuid,text,uuid[])','EXECUTE')
    or not has_function_privilege('authenticated','public.finish_visit_journey(uuid,text,uuid[])','EXECUTE')
    or (select count(*) from pg_trigger
      where tgrelid='public.deals'::regclass
       and tgname='deal_closing_stage_guard' and not tgisinternal) <> 1
  then raise exception 'Visit stage guard or RPC grants mismatch'; end if;

  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity)
  then raise exception 'Public table without RLS'; end if;
end
$imobfy_final_guard$;
"""


def load() -> list[tuple[str, str, str]]:
    items = []
    for position, path in enumerate(SOURCES):
        source = (ROOT / path).read_text(encoding="utf-8")
        if not source.strip():
            raise ValueError("Empty source: " + path)
        transaction_commands = [m.group(1).upper() for m in TXN.finditer(source)]
        if position == 0:
            if transaction_commands:
                raise ValueError("Unexpected transaction in quota source")
            if "security definer" not in source.lower() or "auth.uid()" not in source.lower():
                raise ValueError("Quota source security assumptions changed")
            clean = source.rstrip()
        else:
            if transaction_commands != ["BEGIN", "COMMIT"]:
                raise ValueError("Expected one BEGIN/COMMIT pair in " + path)
            clean = TXN.sub("", source).strip()
        items.append((path, clean, hashlib.sha256(source.encode()).hexdigest()))
    if "commission_receipts_commission_owner_fkey" not in items[1][1]:
        raise ValueError("Receipt owner foreign key missing")
    if "security invoker" not in items[2][1].lower():
        raise ValueError("Visit invoker requirement missing")
    return items


def render(items: list[tuple[str, str, str]], managed: bool) -> str:
    chunks = [
        "-- GENERATED, IMOBFY STAGING ONLY. Source steps 23,24,25 in one atomic batch.",
        "-- Production and already-applied source steps 01-22 must not be replayed.",
    ]
    if not managed:
        chunks.append("BEGIN;")
    chunks.extend([
        "SET LOCAL lock_timeout = '5s';",
        "SET LOCAL statement_timeout = '120s';",
        PREFLIGHT.strip(),
    ])
    for path, clean, sha256 in items:
        chunks.append(f"-- SOURCE {path} SHA256:{sha256}\\n{clean}")
    chunks.append(FINAL_GUARD.strip())
    if not managed:
        chunks.append("COMMIT;")
    return "\\n\\n".join(chunks) + "\\n"


def main() -> None:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--check", action="store_true")
    cli.add_argument("--managed", action="store_true")
    args = cli.parse_args()
    items = load()
    managed_sql = render(items, managed=True)
    if TXN.search(managed_sql):
        raise ValueError("Managed SQL must not contain transaction commands")
    if args.check:
        for path, _, sha256 in items:
            print("SOURCE", path, sha256)
        print("PASS: ordered, atomic, managed transaction-safe stage 23-25 bundle")
        print("NOT VERIFIED: real Auth JWT, PostgREST, Storage, hosted concurrency")
    else:
        print(managed_sql if args.managed else render(items, managed=False), end="")


if __name__ == "__main__":
    main()
