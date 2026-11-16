# IMOBFY — explicit commission-side regression (16 Nov 2026)

## Business rule (based on the existing application's explicit selectors)

When a sale is registered with selected sides, the financial trigger must generate only those commission components:

| Selected side(s) | Commissions generated | Synthetic R$ 500,000 property, 6% brokerage, 9% brokerage tax |
| --- | --- | --- |
| `sale` | venda only | R$ 5,460 |
| `capture` | captação only, if an active own capture exists | R$ 5,460 |
| `sale,capture` | both | R$ 10,920 total |
| `sale_split` | venda only, 10% participation | R$ 2,730 |
| `capture_split` | captação only, 10% participation | R$ 2,730 |
| `sale_split,capture_split` | both split portions | R$ 5,460 total |
| empty deal-side array, sale defaults | venda only | R$ 5,460 |

These amounts are **fixtures**, not production figures. The actual function uses configured percentages from `public.profiles` and active `public.captures`, not these constants.

## Reproduced defect

Historical migration `202610160001_fix_sale_proposal_commission_flow.sql` redefines `generate_sale_commission()` so a capture commission is always generated when `has_explicit_sides = false`, even for a direct sale with `commission_sides=['sale']`. This contradicts the user's explicit selection.

The PostgreSQL 17 disposable regression:
1. Reconstructs finance stages 10–13 from the versioned historical files.
2. Applies the **historical** October commission trigger.
3. Registers a synthetic direct sale explicitly marked sale-only; **observes two commissions** (sale and capture), proving the old defect.
4. Rolls back the synthetic reproducer.
5. Applies new, unapplied migration `20261116134000_respect_explicit_sale_commission_sides.sql`, removing only the unconditional capture fallback.
6. Verifies 9 sales produce exactly 11 correctly typed commission entries, plus VGV entries, across seven commission scenarios and direct/deal contexts.
7. Verifies the privileged trigger remains uncallable directly by anonymous/authenticated roles.

[GitHub Actions regression](https://github.com/luizoctaviocosta2000-collab/hello-again-hug/actions/runs/43876236630) completed successfully. Bun tests, TypeScript and build ran and passed in the same workflow.

## Release constraints

- The migration exists in a separate **draft PR #57** stacked on the unmerged protocol PR #55. It was **not applied** to Supabase staging or production.
- The migration must follow `202610160001_fix_sale_proposal_commission_flow.sql` in a single reviewed staging upgrade sequence, so no externally accessible interval allows extra captação.
- Test positive operations with two real Supabase Auth users and role/RLS permissions; local `set_config('request.jwt.claim.sub')` is only a simulation.
- Production-specific uniqueness of commissions per deal and historical records have not been reconciled. Do not adjust any existing records automatically.
- A requested `capture` without a qualifying active capture, duplicate direct-sale submissions, non-finite values, and modification of historical commissions are **separate open defects/decisions**.
- Do not change configured tax/participation percentages without explicit business approval. This fix deliberately preserves the existing 10% split calculation.
