# Staging security gate — migration steps 10–13

**Status:** applied to `imobfy-testes` on 16 November 2026, and SQL security checks passed. Production is excluded. See `STAGING-EXECUTION-2026-11-16.md` for version and evidence.

## Confirmed vulnerability in the historical sequence

At staging step 09, the old migrations have not yet created two financial RPCs. Original step 10 (`20260911140000_direct_sales_and_manual_vgv_commissions.sql`) creates:

- `public.register_manual_vgv(uuid,date,numeric,text,boolean)`
- `public.register_direct_sale(uuid,uuid,numeric,timestamptz,text[],text)`

Both initially run as SECURITY DEFINER without `auth.uid() = p_user_id` validation, while EXECUTE is granted to `authenticated`. Step 11 protects direct-sale; **step 13** finally protects both. Applying steps 10–13 as separate committed migrations creates a window of unauthorized cross-user financial writes.

## Approach adopted for isolated staging

- Keep the four **historical migration files unchanged**.
- Generate one atomic SQL **batch** that includes steps 10, 11, 12, 13 **in that order**, applies the narrow staging-only fix for the unassigned `d` record in direct sales, then revokes unnecessary privileged trigger-function RPC EXECUTE, fixes `set_updated_at` search_path and verifies final grants/function guards before COMMIT.
- Supabase Management API's migration runner controlled the transaction. Used `--managed` to omit explicit `BEGIN/COMMIT`, which can break built-in rollback semantics. The staging application was authorized explicitly. A single committed migration has a different staging history from the original 4; record the composite version and maintain source mapping. Never double-apply these four migrations afterward.
- Before application staging was confirmed at step 09. The migration succeeded and its final state was independently verified. **Do not reapply** this bundle to the current database.
- Generate a local PostgreSQL test batch with `python3 scripts/staging/build_atomic_finance_batch.py`; for Supabase-managed transactions use `python3 scripts/staging/build_atomic_finance_batch.py --managed`. Neither variant connects to a database. Use `--check` for source inspection. Generation does not authorize applying the same batch again.
- Do not use a shell pipe straight to a production SQL client. The output has to be reviewed, tested in isolated PostgreSQL 17 and explicitly authorized.

## Acceptance checks after execution (results in isolated staging)

1. Confirm the four final function definitions have the expected user-bound authorization; especially the two financial RPCs check `auth.uid()` against `p_user_id` on their first executable path.
2. `anon` cannot execute either financial RPC; `authenticated` can invoke only for own user ID. In real staging with user A and B, attempt B's ID using A's token and assert no rows created.
3. Trigger-only SECURITY DEFINER functions no longer have explicit callable EXECUTE grants to `anon` and `authenticated` (without breaking normal trigger behavior).
4. RLS remains enabled for all public tables. Re-read advisors and apply follow-up remediations before declaring completion.
5. Test negative numbers, non-finite inputs, cents and duplicate calls; **some are distinct existing logic bugs** and may not pass merely because grants are fixed.
6. Verify staging's migration history acknowledges the composite batch as a single step. Document any divergence from production migrations explicitly.

## Failure/rollback

If the pre-commit assertion fails, the whole batch must roll back. No user records should be written in this early staging step. After a committed batch, **do not assume that rolling back the migration is safe**; restore the disposable staging database from a deliberate snapshot/reset only with an authorized operation. Do not use this procedure on production.

## Current security baseline (2026-11-16)

- `imobfy-testes` project `etcdlxkpidiqbgdayiol`: **10 migration history records**, including the composed source stages 10–13 under version `20261116124049`.
- Advisors: only two warnings on authenticated-invocable SECURITY DEFINER financial RPCs; direct anonymous execution, privileged trigger grants and mutable `set_updated_at` search_path are resolved.
- The `public` schema's 18 tables have RLS enabled, but real two-user isolation has not been tested.
- No fixture user accounts have been created; Auth and Storage are not yet homologated.

## Guardrails

The consolidated output doesn't certify every downstream migration. Later migration steps (14 onward), storage policies, Edge Functions, and real user E2E still need independent review. Neither the generation script nor a green PostgreSQL syntax check is evidence of real user isolation.

## PostgreSQL 17 validation (completed on 16 November 2026)

- [GitHub Actions staging-finance regression](https://github.com/luizoctaviocosta2000-collab/hello-again-hug/actions/runs/43867066514) passed on a **synthetic stage-09-shaped schema**. Also passed: quality gate, commercial journey and receipt security workflows.
- The first expanded sale-trigger run uncovered a real defect in the historical step-12 `generate_sale_commission`: `CASE ... ELSE d.sides` can access an unassigned `record d` for a direct sale with null `deal_id`. The original SQL migrations remain unchanged.
- A staging-only replacement is now versioned at `scripts/staging/patches/generate_sale_commission_unassigned_record.sql` and appended inside the same atomic generator transaction before permission assertions.
- The test uses two fictitious user UUIDs, an active capture, anonymous access attempts, cross-user financial calls, own-user manual VGV and direct sales. It checks that **sale-only** and **capture-only** entries produce exactly their corresponding commission types, and verifies the numeric formula at R$ 500,000.
- A deliberately injected SQL failure just before COMMIT was followed by verification that the original table constraint, missing RPCs and trigger permissions were fully restored.
- Before the write, the real staging schema was inspected read-only for finance columns, indexes, trigger presence and migration count. Following explicit approval, the composite was applied remotely; no user or business records were inserted.
- **Remaining:** the disposable fixture was not a full dump of stage 09; actual Auth/PostgREST/Storage and real two-user business workflows have not been verified. Staging SQL negative checks used simulated JWT claims; positive authorized workflow was tested only with synthetic local PostgreSQL fixtures. Do not equate these CI results with production release readiness.

### Migration-history caution

The bundle is assembled from historical migrations plus a staging-only correction, so its final schema is intentionally ahead of the original four migration files. Record the composite staging migration version and the corrective change explicitly. Before any production proposal, reconcile the complete post-October migration chain rather than copying this staging bundle blindly.

## Post-application verification

- Migration history and security scan: see [staging execution report](STAGING-EXECUTION-2026-11-16.md).
- Two finance RPC signatures accessible only to `authenticated` passed real SQL role checks with simulated JWT subjects; cross-account requests were denied, and unauthorized property access failed.
- Zero auth users, profiles, sales, commissions, or VGV rows after validation.
- Full integration and subsequent migrations remain pending; do not interpret this as a production release approval.
