import {describe,expect,test} from "bun:test";
import {createDefaultPolicy,evaluateAgentAction,type AgentAction,type TrustedExecutionContext} from "../supabase/functions/_shared/agent-autonomy-policy";

const context: TrustedExecutionContext = {
  actorAuthenticated: true, tenantBoundToProvider: true, providerConnected: true,
  auditReservationSucceeded: true, idempotencyKeyUnused: true,
  evidenceVerified: true, evidenceAgeMinutes: 10, operatorPausedAll: false,
};
const adsPolicy = {...createDefaultPolicy("ads"),mode:"bounded" as const,emergencyStop:false,
  maxAdsDailyBudgetBrl:250,maxAdsBudgetChangePct:15};
const adsChange: AgentAction = {domain:"ads",kind:"ads.adjust_budget",idempotencyKey:"ads-change-20261118-a",
  previousDailyBudgetBrl:100,proposedDailyBudgetBrl:110,qualifiedLeads:4,daysObserved:7,attributionVerified:true};
const waPolicy = {...createDefaultPolicy("atendimento"),mode:"bounded" as const,
  emergencyStop:false,maxMessagesPerDay:40,maxMessagesPerContactPerDay:3};
const reply: AgentAction = {domain:"atendimento",kind:"message.reply",idempotencyKey:"reply-20261118-c",
  optIn:true,optedOut:false,humanHandoff:false,within24h:true,approvedTemplate:false,
  contentPolicyPassed:true,sentToday:2,sentToContactToday:1};
const financialPolicy = {...createDefaultPolicy("financeiro"),mode:"bounded" as const,emergencyStop:false,
  enablePreapprovedTransfers:true,maxTransferBrl:1000,maxTransfersPerDayBrl:2500};
const transfer: AgentAction = {domain:"financeiro",kind:"finance.bank_transfer",
  idempotencyKey:"transfer-20261118-c",amountBrl:600,transferredTodayBrl:500,
  beneficiaryPreapproved:true,bankMandateValid:true,balanceVerified:true,secondFactorOrDelegatedMandateValid:true};

