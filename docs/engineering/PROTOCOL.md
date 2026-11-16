# IMOBFY Engineering Protocol — v1 (2026-11-16)

**Mission:** turn IMOBFY into a trustworthy sales operating system for brokers and captadores. Business correctness, tenant isolation and user control outrank feature count or AI novelty.

## Source of truth

1. GitHub `luizoctaviocosta2000-collab/hello-again-hug`, `main` plus explicit feature branches.
2. Supabase production `zenzuialkjalkabenbtv`: **metadata/read-only inspection unless specifically approved otherwise**.
3. Supabase staging `etcdlxkpidiqbgdayiol`: read-only by default; schema/data writes need specific approval and safe fixtures.
4. CI workflows `.github/workflows/{build,journey-regression,receipt-security}.yml`; production UI and the Lovable editor are separately validated.
5. Earlier audit and handoff documents are historical evidence; re-check changing facts.

## One work item = one audited cycle

1. **Reproduce:** describe defect/opportunity, severity, exact refs/SQL/metrics, and observable wrong vs expected behavior. Confirm whether already fixed in `main`.
2. **Contract:** write a narrow target and non-goals; list touched files, affected data/API contracts, rollback, acceptance criteria, and permissions.
3. **Implement isolated:** use a short-lived branch from latest main, tight commits, no unrelated formatting. Don't mutate existing applied migrations; create new migrations with verified versioning.
4. **Verify locally:** unit/regression first; then full `bun run test`, `bun run typecheck`, `bun run build`; run targeted lint and explain existing debt. For SQL, PostgreSQL 17 and cross-user authorization tests.
5. **Validate integration:** in staging, real Supabase JWT/RLS, Edge Functions, Gemini, failure paths, concurrency, migration ordering; browser with authenticated fixtures at 390px and desktop. Mock tests don't count as real integrations.
6. **Deliver:** draft PR with changed files, commands, outputs, uncertainties, and release/rollback instructions. Never merge/deploy/publish without specific user authorization.

## Definition of done (distinct levels)

- **Implemented:** code committed, tests not necessarily passed.
- **Locally validated:** relevant automated tests, typecheck and build pass with any exceptions documented.
- **Staging homologated:** E2E with real authentication and infrastructure plus failure/permission paths, no unresolved P0/P1.
- **Approved for production:** human approval and verified migration/deployment order and rollback. Not synonymous with deployed.
- **Deployed and verified:** post-release smoke and logs reviewed separately.

## Safety policy

- Do not create/update/debit/pay/erase VGV, sales, commissions or receipts through generative AI.
- Finance: authoritative amounts/periods from database functions; receipt dates define cash. Keep existing configurable commission rules (typically 6% brokerage, 9% tax on brokerage, 20% or 10% participation) without hardcoding them into a changed flow.
- New exposed tables: RLS enabled and tenant-based policies; verify related-record ownership too. UPDATE policies need both `USING` and `WITH CHECK`. Avoid public callable privileged functions.
- SECURITY DEFINER functions must have fixed search_path and least-privilege EXECUTE. Financial RPC with `p_user_id` must validate `auth.uid() = p_user_id` in the same committed migration that exposes it.
- Never send client/owner contact details or addresses to Gemini unless explicitly approved and necessary. Redact PII from logs. Never put service-role key in frontend.
- WhatsApp/Instagram use official APIs; no outbound messaging before approved consent, opt-out, templates, handoff and rate/cost limits.
- GitHub `main` currently has no required status checks. Treat green CI and explicit merge approval as mandatory procedural gates; recommend branch protection when available.
- Respect the Lovable Git history warning in `AGENTS.md`.

## Severity and release sequence

- **P0:** cross-tenant exposure, auth bypass, financially unsafe writes, insecure staging rollout.
- **P1:** inconsistent sales/commission/receipts, corrupt money parsing, broken CRM workflow, real-user blocking errors.
- **P2:** AI sales assistant quality, automation, conversion analytics, design inconsistencies.
- **P3:** visual polish and optional enhancements.
- Never launch P2 automation on untrusted P0/P1 data.

## Required PR handoff template

- Baseline commit / working branch:
- Business outcome and affected journeys:
- Root cause and evidence:
- Files changed:
- Tests run with real outputs:
- Staging checks (or why not run):
- Data/credentials exposed?:
- Pending risks and constraints:
- Migration/deploy order and rollback:
- Required explicit approvals:
- Next smallest action:

## Testing debt

Existing CI executes Bun test, TypeScript, build, two PostgreSQL regression suites. It does **not** prove full Auth/Storage/PostgREST/Edge/Gemini E2E. Lint is not in the quality workflow; do not turn it on repository-wide before separating format-only debt from new regressions. Establish scoped lint first, then pay down baseline debt deliberately.
