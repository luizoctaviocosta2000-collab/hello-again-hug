#!/usr/bin/env python3
"""Build an atomic, reviewable staging SQL bundle. This script never connects to Supabase.

python3 scripts/staging/build_security_wave.py --check
python3 scripts/staging/build_security_wave.py --managed > /tmp/staging-security-wave.sql
python3 scripts/staging/build_security_wave.py > /tmp/staging-security-wave-local.sql

Supabase apply_migration controls its own transaction. --managed omits BEGIN/COMMIT.
Only stages 14-17 and two ownership guards; no other historical stages included.
"""
from __future__ import annotations
import argparse
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = (
    "supabase/migrations/202610081341_imobfy_security_performance_hardening.sql",
    "supabase/migrations/202610081500_imobfy_ai_conversations.sql",
    "supabase/migrations/20261116132000_ai_conversation_tenant_boundary.sql",
    "supabase/migrations/202610140001_property_photos.sql",
    "supabase/migrations/202610150001_property_share_links.sql",
    "supabase/migrations/20261116130000_property_photo_tenant_boundary.sql",
)
PREFLIGHT = r"""
do $imobfy_wave_preflight$
begin
  if to_regprocedure('public.register_direct_sale(uuid,uuid,numeric,timestamptz,text[],text)') is null
    or to_regprocedure('public.register_manual_vgv(uuid,date,numeric,text,boolean)') is null
    or to_regclass('public.ai_conversations') is null
    or to_regclass('public.ai_messages') is null
    or to_regclass('public.property_photos') is not null
    or to_regclass('public.property_share_links') is not null
    or exists (select 1 from storage.buckets where id = 'property-photos')
    or exists (select 1 from public.ai_messages)
    or exists (select 1 from public.ai_conversations)
    or exists (select 1 from auth.users)
    or exists (select 1 from public.properties)
    or exists (select 1 from public.sales)
  then raise exception 'Staging stage-13 prerequisite does not match clean expected baseline';
  end if;
end
$imobfy_wave_preflight$;
"""
FINAL_GUARD = r"""
do $imobfy_wave_guard$
declare fn oid;
begin
  if to_regclass('public.property_photos') is null or
     to_regclass('public.property_share_links') is null
    or not exists (select 1 from storage.buckets where id='property-photos' and not public)
  then raise exception 'Required private property photo/share structure missing'; end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity
  ) then raise exception 'Public table without RLS'; end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.ai_messages'::regclass and conname='ai_messages_conversation_tenant_fk'
  ) then raise exception 'Missing AI message ownership FK'; end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.property_photos'::regclass and conname='property_photos_tenant_property_fk'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid='public.property_share_links'::regclass and conname='property_share_links_tenant_property_fk'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid='public.property_photos'::regclass and conname='property_photos_owned_storage_path_check'
  ) then raise exception 'Missing property ownership constraints'; end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='Users access own property photo files'
  ) then raise exception 'Storage policy absent'; end if;
  foreach fn in array array[
    to_regprocedure('public.register_direct_sale(uuid,uuid,numeric,timestamptz,text[],text)'),
    to_regprocedure('public.register_manual_vgv(uuid,date,numeric,text,boolean)')
  ] loop
    if fn is null then raise exception 'Finance RPC missing'; end if;
    if (select prosecdef from pg_proc where oid=fn) then
      raise exception 'Finance RPC still SECURITY DEFINER: %',fn;
    end if;
    if has_function_privilege('anon',fn,'EXECUTE') or
       not has_function_privilege('authenticated',fn,'EXECUTE') then
      raise exception 'Finance RPC grants incorrect: %',fn;
    end if;
  end loop;
end
$imobfy_wave_guard$;
"""


def load_sources() -> list[tuple[str, str, str]]:
    items = []
    for source in SOURCES:
        data = (ROOT / source).read_text(encoding="utf-8")
        if not data.strip():
            raise ValueError(f"Empty source: {source}")
        if re.search(r"(?im)^\s*(?:BEGIN|COMMIT|ROLLBACK|START TRANSACTION)\s*;", data):
            raise ValueError(f"Unexpected explicit transaction boundary: {source}")
        if re.search(r"(?m)^\s*\\(?:i|include|copy)\b", data):
            raise ValueError(f"psql meta command: {source}")
        items.append((source, data.rstrip(), hashlib.sha256(data.encode()).hexdigest()))
    assert "security invoker" in items[0][1].lower()
    assert "ai_messages_conversation_tenant_fk" in items[2][1]
    assert "property_photos_owned_storage_path_check" in items[5][1]
    return items


def assemble(items: list[tuple[str, str, str]], managed: bool) -> str:
    chunks = [
        "-- GENERATED. IMOBFY staging only. NOT APPROVED FOR PRODUCTION.",
        "-- Sources stages 14-17 plus owner-scoped AI and property-photo guards.",
    ]
    if not managed:
        chunks.append("BEGIN;")
    chunks.extend([
        "SET LOCAL lock_timeout = '5s';",
        "SET LOCAL statement_timeout = '90s';",
        PREFLIGHT.strip(),
    ])
    for source, data, checksum in items:
        chunks.append(f"-- SOURCE: {source} SHA256:{checksum}\n{data}")
    chunks.append(FINAL_GUARD.strip())
    if not managed:
        chunks.append("COMMIT;")
    return "\n\n".join(chunks) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--managed", action="store_true")
    args = parser.parse_args()
    items = load_sources()
    if args.check:
        print("PASS: six migration components validated in security-ordered sequence")
        print("NOT VERIFIED: real Supabase Auth, Storage API, or data operations")
    else:
        print(assemble(items, args.managed), end="")


if __name__ == "__main__":
    main()
