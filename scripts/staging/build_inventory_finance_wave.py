#!/usr/bin/env python3
"""Build a single reviewed staging-only inventory, sales and profile migration.

Read-only generator. Never connects to Supabase.
For managed migration: python3 scripts/staging/build_inventory_finance_wave.py --managed
For disposable PG: python3 scripts/staging/build_inventory_finance_wave.py
Use --check to verify sources and order without printing the SQL.
"""
from __future__ import annotations
import argparse
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = (
    "supabase/migrations/202610150002_properties_complete_capture_fields.sql",
    "supabase/migrations/202610150003_auto_generate_property_codes.sql",
    "supabase/migrations/202610160001_fix_sale_proposal_commission_flow.sql",
    "supabase/migrations/20261116134000_respect_explicit_sale_commission_sides.sql",
    "supabase/migrations/202610160002_profile_whatsapp_contact.sql",
    "supabase/migrations/202610190001_sync_profile_name_fields.sql",
)
PREFLIGHT = r"""
do $imobfy_inventory_preflight$
begin
  if to_regclass('public.property_photos') is null
     or to_regclass('public.property_share_links') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.properties') is null
     or to_regclass('public.sales') is null
     or to_regprocedure('public.generate_sale_commission()') is null
     or to_regprocedure('public.generate_property_code()') is not null
     or exists (select 1 from public.properties)
     or exists (select 1 from public.deals)
     or exists (select 1 from public.sales)
     or exists (select 1 from auth.users)
  then raise exception 'Expected clean staging wave 14-17 baseline not met';
  end if;
end
$imobfy_inventory_preflight$;
"""
FINAL_GUARD = r"""
-- handle_new_user is an internal trigger, not an RPC endpoint.
revoke all on function public.handle_new_user()
  from PUBLIC, anon, authenticated;

do $imobfy_inventory_guard$
declare fn oid;
begin
  if to_regprocedure('public.generate_property_code()') is null
    or to_regprocedure('public.sync_profile_names()') is null
    or to_regprocedure('public.create_sale_from_closed_deal()') is null
    or to_regprocedure('public.generate_sale_commission()') is null
    or not exists (select 1 from pg_indexes where schemaname='public'
      and tablename='properties' and indexname='properties_user_property_code_unique')
  then raise exception 'Expected inventory/finance/profile objects missing'; end if;

  if (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid
      where c.oid='public.properties'::regclass
        and not t.tgisinternal
        and t.tgname in ('generate_property_code_before_write',
          'sync_property_address_complement_alias')) <> 2 then
    raise exception 'Property triggers missing'; end if;

  if not exists (select 1 from pg_trigger t
      where not t.tgisinternal and t.tgrelid='public.profiles'::regclass
        and t.tgname='profiles_sync_names') then
    raise exception 'Name-sync trigger missing'; end if;

  foreach fn in array array[
    to_regprocedure('public.create_sale_from_closed_deal()'),
    to_regprocedure('public.generate_sale_commission()'),
    to_regprocedure('public.handle_new_user()')
  ] loop
    if fn is null or has_function_privilege('anon',fn,'EXECUTE')
      or has_function_privilege('authenticated',fn,'EXECUTE') then
      raise exception 'Privileged trigger is exposed as RPC: %', fn;
    end if;
  end loop;

  if position('or not has_explicit_sides' in lower(
      pg_get_functiondef('public.generate_sale_commission()'::regprocedure))) > 0 then
    raise exception 'Legacy commission fallback reintroduced';
  end if;

  if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity) then
    raise exception 'Public table missing RLS'; end if;
end
$imobfy_inventory_guard$;
"""


def load() -> list[tuple[str,str,str]]:
    files = []
    for path in SOURCES:
        s = (ROOT / path).read_text(encoding="utf-8")
        if not s.strip() or re.search(r"(?im)^\s*(?:BEGIN|COMMIT|ROLLBACK|START TRANSACTION)\s*;",s):
            raise ValueError(f"Invalid migration component {path}")
        files.append((path,s.rstrip(),hashlib.sha256(s.encode()).hexdigest()))
    original = files[2][1].lower()
    patched = files[3][1].lower()
    if "or not has_explicit_sides" not in original or "or not has_explicit_sides" in patched:
        raise ValueError("Incorrect commission migration ordering/content")
    if "create or replace function public.handle_new_user()" not in files[5][1].lower():
        raise ValueError("Profile creation trigger source missing")
    return files


def render(files: list[tuple[str,str,str]], managed: bool) -> str:
    chunks = [
        "-- GENERATED from versioned sources. STAGING ONLY. NOT FOR PRODUCTION.",
        "-- Historical sources 18,19,20,21,22 with immediate PR57 commission repair.",
    ]
    if not managed:
        chunks.append("BEGIN;")
    chunks += ["SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '90s';",
               PREFLIGHT.strip()]
    for path,s,sha in files:
        chunks.append(f"-- SOURCE {path} SHA256:{sha}\n{s}")
    chunks.append(FINAL_GUARD.strip())
    if not managed:
        chunks.append("COMMIT;")
    return "\n\n".join(chunks) + "\n"


def main() -> None:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--check", action="store_true")
    cli.add_argument("--managed", action="store_true")
    args = cli.parse_args()
    sources = load()
    if args.check:
        print("PASS: inventory + profile sources and immediate finance correction correctly ordered")
        print("NOT VERIFIED: live Auth or app API integration")
    else:
        print(render(sources,args.managed), end="")


if __name__ == "__main__":
    main()
