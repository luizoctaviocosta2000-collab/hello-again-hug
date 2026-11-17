# IMOBFY — inventory, proposal, commission and profile wave (prepared 2026-11-16)

**Historical preparation snapshot.** This wave was **subsequently applied** to `imobfy-testes` on 16 Nov 2026, migration `20261116142621`. For current evidence and limitations see [STAGING-EXECUTION-WAVE-18-22-2026-11-16.md](STAGING-EXECUTION-WAVE-18-22-2026-11-16.md). **Do not reapply.**

## Scope
Prepare the next historical sources in a single atomic migration *after* the previously applied
`20261116134906_imobfy_staging_14_17_secure_ai_photos_sharing` composite:

1. `202610150002_properties_complete_capture_fields.sql`: property capture fields and address aliases.
2. `202610150003_auto_generate_property_codes.sql`: per-user sequential property codes.
3. `20261116142000_property_code_unbounded_width.sql`: **new fix**, replaces a 3-character `lpad` that truncates code `IMB-1000` to `IMB-100`. Keeps `IMB-001` through `IMB-999`; does not rewrite existing properties.
4. `202610160001_fix_sale_proposal_commission_flow.sql`: accepted-proposal deal closing and commission generator.
5. `20261116134000_respect_explicit_sale_commission_sides.sql`: exact SQL from PR #57, restores the user's explicit sale-vs-capture selection immediately after the original function; no exposure window.
6. `202610160002_profile_whatsapp_contact.sql`: profile contact field.
7. `202610190001_sync_profile_name_fields.sql`: profile name synchronization and Auth-user trigger.

The source files remain unchanged. The two new corrections are versioned, explicit and testable.
Because the current staging migration history is composite, **do not replay the earlier historical migrations**.

## Preflight (read-only, passed)
- Project `imobfy-testes` (`etcdlxkpidiqbgdayiol`), with 11 migration records ending in composite stages 14–17.
- Prior owner protections: `property_photos`, `property_share_links`, finance RPC and RLS present.
- No `generate_property_code` or `sync_profile_names` function yet; no Auth users, properties, deals, sales or commissions.
- All 20 public tables have RLS.
- This snapshot is a strict starting condition and must be checked **again** before any authorized write.

## Synthetic integration evidence
[CI on PR #59](https://github.com/luizoctaviocosta2000-collab/hello-again-hug/actions/runs/43884114189) **passed** in disposable PostgreSQL 17:
- Rebuilt finance and security stages 10–17 from their reviewed source components.
- Applied stages 18–22 plus both corrective SQL files as one SQL transaction.
- Two fictitious Auth users created separate profiles with synchronized full_name/name values.
- Inventory codes were unique per user (A: `IMB-001`/`IMB-002`, B: `IMB-001`), address aliases synced.
- Explicit check covered a synthetic `IMB-999` record followed by insertion of `IMB-1000` without truncation, and rolled back the high-number fixture.
- Closing a deal **without** an accepted proposal was rejected; a legitimate accepted proposal produced exactly one linked sale.
- Sale-only, sale+capture, sale split and capture split generated correct counts and monetary amounts, without unintended captação; VGV rows matched sales.
- Bun tests, TypeScript and production build passed.

The first two CI attempts had incomplete **disposable test fixtures** (proposal amount and unique sales.deal_id) and were corrected to match the real staging schema before the fully successful run. The historical migrations themselves were applied successfully in those attempts.

## Scope limits and risks
- **After this preparation document:** the user authorized staging-only execution; it succeeded, and staging now has 12 migration entries. No users or business rows were created. Production remained untouched.
- No real authenticated browser/API sessions, WhatsApp, Storage uploads or Gemini integration certified.
- The migration `202610190002_ai_daily_quotas.sql` and later receipts, visit lifecycle and security hardening are **not included** here; they require their own ordered review.
- Duplicate direct-sale submissions with null deal ID and replay/idempotency are still open. This corrected commission-type selection, not every money integrity issue.
- Existing historical production data (including properties with 999+ codes) require separate backfill/compatibility assessment. The staging preflight requires an empty environment.
- The SQL source `20261116134000_respect_explicit_sale_commission_sides.sql` is identical to PR #57; PR #59 is stacked on #58, and eventual merges must reconcile this duplicate file rather than applying it twice.
- Before deployment, verify that migration executor owns one atomic transaction; generate its `--managed` bundle without top-level `BEGIN/COMMIT`.
- Explicit authorization to apply this exact wave to `imobfy-testes` was received and used once; further writes require a distinct scope. **Production, merge, publish and real messaging are out of scope**.

## Next safe operation
With approval for this exact test environment, re-read migrations, RPCs, trigger presence, and all fixture counts. Apply the single approved composed migration only after CI review, then re-read catalogs, advisor notices and run negative role-level SQL checks. Positive real-user Auth/API E2E remains a separate acceptance gate.
