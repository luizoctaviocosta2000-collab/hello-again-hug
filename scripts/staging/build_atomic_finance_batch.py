#!/usr/bin/env python3
"""Build (never execute) an atomic staging-only financial migration batch.

Use:
    python3 scripts/staging/build_atomic_finance_batch.py --check
    python3 scripts/staging/build_atomic_finance_batch.py > /tmp/imobfy-finance-10-13.sql

Do not apply the output to production or individually expose steps 10-13.
"""
from __future__ import annotations

import argparse
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = (
    "20260911140000_direct_sales_and_manual_vgv_commissions.sql",
    "202609111400_imobfy_direct_sale_hardening.sql",
    "20260911141000_commission_reference_month.sql",
    "20260911142000_lock_finance_rpc_to_user.sql",
)
RPC_NAMES = ("register_manual_vgv", "register_direct_sale")
REPAIR_FILE = ROOT / "scripts/staging/patches/generate_sale_commission_unassigned_record.sql"

# Within the same transaction, privilege corrections and assertions must
# complete before the vulnerable interim function definitions become visible.
FINAL_GUARD = r"""
-- Repair and verify permissions BEFORE the batch can COMMIT.
REVOKE ALL ON FUNCTION public.register_manual_vgv(uuid,date,numeric,text,boolean)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_direct_sale(uuid,uuid,numeric,timestamptz,text[],text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_manual_vgv(uuid,date,numeric,text,boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_direct_sale(uuid,uuid,numeric,timestamptz,text[],text)
  TO authenticated;

-- The function exists at step 09; a fixed search_path is required.
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- Trigger-only SECURITY DEFINER functions do not need direct API EXECUTE.
DO $imobfy_privileges$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text AS signature
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype = 'pg_catalog.trigger'::regtype
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || fn.signature ||
            ' FROM PUBLIC, anon, authenticated';
  END LOOP;
END;
$imobfy_privileges$;

DO $imobfy_assert$
DECLARE
  manual_fn oid := to_regprocedure(
    'public.register_manual_vgv(uuid,date,numeric,text,boolean)'
  );
  sale_fn oid := to_regprocedure(
    'public.register_direct_sale(uuid,uuid,numeric,timestamptz,text[],text)'
  );
  fn oid;
BEGIN
  IF manual_fn IS NULL OR sale_fn IS NULL THEN
    RAISE EXCEPTION 'Required financial RPC missing at batch end';
  END IF;

  FOREACH fn IN ARRAY ARRAY[manual_fn, sale_fn] LOOP
    IF has_function_privilege('anon', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Financial RPC unexpectedly executable by anon: %', fn;
    END IF;
    IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Financial RPC not callable by authenticated: %', fn;
    END IF;
    IF position('auth.uid()' in lower(pg_get_functiondef(fn))) = 0
       OR position('p_user_id' in lower(pg_get_functiondef(fn))) = 0 THEN
      RAISE EXCEPTION 'Missing user identity guard in financial RPC: %', fn;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'A public table does not have RLS enabled';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype = 'pg_catalog.trigger'::regtype
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ) THEN
    RAISE EXCEPTION 'A privileged trigger function retains API EXECUTE grants';
  END IF;
END;
$imobfy_assert$;
"""


def read_sources() -> list[tuple[str, str, str]]:
    sources: list[tuple[str, str, str]] = []
    for name in MIGRATIONS:
        path = ROOT / "supabase" / "migrations" / name
        content = path.read_text(encoding="utf-8")
        if not content.strip():
            raise ValueError(f"Empty migration: {name}")
        if re.search(r"(?im)^\s*(?:COMMIT|ROLLBACK|START TRANSACTION)\s*;", content):
            raise ValueError(f"Explicit transaction boundary in source: {name}")
        if re.search(r"(?m)^\s*\\(?:i|include|copy)\b", content):
            raise ValueError(f"psql meta-command in source: {name}")
        digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
        sources.append((name, content, digest))

    initial = sources[0][1].lower()
    final = sources[-1][1].lower()
    for name in RPC_NAMES:
        if f"function public.{name}(" not in initial:
            raise ValueError(f"Expected historical RPC missing from step 10: {name}")
        if f"function public.{name}(" not in final:
            raise ValueError(f"Expected protected RPC missing from step 13: {name}")

    # This check is structural only. Real JWT-bound cross-account tests remain mandatory.
    if len(re.findall(
        r"auth\s*\.\s*uid\(\)\s+is\s+null\s+or\s+auth\s*\.\s*uid\(\)\s*<>\s*p_user_id",
        final, flags=re.I,
    )) < 2:
        raise ValueError("Step 13 does not explicitly guard both user-id RPCs")

    return sources


def read_repair() -> str:
    """Verify the staging-only replacement for a direct-sale trigger crash."""
    content = REPAIR_FILE.read_text(encoding="utf-8")
    expected = (
        "create or replace function public.generate_sale_commission()",
        "if new.deal_id is null then",
        "sides := coalesce(new.commission_sides",
        "sides := coalesce(d.sides",
    )
    if any(part not in content.lower() for part in expected):
        raise ValueError("Direct-sale commission repair missing its explicit NULL-deal guard")
    if content.lower().count(expected[0]) != 1:
        raise ValueError("Repair must replace exactly one sales commission trigger function")
    if re.search(r"(?im)^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;", content):
        raise ValueError("Repair must not break the atomic transaction boundary")
    return content


def build_sql(sources: list[tuple[str, str, str]], repair: str) -> str:
    parts = [
        "-- GENERATED from historical sources. STAGING ONLY. NEVER RUN UNREVIEWED.",
        "-- Four dependent steps must commit atomically, or roll back together.",
        "BEGIN;",
        "SET LOCAL lock_timeout = '5s';",
        "SET LOCAL statement_timeout = '60s';",
        "DO $imobfy_preflight$ BEGIN",
        "  IF to_regprocedure('public.register_manual_vgv(uuid,date,numeric,text,boolean)') IS NOT NULL",
        "     OR to_regprocedure('public.register_direct_sale(uuid,uuid,numeric,timestamptz,text[],text)') IS NOT NULL THEN",
        "    RAISE EXCEPTION 'Expected staging step-09 baseline; financial RPC already exists';",
        "  END IF;",
        "END; $imobfy_preflight$;",
    ]
    for number, (name, source, digest) in enumerate(sources, start=10):
        parts.extend((
            f"\n-- STEP {number}, SHA256 {digest}: {name}",
            source.rstrip(),
            "",
        ))
    parts.extend((
        "-- Stage-only correction: no unassigned d.sides when sale.deal_id is NULL.",
        repair.rstrip(),
        "",
    ))
    parts.extend((
        "-- Final mandatory security guard; commit is conditional on success.",
        FINAL_GUARD.strip(),
        "COMMIT;",
    ))
    return "\n".join(parts) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true",
                        help="Validate source ordering and mandatory identity guards only")
    args = parser.parse_args()

    sources = read_sources()
    repair = read_repair()
    if args.check:
        print("PASS: four source migrations and direct-sale trigger repair verified; both RPC identity guards present.")
        print("NOT VALIDATED: PostgreSQL execution, tenant isolation, or remote migration history.")
    else:
        print(build_sql(sources, repair), end="")


if __name__ == "__main__":
    main()
