# IMOBFY — staging 23–26 verified execution (17 Nov 2026)

## Destination and boundaries

**Only** Supabase test project `imobfy-testes` (`etcdlxkpidiqbgdayiol`). Production `zenzuialkjalkabenbtv`, Lovable, GitHub `main`, WhatsApp/Instagram/Meta and all Edge Functions were not modified.

Preflight immediately before stage 23–25 confirmed 12 migration-history records, no Auth users or commercial data, no `ai_usage`, no visit RPC, all 20 exposed tables with RLS, and zero Security Advisor findings.

## Migration applications and verification

1. `20261117114505_imobfy_staging_23_25_quota_receipts_visits_secure`: Supabase Management API `apply_migration` returned `success:true`. Atomic reviewed source bundle from `scripts/staging/build_final_staging_wave.py --managed` with historical steps 23–25; historical source 24 and 25 explicit transaction wrappers were removed in generated managed SQL. `consume_ai_quota` was hardened with empty `search_path`.
2. Read-back confirmed 13 migration entries, 21/21 public tables with RLS, quota RPC grant to authenticated but not anon, quota table unreadable by authenticated, receipt composite tenant FK present, exactly two intended receipt triggers, and visit stage guard installed.
3. Identified a **real staging-only schema conflict** during inspection: `public.visits` has `visits_status_check` allowing `completed`, not `done`, while the historical `finish_visit_journey` function attempted `UPDATE visits SET status='done'`. The stage 23–25 migration itself had committed successfully, so a correction was required.
4. `20261117115025_imobfy_staging_26_normalize_completed_visit_status`: second `apply_migration` returned `success:true`; the reviewed patch `scripts/staging/patches/visit_completed_status_compatibility.sql` preserves the client/RPC input `done` but persists `completed` and makes same-outcome retries idempotent. Anonymous RPC access remains denied.
5. Read-back confirmed 14 migration-history records, normalized function definition, no actual Auth users or commercial records.

## Automated evidence

[PostgreSQL 17 / Bun / TypeScript / build workflow PASS](https://github.com/luizoctaviocosta2000-collab/hello-again-hug/actions/runs/44077444834) at branch head `b017978d6c7524ad9eb28766dd25382e8bfd34d0`, including the real-shaped visit status `CHECK` in the disposable fixture. The earlier CI passed without that `CHECK` and must not be cited as evidence of live visit completion.

## Hosted SQL simulation (no persistent data)

An explicit `BEGIN ... ROLLBACK` query on the actual staging schema used two synthetic `auth.users` records with simulated authenticated `request.jwt.claim.sub` role changes. All checks passed:

- Auth signup trigger generated both profiles.
- Authenticated user A created own property and client.
- A created a synthetic commission and partial receipt; status synchronized; overpayment rejected.
- A scheduled, completed, and retried the same visit; database persisted `completed` within the transaction.
- User B could not read A's property/visit, finish A's visit, or attach a receipt to A's commission.
- Each user's quota was independent.
- Transaction ended in `ROLLBACK`; the final query returned **zero** Auth users, properties, visits, receipts, and quota rows.

This is **NOT** actual Auth API signup/login with issued JWTs or PostgREST HTTP testing. No real users or real customer data were created.

## Post-flight advisor review

- Security Advisor `INFO`: `rls_enabled_no_policy` on `public.ai_usage`. Intentional deny-all table access; the quota RPC owns the write path.
- Security Advisor `WARN`: `authenticated_security_definer_function_executable` on `public.consume_ai_quota`. Deliberate RPC elevation, but requires explicit privileged-function design review before external release. Current checks: `auth.uid()` required, feature allowlist, fixed empty `search_path`, no public/anon execute, quota table inaccessible directly.
- Performance Advisor retains findings: unindexed foreign keys (18), auth-policy initplan (26), unused index hints (36), multiple permissive policies (120), duplicate index (1). These are not all defects; audit individually rather than blindly dropping indexes/policies.

## Not yet homologated / release gates

- Real two-user Auth API signup/session JWT, PostgREST authenticated CRUD and RLS over HTTP, Storage upload/signing, browser and mobile flows, genuine Gemini Edge Function responses and hosted concurrency.
- New App/browser and integrations are untouched. `main`, PR #54 and stacked PRs #55–#59 are not merged. PR #60 remains a **draft**.
- Do not apply historical steps 10–25 again, blindly run `supabase db push`, deploy outbound messaging or merge to production.
- Before releasing, review the quota privileged function security warning, harmonize PR stack/duplicate commission correction, then verify external integration and approve the deployment separately.
