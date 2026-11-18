# IMOBFY Intelligence Foundation — 18 Nov 2026

## Product contract

This is a **human-controlled foundation** for Atendimento Inteligente and Ads Intelligence. No paid campaign change, WhatsApp/Instagram outbound message, or Meta Conversions API upload is enabled. Those require official channel/account onboarding, consent, token storage, failure retries, privacy review and separate release approval. Never represent the result as fully automated.

## Atendimento Inteligente

- /atendimento: authenticated first-party inbox for manual customer notes, selected CRM client/property, ordered messages and human handoff/pause status
- Gemini draft button uses existing `imobfy-attendance-simulate` (from prior unmerged PR #54), with explicit owner-scoped property read, sanitization and deterministic negotiation/handoff rules
- Drafts are internal only, and can be copied or saved for human review; no posting to customers; no automatic lead or financial writes
- Separate simulator tab for rehearsing objections without saving to the CRM
- Migration `imobfy_attendance_threads` and `imobfy_attendance_messages` uses Auth/RLS and composite owner-tenant FKs to clients/properties/threads. Web browser may create only manual-source data

## Ads Intelligence

- /ads: authenticated dashboard for **actual user-provided** spend, clicks and impression daily reports; actual user-confirmed stages tied to CRM client and campaign
- Calculates CPL, cost per qualified lead, cost per visit and sale, all **null** without a denominator, never invents campaign attribution, refuses ambiguous ad accounts and deduplicates client/stage/campaign
- Deterministic, explainable diagnostic suggestions; no pause, scale or budget changes
- Migration `imobfy_ads_daily_metrics` and append-only `imobfy_ads_funnel_events` with owner RLS, composite CRM ownership and unique event keys; Meta-source writes cannot be forged from browser
- Meta Marketing API Ads Insights and Conversions API architecture is only prepared, not remotely connected. Real ad metrics ingestion must use scoped authorized token stored on server. CAPI requires correctly consented/honest events, event IDs, retries and idempotence.

## Security / activation

New tables use RLS, least-privilege grants, no SECURITY DEFINER, owner-scoped composite foreign keys, and browser roles that cannot spoof external provider source. New tables absent from production until separately reviewed and migrated; UI displays **not installed**, not fake stats.

Release gates:
1. Bun tests, TypeScript, full build, PostgreSQL migration regression with two synthetic authenticated users.
2. Run migration only in `imobfy-testes`, verify RLS and grants, then real JWT/PostgREST and Gemini requests.
3. Add official WhatsApp/Instagram webhook signature verification, source mapping, consent/opt-out and reply window policies. Message sending remains disabled before this.
4. Add Meta OAuth with least privilege, encrypted account credentials stored server-side, GET /insights ingestion, deterministic attribution and CAPI outbox, with opt-in and delivery statuses.
5. Lovable deploy freshness check must pass; currently failed as of Nov 18 even when app builds.

## Sources of truth

- [Meta Marketing API Insights](https://developers.facebook.com/docs/marketing-api/insights)
- [Meta Conversions API Parameters](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters)
- [Meta WhatsApp Webhook Validation](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/)

## Caveats

- Campaign spend manual input and CRM conversion stages are not verified automatically; UI clearly labels them as manually recorded.
- The dashboard's cohort uses event occurrence date, not ad impression attribution windows: results **do not** match Meta Ads Manager attribution until Ads Insights and CAPI integration is validated.
- Do not assume event-to-campaign relationship unless recorded; manual attribution is evidence supplied by the operator, not independent proof.
- Do not ship automatic chat replies, financing promises, ad stop/scale or financial changes.
