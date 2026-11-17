# IMOBFY — real Auth / PostgREST staging homologation

## Why

Previous staging SQL tests simulated `request.jwt.claim.sub`. That is **not** a user session issued by Supabase Auth or an HTTP Data API contract test. The script `scripts/staging/auth_http_homologation.py` tests real password-based Auth sessions, PostgREST row ownership and the visit RPC.

## Safety contract

- Hard-coded host: `https://etcdlxkpidiqbgdayiol.supabase.co` (**staging only**); production URL is not configurable.
- Never use real customer credentials. Create **two disposable confirmed Auth accounts** in `imobfy-testes` by the supported Auth API/Admin flow, rather than inserting fake rows directly into `auth.users`.
- Two logins must be distinct. No service role access or service-role key is required or accepted.
- Script runs only when `IMOBFY_E2E_CONFIRM_STAGING=1`; `--check` is a zero-network, zero-write dry check in CI.
- Real run creates randomly named/identified temporary property, client, visit, and attempts a cross-owner insert; verifies read/write restrictions and completion. `finally` deletes only these UUIDs.
- If cleanup fails, the script shows **only fixture UUIDs** for manual follow-up, never access tokens or passwords.
- Never commit test passwords or access keys, put them into console output, or run the script against a Lovable/production account.

## Required protected environment variables

```text
IMOBFY_E2E_CONFIRM_STAGING=1
IMOBFY_STAGING_PUBLISHABLE_KEY=<staging public/anon API key>
IMOBFY_STAGING_USER_A_EMAIL=<disposable confirmed email>
IMOBFY_STAGING_USER_A_PASSWORD=<password>
IMOBFY_STAGING_USER_B_EMAIL=<second disposable confirmed email>
IMOBFY_STAGING_USER_B_PASSWORD=<password>
```

Run `python3 scripts/staging/auth_http_homologation.py` in an authorized environment that can reach the Supabase staging HTTP APIs. No network is available in the current local execution environment, so the script **has not been run end to end** as of this writing.

## Acceptance gates

1. Both users obtain **real** access tokens and `/auth/v1/user` returns distinct IDs.
2. Tenant A creates a property and client; only A can read its property.
3. Tenant B's attempt to insert a property owned by A is rejected; no residual foreign row remains.
4. Tenant A creates, completes and retries a visit via RPC; stored status is `completed` in staging.
5. Tenant B cannot complete or read A's visit.
6. Created fixture rows are cleaned. Check **Auth user credentials separately**; this runner deliberately never deletes Auth users.
7. Only after this passes, validate Storage uploads, signing, actual Gemini Edge calls, browser/mobile UI, and the Lovable build/publish pipeline.

## Publication boundaries

GitHub branches and approved CI **do not** by themselves publish a Lovable application. The Lovable account's project `164569e4-d960-4f0e-a3bb-4d5609dc50f3` must be connected to an actionable publishing integration or opened in an environment that allows publishing. Review Lovable preview/build errors before choosing Publish. Never merge staging-only SQL into production migration history; staging and production have **different** historical migration versions and different visit status constraints.
