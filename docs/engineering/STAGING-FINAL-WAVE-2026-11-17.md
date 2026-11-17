# IMOBFY — staging final migration wave (17 Nov 2026)

## Baseline (freshly read before branch creation)

- Project: `imobfy-testes`, ref `etcdlxkpidiqbgdayiol`. **Not** production `zenzuialkjalkabenbtv`.
- 12 migration history records: source steps 01–09 plus three managed composite migrations covering historical 10–13, 14–17 and 18–22.
- 20 public tables, all RLS enabled; zero Security Advisor notices; staging Auth users, properties, deals, sales, visits, commissions and receipts all empty.
- The quota table, quota RPC, receipt composite FK/secure triggers and atomic visit RPCs were absent before this change.
- Main, Lovable, production and Edge Functions are not part of this proposal.

## Proposed step 23–25 atomic staging migration

Source files remain unchanged:
1. `202610190002_ai_daily_quotas.sql` — `ai_usage` and per-user quota RPC.
2. `20261022133523_harden_commission_receipt_ownership.sql` — composite receipt/commission tenant foreign key, serializing receipt validation and status sync.
3. `20261022182211_atomic_visit_journey.sql` — atomic authenticated visit saves/finishes, closed-deal stage guard.

The versioned generator `scripts/staging/build_final_staging_wave.py` strips **only** the historical outer BEGIN/COMMIT in sources 24 and 25 and wraps their statements in a single transaction for PostgreSQL 17 CI. Its `--managed` output has no outer transaction statements, so Supabase `apply_migration` owns the transaction. The source SHA-256 digest is recorded in generated SQL.

Before any write it checks the expected stage 22 schema, the legacy receipt FK, absent visit guard, **empty staging user/business tables**, and absence of 23–25 objects; it fails closed on drift. After running sources, the generator explicitly hardens `consume_ai_quota` to an empty `search_path` and checks the quota table RLS, RPC grant scope, receipt tenant FK, internal triggers and visit privileges. Anonymous callers must not execute these RPCs.

## CI and scope of evidence

`.github/workflows/staging-final-wave.yml` reconstructs the 09–22 baseline in a disposable PostgreSQL 17 service, then runs the generated final migration and regression tests. The regression includes simulated JWT role/tenant isolation, quota exhaustion, partial and over-limit receipts, anonymous RPC checks, visit retry semantics and cross-user denials, plus existing inventory, profile, sales and commission scenarios. Bun unit tests, typecheck and build also run.

**CI is necessary but not sufficient.** Simulated SQL JWT claims are not real Supabase Auth sessions. This work does not deploy messaging integrations, sign Storage URLs, use Gemini, validate PostgREST via real JWT, or certify browser/mobile workflows.

## Deployment and rollback gates

- Review source checksums and `--managed` output. Do not run raw historical migration files directly, reapply 10–22 or use unreviewed `supabase db push` on this composite-history staging database.
- Use a **new migration history record**, named `imobfy_staging_23_25_quota_receipts_visits_secure`, only on `imobfy-testes` after green CI and a fresh preflight. Prefer an atomic failure/rollback, never partial application.
- Verify history, secure function definitions and grants, constraints, triggers, RLS, Security Advisor and tests after any application.
- In case of failed atomic migration, no partial schema changes should remain. If applied successfully and later deemed invalid, do not delete migration history or drop tables blindly; create a corrective migration, test and reapprove.
- Real two-user Auth JWT and PostgREST/Storage/Edge/browser E2E remain separate required gates. Do **not** merge, deploy production or promote app until approved.

## Known residual risk

The authenticated-callable quota RPC remains `SECURITY DEFINER` because ordinary authenticated users cannot write `ai_usage` directly; it enforces `auth.uid()`, a closed feature allowlist and fixed empty `search_path`. Review advisors and runtime permissions after deployment; do not label this unreviewed RPC risk-free.
