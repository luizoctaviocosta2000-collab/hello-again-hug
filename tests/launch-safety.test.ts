import { expect, test } from "bun:test";
import { createMetaAdsAdapter } from "../supabase/functions/_shared/agent-provider-adapters";
import { dispatchAgentAction } from "../supabase/functions/_shared/agent-autonomy-dispatch";
import {
  createDefaultPolicy,
  type AgentAction,
} from "../supabase/functions/_shared/agent-autonomy-policy";

const action: AgentAction = {
  domain: "ads",
  kind: "ads.adjust_budget",
  idempotencyKey: "audit-budget-20261118",
  previousDailyBudgetBrl: 100,
  proposedDailyBudgetBrl: 110,
  qualifiedLeads: 5,
  daysObserved: 7,
  attributionVerified: true,
};
for (const currency of ["USD", undefined]) {
  test(`budget mutation refuses account currency ${currency}`, async () => {
    let writes = 0;
    const network = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") writes++;
      const accountRequest = String(input).includes("/act_123456789?");
      return Response.json(
        accountRequest
          ? { id: "act_123456789", currency }
          : { id: "345678900", account_id: "123456789", daily_budget: writes ? "11000" : "10000" },
      );
    }) as typeof fetch;
    const adapter = createMetaAdsAdapter(
      {
        token: "synthetic-provider-token-never-live",
        adAccountId: "123456789",
        adsetId: "345678900",
      },
      network,
    );
    await expect(adapter.execute(action, action.idempotencyKey)).rejects.toThrow(
      "META_ACCOUNT_CURRENCY_UNSUPPORTED",
    );
    expect(writes).toBe(0);
  });
}
test("timeout after a possible side effect requires reconciliation, never a retryable failure", async () => {
  const states: string[] = [];
  const result = await dispatchAgentAction(
    {
      ...createDefaultPolicy("ads"),
      mode: "bounded",
      emergencyStop: false,
      maxAdsDailyBudgetBrl: 200,
      maxAdsBudgetChangePct: 20,
    },
    action,
    {
      actorAuthenticated: true,
      tenantBoundToProvider: true,
      providerConnected: true,
      evidenceVerified: true,
      evidenceAgeMinutes: 1,
      operatorPausedAll: false,
    },
    {
      audit: {
        reserve: async () => true,
        settle: async (_action, state) => {
          states.push(state);
        },
      },
      adapter: {
        execute: async () => {
          throw new Error("Response lost after provider accepted the operation");
        },
      },
    },
  );
  expect(result.status).toBe("requires_reconciliation");
  expect(states).toEqual(["executing", "executing"]);
});
