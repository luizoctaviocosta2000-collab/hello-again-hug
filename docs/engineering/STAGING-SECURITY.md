# Staging security gate — migration steps 10–13

**Status:** preparation only. No SQL applied remotely. Production is excluded.

## Confirmed vulnerability in the historical sequence

At staging step 09, the old migrations have not yet created two financial RPCs. Original step 10 (`20260911140000_direct_sales_and_manual_vgv_commissions.sql`) creates:

- `public.register_manual_vgv(uuid,date,numeric,text,boolean)`
- `public.register_direct_sale(uuid,uuid,numeric,timestamptz,text[],text)`

Both initially run as SECURITY DEFINER without `auth.uid() = p_user_id` validation, while EXECUTE is granted to `authenticated`. Step 11 protects direct-sale; **step 13** finally protects both. Applying steps 10–13 as separate committed migrations creates a window of unauthorized cross-user financial writes.

## Safe approach proposed for review

- Keep the four **historical migration files unchanged**.
- Generate one atomic SQL **batch** that includes steps 10, 11, 12, 13 **in that order**, then revokes unnecessary privileged trigger-function RPC EXECUTE, fixes `set_updated_at` search_path and verifies final grants/function guards before COMMIT.
- Use one `apply_migration` for the complete batch only **after explicit approval**. A single committed migration has a different staging history from the original 4; record the composite version and maintain source mapping. Never double-apply these four migrations afterward.
- If any step or assertion fails, the DB transaction rolls back. Confirm staging is still at step 09 before any execution. SQL generated here is a preparation artifact, not an instruction to execute immediately.
- Generate a reviewable SQL file with `python3 scripts/staging/build_atomic_finance_batch.py > /tmp/imobfy-finance-10-13.sql`. The Python script **never connects to a database**. Use `--check` to validate input files without generating output.
- Do not use a shell pipe straight to a production SQL client. The output has to be reviewed, tested in isolated PostgreSQL 17 and explicitly authorized.

## Acceptance checks after execution (not yet run)

1. Confirm the four final function definitions have the expected user-bound authorization; especially the two financial RPCs check `auth.uid()` against `p_user_id` on their first executable path.
2. `anon` cannot execute either financial RPC; `authenticated` can invoke only for own user ID. In real staging with user A and B, attempt B's ID using A's token and assert no rows created.
3. Trigger-only SECURITY DEFINER functions no longer have explicit callable EXECUTE grants to `anon` and `authenticated` (without breaking normal trigger behavior).
4. RLS remains enabled for all public tables. Re-read advisors and apply follow-up remediations before declaring completion.
5. Test negative numbers, non-finite inputs, cents and duplicate calls; **some are distinct existing logic bugs** and may not pass merely because grants are fixed.
6. Verify staging's migration history acknowledges the composite batch as a single step. Document any divergence from production migrations explicitly.

## Failure/rollback

If the pre-commit assertion fails, the whole batch must roll back. No user records should be written in this early staging step. After a committed batch, **do not assume that rolling back the migration is safe**; restore the disposable staging database from a deliberate snapshot/reset only with an authorized operation. Do not use this procedure on production.

## Current security baseline (2026-11-16)

- `imobfy-testes` project `etcdlxkpidiqbgdayiol`, 9 migrations applied.
- Advisors: eight PUBLIC-executable SECURITY DEFINER trigger functions and one mutable search_path function.
- The `public` schema's 18 tables have RLS enabled, but real two-user isolation has not been tested.
- No fixture user accounts have been created; Auth and Storage are not yet homologated.

## Guardrails

The consolidated output doesn't certify every downstream migration. Later migration steps (14 onward), storage policies, Edge Functions, and real user E2E still need independent review. Neither the generation script nor a green PostgreSQL syntax check is evidence of real user isolation.
