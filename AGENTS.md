<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# IMOBFY: mandatory development contract

Read `docs/engineering/PROTOCOL.md` and `docs/engineering/STATUS-2026-11-16.md` before changing app, database, AI, or CI behavior. The current working truth is GitHub code plus Supabase metadata, not a prior chat report.

## Product and scope
- IMOBFY serves Brazilian real-estate brokers and property captadores. Preserve the existing captação → imóvel → cliente → negócio → visita → proposta → venda → comissão → VGV → recebimento journey.
- Make the smallest reversible change that solves the validated problem. Avoid cosmetic churn and new dependencies without a clear reason.
- Use the existing graphite/champagne design tokens. Keep mobile usability and accessibility.

## Safety and approvals
- **Never write to production Supabase, merge, deploy, publish, alter auth, or change paid ad campaigns without specific user approval for that action.**
- Work on a task branch; open a draft PR. Never force-push/rebase published branches tied to Lovable.
- Do not manipulate existing customer data to make a test pass. Use disposable accounts and fixtures in test environments.
- Do not rewrite applied historical migrations. In staging, apply connected dependent migrations atomically when an intermediate version would expose insecure functions. Review `docs/engineering/STAGING-SECURITY.md`.
- New tables in exposed schemas require RLS and owner-scoped policies. Check cross-account foreign references, SECURITY DEFINER grants, JWT identity, and storage paths.
- Secrets remain in managed environment variables; never commit keys, tokens, or customer PII.
- AI cannot invent financial metrics or directly write sales, commissions, VGV, or receipts; actions require human confirmation. No real messaging until the channel, handoff, consent, idempotency and cost boundaries are approved.

## Validation gates
- Before coding: record observed bug, target behavior, and tests to reproduce.
- For each change: relevant regression tests; `bun run test`, `bun run typecheck`, `bun run build`; lint only changed files until full lint debt is resolved.
- For database changes: disposable PostgreSQL tests, then Auth/RLS and owner-isolation checks in staging; run Supabase security advisors.
- For AI: mock-based tests **and** separately approved real-provider staging tests. For UI: authenticated desktop/mobile verification.
- A green CI/build is not equivalent to live integrated validation or authorization to deploy.
- Every handoff must state exact commit, branch, files, test evidence, unverified items and next action. 
