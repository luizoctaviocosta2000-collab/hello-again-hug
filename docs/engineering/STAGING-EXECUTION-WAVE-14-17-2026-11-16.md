# IMOBFY — staging security migration wave execution (2026-11-16)

## Authorization and scope
The user explicitly approved advancing the `imobfy-testes` environment with the **next finance-security, AI conversations, property photos and property-sharing migration wave**, contingent on successful preflight and testing.

- Target only: Supabase project `etcdlxkpidiqbgdayiol` (`imobfy-testes`).
- Production project `zenzuialkjalkabenbtv`: **untouched**.
- No merge, Edge Function deployment, Lovable publish, live messaging or ad modifications.
- GitHub branch: `feat/imobfy-staging-security-wave-20261116`; PR #58 is still **draft**, stacked onto #56, which is stacked onto #55.
- Source reviewed and applied at commit `0a96847a5d1f14634343bcde414fd0e1ba2e7f65`.
- Migration executor returned `{"success":true}`.

## Applied migration history

Single composite Supabase-managed migration:

- **Version:** `20261116134906`
- **Name:** `imobfy_staging_14_17_secure_ai_photos_sharing`
- **Migration records:** 11 total (the first 9 historical staging entries, finance composite 10–13, and this security wave).
- Existing historical migration files were not edited. Do not replay these source files individually on this staging database.

Source order within the single migration transaction:

| Logical sequence | File (GitHub blob SHA) |
| --- | --- |
| Security hardening, source 14 | `202610081341_imobfy_security_performance_hardening.sql` · `cd7d15a6f2455e9c1a103f555dedb6c6b171fb9b` |
| Existing AI conversations, source 15 | `202610081500_imobfy_ai_conversations.sql` · `ca014d46e1c192d900e17b4a27d0b59f1b1e73bf` |
| AI cross-tenant message guard | `20261116132000_ai_conversation_tenant_boundary.sql` · `a17ffe9c6e2e32a022230d7a3b5a3d9a43f1403b` |
| Property photos and private bucket, source 16 | `202610140001_property_photos.sql` · `b0ca3489ab300697fa7a7e694eab70326fe07037` |
| Property share links, source 17 | `202610150001_property_share_links.sql` · `2c76dcd0971b7f67cd3bc3a638e7fa9806feb553` |
| Photo + property link tenant guards | `20261116130000_property_photo_tenant_boundary.sql` · `cb6d58bbec28d7079594b592ecf1363a0261fc0e` |

The output was assembled in dependency order using the same source content and preflight/final assertions as `scripts/staging/build_security_wave.py --managed`. It deliberately omitted top-level `BEGIN/COMMIT`; Supabase's migration runner owns the transaction.

## Preflight (all green)

- Project ACTIVE_HEALTHY; existing migration history unchanged at 10, last source stage 10–13 finance composite.
- Both financial RPCs existed; AI conversation and message tables already existed from the early staging seed.
- Neither photo nor property share table existed; the `property-photos` bucket was absent.
- Zero Auth users, properties, AI conversations, AI messages and sales.
- All 18 previous public tables had RLS enabled.
- [Disposable PostgreSQL 17 full security wave](https://github.com/luizoctaviocosta2000-collab/hello-again-hug/actions/runs/43878933211) passed **all steps**, including the stacked historic finance schema, actual chronological source migrations and both owner-guard migrations. Synthetic two-user SQL tests validated AI parent/child tenant ownership, photo/share composite FKs, URL-path constraints and Storage RLS, and Bun tests/typecheck/build passed.

## Post-application remote verifications

- Migration count **11**, latest `20261116134906_imobfy_staging_14_17_secure_ai_photos_sharing`.
- **20/20 public tables have RLS enabled**.
- Private Storage bucket `property-photos` exists, size limit 12 MiB; Storage policy for user-owned photo paths present.
- `property_photos` and `property_share_links` exist; three photo/share owner/path constraints active.
- AI message-to-conversation composite tenant foreign key active; 4 explicit per-operation policies on each AI table; older overlapping broad `_own_rows` policies removed.
- Both financial RPCs `register_manual_vgv` and `register_direct_sale` are `SECURITY INVOKER`, not SECURITY DEFINER; available to `authenticated` but not `anon`.
- Live SQL role probes confirmed `anon` execution rejected; simulated authenticated JWT subject A cannot write finance entries as B. Probes were rolled back.
- Final Auth users/properties/photos/share-links/AI messages/AI conversations/sales/commissions remain **0**.
- Supabase Security Advisors returned **0 notices** at time of verification. This does not equal a complete external-user penetration test.

## Remaining scope and cautions

- No real signed-in Auth sessions, Storage HTTP upload/signed URL, public share Edge Function, or mobile/UI journey verified. Photo/share Edge Function code in PR #56 is **not deployed**; a database migration alone does not deploy it.
- All real users/transactions remain absent from staging. Positive functional tests were on disposable PostgreSQL fixtures only; live negative SQL tests simulated JWT claims and role.
- The next historical migrations (capture fields, property code generation, deal-closing commission override, receipts, visits, quota enforcement) remain **unapplied** and require their own review, ordering and approval. PR #57 separately fixes incorrect captação commission from the later October historical trigger.
- Staging migration history is intentionally composite and diverges from individual source filenames. **Do not blindly run `supabase db push` or replay old stages 10–17** against the test project.
- Do not deploy the public share Edge Function before the code-path signing guard from PR #56 is merged and independently verified on staging.

## Next safe step
Review the next group of inventory/profile migrations and the later finance trigger fix. Plan and test with disposable CI before asking for another scoped remote staging migration approval. Full two-account Auth and Storage integration remains a separate accepted test requirement.