describe("IMOBFY bounded autonomy — adversarial approval decisions",()=>{
  test("fails closed by default and with kill switch",()=>{
    expect(evaluateAgentAction(createDefaultPolicy("ads"),adsChange,context).code).toBe("EMERGENCY_STOP");
    expect(evaluateAgentAction({...adsPolicy,mode:"off"},adsChange,context).verdict).toBe("deny");
    expect(evaluateAgentAction(adsPolicy,adsChange,{...context,operatorPausedAll:true}).verdict).toBe("deny");
  });
  test("rejects forged tenant, missing connector and replay",()=>{
    expect(evaluateAgentAction(adsPolicy,adsChange,{...context,tenantBoundToProvider:false}).code).toBe("UNVERIFIED_TENANT");
    expect(evaluateAgentAction(adsPolicy,adsChange,{...context,providerConnected:false}).code).toBe("PROVIDER_NOT_CONNECTED");
    expect(evaluateAgentAction(adsPolicy,adsChange,{...context,idempotencyKeyUnused:false}).code).toBe("AUDIT_OR_REPLAY");
    expect(evaluateAgentAction(adsPolicy,adsChange,{...context,auditReservationSucceeded:false}).code).toBe("AUDIT_OR_REPLAY");
    expect(evaluateAgentAction(adsPolicy,adsChange,{...context,evidenceAgeMinutes:240}).code).toBe("UNTRUSTED_EVIDENCE");
  });
  test("does not let an agent borrow another department's authority",()=>{
    expect(evaluateAgentAction(createDefaultPolicy("financeiro"),adsChange,context).code).toBe("DOMAIN_MISMATCH");
    const forged = {...adsChange,domain:"financeiro"} as unknown as AgentAction;
    expect(evaluateAgentAction(financialPolicy,forged,context).code).toBe("DOMAIN_MISMATCH");
  });
  test("allows a verified small budget change and stops larger exposure",()=>{
    expect(evaluateAgentAction(adsPolicy,adsChange,context).verdict).toBe("allow");
    expect(evaluateAgentAction(adsPolicy,{...adsChange,proposedDailyBudgetBrl:400},context).code).toBe("BUDGET_CAP");
    expect(evaluateAgentAction(adsPolicy,{...adsChange,qualifiedLeads:0},context).code).toBe("LOW_SAMPLE");
    expect(evaluateAgentAction(adsPolicy,{...adsChange,attributionVerified:false},context).code).toBe("INVALID_AD_EVIDENCE");
    expect(evaluateAgentAction({...adsPolicy,mode:"assisted"},adsChange,context).verdict).toBe("needs_approval");
  });
  test("only permits ad pause with qualified evidence",()=>{
    const pause:AgentAction={domain:"ads",kind:"ads.pause",idempotencyKey:"ad-pause-20261118-a",
      last7dClicks:120,last7dQualified:0,daysObserved:7,attributionVerified:true};
    expect(evaluateAgentAction(adsPolicy,pause,context).verdict).toBe("allow");
    expect(evaluateAgentAction(adsPolicy,{...pause,last7dClicks:7},context).verdict).toBe("needs_approval");
    expect(evaluateAgentAction(adsPolicy,{...pause,last7dQualified:2},context).verdict).toBe("needs_approval");
    expect(evaluateAgentAction(adsPolicy,{...pause,attributionVerified:false},context).verdict).toBe("deny");
  });
  test("refuses unsolicited or unverified WhatsApp replies and respects opt-out",()=>{
    expect(evaluateAgentAction(waPolicy,reply,context).verdict).toBe("allow");
    expect(evaluateAgentAction(waPolicy,{...reply,optIn:false},context).code).toBe("MESSAGING_NOT_ELIGIBLE");
    expect(evaluateAgentAction(waPolicy,{...reply,optedOut:true},context).code).toBe("MESSAGING_NOT_ELIGIBLE");
    expect(evaluateAgentAction(waPolicy,{...reply,humanHandoff:true},context).code).toBe("MESSAGING_NOT_ELIGIBLE");
    expect(evaluateAgentAction(waPolicy,{...reply,contentPolicyPassed:false},context).code).toBe("MESSAGING_NOT_ELIGIBLE");
    expect(evaluateAgentAction(waPolicy,{...reply,within24h:false},context).code).toBe("MESSAGE_WINDOW_CLOSED");
    expect(evaluateAgentAction(waPolicy,{...reply,sentToContactToday:3},context).code).toBe("MESSAGE_CAP");
  });
  test("template messages require approved templates and consent",()=>{
    const temp:AgentAction={...reply,kind:"message.template",idempotencyKey:"template-20261118-c",within24h:false,approvedTemplate:true};
    expect(evaluateAgentAction(waPolicy,temp,context).verdict).toBe("allow");
    expect(evaluateAgentAction(waPolicy,{...temp,approvedTemplate:false},context).code).toBe("TEMPLATE_NOT_APPROVED");
  });
  test("commercial followups require a real client and daily limits",()=>{
    const policy={...createDefaultPolicy("comercial"),mode:"bounded" as const,emergencyStop:false,maxFollowupsPerDay:15};
    const action:AgentAction={domain:"comercial",kind:"crm.followup",idempotencyKey:"followup-20261118-c",
      clientExists:true,validTime:true,createdToday:2};
    expect(evaluateAgentAction(policy,action,context).verdict).toBe("allow");
    expect(evaluateAgentAction(policy,{...action,clientExists:false},context).verdict).toBe("deny");
    expect(evaluateAgentAction(policy,{...action,createdToday:15},context).verdict).toBe("needs_approval");
  });
  test("financial reconciliation must be backed by a signed provider receipt",()=>{
    const action:AgentAction={domain:"financeiro",kind:"finance.reconcile",idempotencyKey:"reconcile-20261118-c",
      providerWebhookSignatureVerified:true,matchedTransaction:true,amountMatches:true};
    expect(evaluateAgentAction(financialPolicy,action,context).verdict).toBe("allow");
    expect(evaluateAgentAction(financialPolicy,{...action,providerWebhookSignatureVerified:false},context).code).toBe("PAYMENT_NOT_VERIFIED");
    expect(evaluateAgentAction(financialPolicy,{...action,amountMatches:false},context).code).toBe("PAYMENT_NOT_VERIFIED");
  });
  test("requires bank mandate, preapproved payee and strict transfer limits",()=>{
    expect(evaluateAgentAction(financialPolicy,transfer,context).verdict).toBe("allow");
    expect(evaluateAgentAction(financialPolicy,{...transfer,beneficiaryPreapproved:false},context).code).toBe("BANK_AUTH_MISSING");
    expect(evaluateAgentAction(financialPolicy,{...transfer,bankMandateValid:false},context).code).toBe("BANK_AUTH_MISSING");
    expect(evaluateAgentAction(financialPolicy,{...transfer,amountBrl:1800},context).code).toBe("TRANSFER_CAP");
    expect(evaluateAgentAction(financialPolicy,{...transfer,transferredTodayBrl:2400},context).code).toBe("TRANSFER_CAP");
    expect(evaluateAgentAction({...financialPolicy,enablePreapprovedTransfers:false},transfer,context).verdict).toBe("deny");
  });
  test("an allow verdict is not an execution confirmation",()=>{
    const decision=evaluateAgentAction(adsPolicy,adsChange,context);
    expect(decision.recordedExecution).toBe(false);
    expect(decision.humanApprovalRequired).toBe(false);
  });
});
