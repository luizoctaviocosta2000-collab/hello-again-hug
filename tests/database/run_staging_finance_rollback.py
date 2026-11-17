#!/usr/bin/env python3
"""Prove the generated staging bundle rolls back on a deliberately late SQL error.

Runs only against the disposable PostgreSQL database configured in GitHub Actions.
Does not connect to remote Supabase, production, or customer data.
"""
from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET_DB = "imobfy_stage_finance_test"

if os.environ.get("PGHOST") not in {"localhost", "127.0.0.1"}:
    raise SystemExit("Refusing: PGHOST must be localhost.")
if os.environ.get("PGDATABASE") != TARGET_DB:
    raise SystemExit(f"Refusing: PGDATABASE must be {TARGET_DB}.")

original = subprocess.run(
    ["python3", str(ROOT / "scripts/staging/build_atomic_finance_batch.py")],
    check=True, capture_output=True, text=True
).stdout
if not original.endswith("COMMIT;\n"):
    raise SystemExit("Expected generated SQL to end with COMMIT.")

marker = "Injected rollback fixture failure"
failed_sql = original.removesuffix("COMMIT;\n") + (
    "DO $imobfy_inject$ BEGIN\n"
    f"  RAISE EXCEPTION '{marker}';\n"
    "END; $imobfy_inject$;\nCOMMIT;\n"
)
with tempfile.TemporaryDirectory(prefix="imobfy-finance-sql-") as tmp:
    staged_file = Path(tmp) / "inject-failure.sql"
    staged_file.write_text(failed_sql, encoding="utf-8")
    r = subprocess.run(
        ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-f", str(staged_file)],
        capture_output=True, text=True, timeout=60,
    )
    if r.returncode == 0 or marker not in r.stderr:
        raise SystemExit("Injected rollback did not reach expected late failure:\n" + r.stderr[-3000:])

print("PASS: forced failure reached guard, transaction aborted")
subprocess.run([
    "psql", "-X", "-v", "ON_ERROR_STOP=1", "-f",
    str(ROOT / "tests/database/staging_finance_rollback_assert.sql")
], check=True, timeout=30)
print("PASS: prior schema and grants were restored")
