# IMOBFY staging — photo security and next migration wave (16 Nov 2026)

**Read-only staging baseline:** `imobfy-testes` at migration history version `20261116124049`, 10 entries total. The last entry bundles historical source stages 10–13. Production remains untouched.

## Source migration inventory after the finance bundle

| Order | Historical file | Purpose / release consideration |
| --- | --- | --- |
| 14 | `202610081341_imobfy_security_performance_hardening.sql` | Converts both financial RPCs to SECURITY INVOKER with explicit identity checks; verify table grants + RLS and positive own-user writes |
| 15 | `202610081500_imobfy_ai_conversations.sql` | Creates/replaces scoped policies; staging tables already exist, so verify no broad duplicate policies remain |
| 16 | `202610140001_property_photos.sql` | Creates private Storage bucket, photo metadata and RLS; its policy alone does not validate that the file path corresponds to the attached property |
| 17 | `202610150001_property_share_links.sql` | Creates owner-scoped share tokens and policies; public service-role signing must validate tenant/property |
| **Security guard** | `20261116130000_property_photo_tenant_boundary.sql` | **New, not yet applied:** composite tenant/property FKs, owner/path constraint, strengthened photo policy |
| 18 | `202610150002_properties_complete_capture_fields.sql` | Adds inventory fields and alias trigger |
| 19 | `202610150003_auto_generate_property_codes.sql` | Adds sequential per-user codes; test concurrency and existing values |
| 20 | `202610160001_fix_sale_proposal_commission_flow.sql` | Overrides closing and commission triggers; a legacy fallback may generate captação on a sale-only operation. Require an explicit-sides correction before enabling sales |
| 21 | `202610160002_profile_whatsapp_contact.sql` | Adds optional WhatsApp field |
| 22 | `202610190001_sync_profile_name_fields.sql` | Changes profile trigger; verify Auth signup in real staging |
| 23 | `202610190002_ai_daily_quotas.sql` | Creates quota table/function with JWT check and restricted grants |
| 24 | `20261022133523_harden_commission_receipt_ownership.sql` | Composite receipt owner FK and receipt integrity; **contains explicit BEGIN/COMMIT** |
| 25 | `20261022182211_atomic_visit_journey.sql` | Atomic visit RPCs, stage guard and grants; **contains explicit BEGIN/COMMIT** |

The ordinal numbers above are conceptual source steps, **not** database migration history versions. Do not run old steps 10–13 individually against current staging.

## Photo/share risk and fix

The public `imobfy-property-share` Edge Function uses a service-role client to sign Storage URLs from photo rows. Because service-role bypasses RLS, the app now validates:

1. Share token points to a property with `properties.user_id = property_share_links.user_id`.
2. Photo query filters both `property_id` and `user_id`.
3. Each photo row and its object path match **the same** user and property. Only exactly `userUUID/propertyUUID/randomUUID.(jpg|jpeg|png|webp|avif)` is eligible for signing.
4. Database constraints prevent user/photo and share-link foreign-property relationships even for privileged writes and reject malformed Storage paths.

## Validation performed (local disposable database only)

- [Property photo tenant CI](https://github.com/luizoctaviocosta2000-collab/hello-again-hug/actions/runs/43875129880) passed; replays original photo + share migrations, applies new migration, and checks:
  - legitimate photo/upload metadata and share-link writes,
  - cross-user object path and same-owner wrong-property object path rejection,
  - property/photo/share cross-tenant foreign keys,
  - RLS isolation for two synthetic user identities.
- Bun tests cover the path validation in the shared Edge helper. Typecheck and build also passed in the updated workflow.
- No Supabase Auth/Storage/Edge Functions were called or deployed in these tests. Real signed URL behavior remains unverified.

## Prerequisites before remote staging rollout

- Obtain **separate explicit approval** for applying the next wave of migrations to `imobfy-testes`; approval for source steps 10–13 did not include these changes.
- Preflight the public `properties(id,user_id)` uniqueness and exact schema. Staging currently lacks a composite unique owner index, which the new migration creates.
- Apply historical photo/share migrations and this security guard in one Supabase-managed transaction, **before** publishing the public-share Edge Function. Exclude nested `BEGIN/COMMIT` from managed migrations.
- If existing photos are present in any future environment, inventory their path patterns before applying the strict check; this migration intentionally fails rather than rewriting/deleting records.
- Do not apply the historical commission trigger override without a reviewed follow-up correction and regression test covering sale-only, capture-only, both and splits.
- Do not merge either PR or deploy live Edge Functions without owner approval.

## Remaining release verification

Real two-user Supabase Auth sessions, PostgREST RLS, Storage signed URLs, property public-sharing GET, delete/update and real UI integration are still pending. Do not advertise the photo feature or the full CRM as homologated yet.
