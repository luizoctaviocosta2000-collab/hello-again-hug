# Execution contract — 19 November 2026

Baseline main: `5ab8d2e9083f5a505725d96a7fd66b1c1977563a`.
Branch: `feat/imobfy-operational-integrations-20261119`.

Observed before changes:
- General chat has a separate Gemini transport that returns raw provider errors to the caller and logs them; assistant-message persistence errors are ignored.
- Attendance history treats unapproved drafts as messages sent to the customer and removes the last entry rather than locating the last customer question.
- Gemini transport accepts blocked, empty or truncated successful HTTP responses.
- Official adapters exist, but no operational connection/Insights reader or signed webhook ingress exists.
- No Gemini, Meta, Supabase or staging A/B credentials available in this process.
- Public release marker currently reports the exact baseline SHA, `build-versioned`, source `git`. This proves the marker matches main, not Auth/provider operation.

Target: bounded provider responses and safe diagnostics; accurate draft context;
server-only tenant-bound official read connector; signed durable webhook ingress.
External writes remain gated by the existing autonomy contract. No historical
migration is rewritten. Regression tests must distinguish simulated responses
from actual official-provider validation.

Verification: Bun tests/typecheck/build, changed-file lint, Edge compilation,
SQL isolation where runtime available. Real staging/Auth/provider tests require
credentials and are separately reported, never inferred from unit tests.
Rollback: revert this branch's application changes; any new schema remains
undeployed until reviewed, tested and specifically approved.
