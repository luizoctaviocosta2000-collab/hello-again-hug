import {
  evaluateAgentAction,
  type AgentAction,
  type AgentAutonomyPolicy,
  type AgentDecision,
  type TrustedExecutionContext,
} from "./agent-autonomy-policy.ts";

/**
 * Adapter boundary for *officially authorized* Meta/WhatsApp/CRM/bank providers.
 * None is bundled: an integration must prove tenant ownership, signatures,
 * consent, budgets and banking mandates before it can implement this contract.
 */
export interface AgentActionAdapter {
  execute(action: AgentAction, idempotencyKey: string): Promise<{providerRequestId: string}>;
}
export interface AgentAuditPort {
  /** Atomic INSERT with unique(user_id,idempotency_key); false on replay/failure. */
  reserve(action: AgentAction): Promise<boolean>;
  /** Server-only state transition, including provider result. */
  settle(action: AgentAction, state: "denied" | "requires_approval" | "executing" | "succeeded" | "failed",
    reasonCode: string, providerRequestId?: string): Promise<void>;
}
export interface AgentDispatchDependencies {
  audit: AgentAuditPort;
  adapter?: AgentActionAdapter;
}
export type DispatchOutcome = {
  status: "denied" | "requires_approval" | "executed" | "failed" | "requires_reconciliation";
  decision: AgentDecision;
  providerRequestId?: string;
};

export async function dispatchAgentAction(
  policy: AgentAutonomyPolicy,
  action: AgentAction,
  contextFromTrustedServer: Omit<TrustedExecutionContext, "auditReservationSucceeded" | "idempotencyKeyUnused">,
  dependencies: AgentDispatchDependencies,
): Promise<DispatchOutcome> {
  // Never call an adapter unless a durable unique audit reservation exists.
  let reserved = false;
  try {
    reserved = await dependencies.audit.reserve(action);
  } catch {
    reserved = false;
  }
  const decision = evaluateAgentAction(policy, action, {
    ...contextFromTrustedServer,
    auditReservationSucceeded: reserved,
    idempotencyKeyUnused: reserved,
  });

  if (!reserved) {
    return { status: "denied", decision };
  }

  if (decision.verdict !== "allow") {
    try {
      await dependencies.audit.settle(action,
        decision.verdict === "needs_approval" ? "requires_approval" : "denied", decision.code);
    } catch {
      return {status:"requires_reconciliation",decision};
    }
    return { status: decision.verdict === "needs_approval" ? "requires_approval" : "denied", decision };
  }

  // Missing provider integration ALWAYS fails closed (never a mock success).
  if (!dependencies.adapter) {
    try { await dependencies.audit.settle(action,"denied","NO_EXECUTION_ADAPTER"); }
    catch {return {status:"requires_reconciliation",decision};}
    return {status:"denied", decision};
  }

  // A failed transition could leave the same ID eligible in another worker.
  try { await dependencies.audit.settle(action,"executing","PROVIDER_DISPATCH_STARTED"); }
  catch { return {status:"requires_reconciliation",decision}; }

  try {
    const receipt = await dependencies.adapter.execute(action,action.idempotencyKey);
    if (!receipt?.providerRequestId || receipt.providerRequestId.length > 180)
      throw new Error("PROVIDER_RECEIPT_MISSING");
    try {
      await dependencies.audit.settle(action,"succeeded","PROVIDER_CONFIRMED",receipt.providerRequestId);
    } catch {
      // Side effect may have happened: do NOT retry blindly, require reconciliation.
      return {status:"requires_reconciliation",decision,providerRequestId:receipt.providerRequestId};
    }
    return {status:"executed",decision,providerRequestId:receipt.providerRequestId};
  } catch {
    try { await dependencies.audit.settle(action,"failed","PROVIDER_FAILED_OR_UNCONFIRMED"); }
    catch {return {status:"requires_reconciliation",decision};}
    return {status:"failed",decision};
  }
}
