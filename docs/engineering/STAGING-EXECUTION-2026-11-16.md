# IMOBFY staging finance bootstrap — applied 2026-11-16

## Scope and authorization
- Project: **imobfy-testes** (`etcdlxkpidiqbgdayiol`), PostgreSQL 17, US East 1.
- User explicitly approved applying the staged finance batch to this **test** project only.
- Production `zenzuialkjalkabenbtv` was not modified. No merge, Lovable deployment, Edge Function deployment or real external messaging occurred.
- Management API `apply_migration` executed once, and returned `success: true`.
- Before applying, confirmed exactly nine staging migrations, no user records, no sales and both target finance RPCs absent.
- Supabase migration runner handles the database transaction. Submitted SQL intentionally **omitted top-level `BEGIN;` and `COMMIT;`**, following the official Supabase knowledge base on embedded transactions.

## Migration history

- Migration `20261116124049` — `imobfy_staging_10_13_atomic_finance_security`.
- The history now contains **10 records**: original staging stages 01–09 plus one atomic composite for **source stages 10, 11, 12 and 13**.
- Original files remained unchanged; the composite includes the staging-only `generate_sale_commission` repair and privilege assertions.
- This remote history intentionally diverges from the individual historical migration filenames. **Do not rerun** stages 10–13 individually. Do not copy the composite unreviewed to production. Reconcile this staging-only migration with the future deployment plan.

## Source mapping and reproducibility

- `20260911140000_direct_sales_and_manual_vgv_commissions.sql` blob `9c56058e64fb9a09b1016a78afeb8407834c9d67`.
- `202609111400_imobfy_direct_sale_hardening.sql` blob `255dd2b68ed03a6693a1be0b0cc393664c87aeb3`.
- `20260911141000_commission_reference_month.sql` blob `06885df0b0a132b26ddd5dd686a06570e9c471e1`.
- `20260911142000_lock_finance_rpc_to_user.sql` blob `89da82d5fc2f6e3f64558ac540fde8caa6c8099b`.
- `scripts/staging/patches/generate_sale_commission_unassigned_record.sql` blob `64c5b895916f864fc1ded8c0a6c749a9fed9dc1a`.
- `scripts/staging/build_atomic_finance_batch.py --managed` produces the Supabase-managed transaction version from these sources; local PostgreSQL CI uses the explicit transaction version. The applied SQL also records source blob versions in comments and includes the final privilege gate.

## Verified after applying

- Both `register_manual_vgv` and `register_direct_sale` exist and are executable by `authenticated`, not `anon`.
- All privileged trigger-only functions were stripped of direct `anon`/`authenticated` execution rights. The `set_updated_at` function has a fixed search path.
- All 18 public tables remain RLS enabled; no logged-in or anonymous user has CREATE access to `public` schema.
- Direct-sale generator includes the branch that avoids dereferencing an uninitialized `d` record when `deal_id` is NULL.
- Actual staging SQL tests with a **simulated authenticated JWT claim** confirmed cross-user manual-VGV and direct-sale calls return `Usuário não autorizado`, and an own-user attempt to sell a non-owned/nonexistent property returns `Imóvel não encontrado no seu estoque`.
- Actual staging role test confirmed `anon` cannot call either RPC.
- Final count: zero Auth users, zero profiles, zero sales, zero commissions and zero VGV rows. These exercises did not create business data.
- [GitHub Actions regression](https://github.com/luizoctaviocosta2000-collab/hello-again-hug/actions/runs/43868284499) passed on disposable PostgreSQL 17; it includes positive synthetic authorized sales, commissions, negative cross-account calls and a forced late failure that rolled back the whole bundle. Other quality gates passed as well.

## Advisor results and remaining risks

- Supabase security advisors now report **two `authenticated_security_definer_function_executable` warnings**, for `register_manual_vgv` and `register_direct_sale`. These are deliberately callable only by signed-in users and have `auth.uid() = p_user_id` guards; the warnings do **not** prove a bypass. The design must still be reviewed before external rollout, ideally reducing SECURITY DEFINER exposure.
- No `anon_security_definer_function_executable` or mutable-search-path warnings observed after the migration.
- Two real user sessions, HTTP PostgREST, RLS across linked records, Storage, Gemini, concurrency under the hosted API, and full sales lifecycle have **not** been homologated remotely. Simulated claim checks are narrower than real JWT tests.
- Subsequent project migrations and future Edge Functions have **not** been applied. Financial domain has outstanding known issues (duplicate writes, numeric validation, legacy transitions) beyond this atomic step.
- No destructive down migration was attempted or prescribed. Rollback/restore for an already committed staged migration requires a separate approved plan; do not assume it is safe to undo by hand.

## Next actions

1. Review the next chronological migration(s) and compatibility with the composite stage history.
2. Create actual disposable Supabase Auth test accounts only through an approved Auth workflow, then validate complete two-account ownership, positive finance operations and business flows.
3. Keep PR #55 in draft until owner explicitly approves merge.
