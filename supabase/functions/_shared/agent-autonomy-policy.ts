/**
 * IMOBFY autonomous action policy — pure fail-closed decision engine.
 *
 * IMPORTANT: must run on the trusted backend with a policy fetched from the
 * current user's database row, authenticated provider bindings, fresh source
 * evidence and a durable idempotency/audit reservation. Never trust policy or
 * evidence objects received from the browser or the generative model.
 *
 * 'allow' authorizes a backend adapter to attempt an action; it NEVER claims
 * an API request or financial transaction was executed.
 */
export const agentDomains = ["ads", "atendimento", "comercial", "financeiro"] as const;
export type AgentDomain = typeof agentDomains[number];
export type ExecutionMode = "off" | "assisted" | "bounded";
export type DecisionVerdict = "deny" | "needs_approval" | "allow";

export interface AgentAutonomyPolicy {
  domain: AgentDomain;
  mode: ExecutionMode;
  emergencyStop: boolean;
  maxAdsDailyBudgetBrl: number;
  maxAdsBudgetChangePct: number;
  maxMessagesPerDay: number;
  maxMessagesPerContactPerDay: number;
  maxFollowupsPerDay: number;
  enablePreapprovedTransfers: boolean;
  maxTransferBrl: number;
  maxTransfersPerDayBrl: number;
}
export const DEFAULT_AGENT_AUTONOMY: Omit<AgentAutonomyPolicy, "domain"> = Object.freeze({
  mode: "off",
  emergencyStop: true,
  maxAdsDailyBudgetBrl: 0,
  maxAdsBudgetChangePct: 0,
  maxMessagesPerDay: 0,
  maxMessagesPerContactPerDay: 0,
  maxFollowupsPerDay: 0,
  enablePreapprovedTransfers: false,
  maxTransferBrl: 0,
  maxTransfersPerDayBrl: 0,
});

export type AgentActionKind =
  | "ads.pause" | "ads.resume" | "ads.adjust_budget" | "ads.change_creative"
  | "message.reply" | "message.template"
  | "crm.followup"
  | "finance.reconcile" | "finance.bank_transfer";

type BaseAction = { idempotencyKey: string; domain: AgentDomain; kind: AgentActionKind };
export type AgentAction =
  | (BaseAction & {domain: "ads"; kind: "ads.pause"; last7dClicks: number; last7dQualified: number; daysObserved: number; attributionVerified: boolean })
  | (BaseAction & {domain: "ads"; kind: "ads.resume"})
  | (BaseAction & {domain: "ads"; kind: "ads.adjust_budget"; previousDailyBudgetBrl: number; proposedDailyBudgetBrl: number; qualifiedLeads: number; daysObserved: number; attributionVerified: boolean})
  | (BaseAction & {domain: "ads"; kind: "ads.change_creative"})
  | (BaseAction & {domain: "atendimento"; kind: "message.reply" | "message.template"; optIn: boolean; optedOut: boolean; humanHandoff: boolean; within24h: boolean; approvedTemplate: boolean; contentPolicyPassed: boolean; sentToday: number; sentToContactToday: number})
  | (BaseAction & {domain: "comercial"; kind: "crm.followup"; clientExists: boolean; validTime: boolean; createdToday: number})
  | (BaseAction & {domain: "financeiro"; kind: "finance.reconcile"; providerWebhookSignatureVerified: boolean; matchedTransaction: boolean; amountMatches: boolean})
  | (BaseAction & {domain: "financeiro"; kind: "finance.bank_transfer"; amountBrl: number; transferredTodayBrl: number; beneficiaryPreapproved: boolean; bankMandateValid: boolean; balanceVerified: boolean; secondFactorOrDelegatedMandateValid: boolean });

export interface TrustedExecutionContext {
  actorAuthenticated: boolean;
  tenantBoundToProvider: boolean;
  providerConnected: boolean;
  auditReservationSucceeded: boolean;
  idempotencyKeyUnused: boolean;
  evidenceVerified: boolean;
  evidenceAgeMinutes: number;
  operatorPausedAll: boolean;
}

export interface AgentDecision {
  verdict: DecisionVerdict;
  code: string;
  reason: string;
  domain: AgentDomain;
  kind: AgentActionKind;
  humanApprovalRequired: boolean;
  recordedExecution: false;
}

const ACTION_DOMAIN: Record<AgentActionKind, AgentDomain> = {
  "ads.pause": "ads",
  "ads.resume": "ads",
  "ads.adjust_budget": "ads",
  "ads.change_creative": "ads",
  "message.reply": "atendimento",
  "message.template": "atendimento",
  "crm.followup": "comercial",
  "finance.reconcile": "financeiro",
  "finance.bank_transfer": "financeiro",
};
const validNonnegative = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;
const validPositive = (n: unknown) => validNonnegative(n) && (n as number) > 0;
const policyLimit = (n: unknown) => validNonnegative(n) && n <= 100000;

export function createDefaultPolicy(domain: AgentDomain): AgentAutonomyPolicy {
  return {...DEFAULT_AGENT_AUTONOMY, domain};
}

export function evaluateAgentAction(
  policy: AgentAutonomyPolicy,
  action: AgentAction,
  trusted: TrustedExecutionContext,
): AgentDecision {
  const result = (verdict: DecisionVerdict, code: string, reason: string): AgentDecision =>
    ({verdict, code, reason, domain: action.domain, kind: action.kind,
      humanApprovalRequired: verdict === "needs_approval", recordedExecution: false});
  const deny = (code:string, reason:string) => result("deny", code, reason);
  const review = (code:string, reason:string) => result("needs_approval", code, reason);

  if (!policy || !agentDomains.includes(policy.domain) || policy.domain !== action.domain ||
      ACTION_DOMAIN[action.kind] !== action.domain)
    return deny("DOMAIN_MISMATCH", "Ação ou especialista diferente da política autenticada.");
  if (policy.emergencyStop || trusted.operatorPausedAll)
    return deny("EMERGENCY_STOP", "Automação pausada pelo responsável.");
  if (policy.mode === "off")
    return deny("AUTOMATION_OFF", "Automação desligada nesta área.");
  if (policy.mode !== "assisted" && policy.mode !== "bounded")
    return deny("INVALID_MODE", "Modo de automação desconhecido.");
  if (!trusted.actorAuthenticated || !trusted.tenantBoundToProvider)
    return deny("UNVERIFIED_TENANT", "Não existe identidade e titularidade da integração comprovadas.");
  if (!trusted.auditReservationSucceeded || !trusted.idempotencyKeyUnused ||
      !/^[A-Za-z0-9][A-Za-z0-9:_.-]{11,159}$/.test(action.idempotencyKey))
    return deny("AUDIT_OR_REPLAY", "Sem reserva idempotente e trilha de auditoria não é possível executar.");
  if (!trusted.providerConnected)
    return deny("PROVIDER_NOT_CONNECTED", "A integração oficial da ação não está autenticada.");
  if (!trusted.evidenceVerified || !validNonnegative(trusted.evidenceAgeMinutes) ||
      trusted.evidenceAgeMinutes > 120)
    return deny("UNTRUSTED_EVIDENCE", "Os dados precisam de origem confirmada e atualização recente.");

  if (action.kind === "ads.pause") {
    if (!action.attributionVerified || !validNonnegative(action.last7dClicks) ||
        !validNonnegative(action.last7dQualified) || !validNonnegative(action.daysObserved))
      return deny("NO_VERIFIED_ATTRIBUTION", "Sem atribuição comprovada não pausamos campanha.");
    if (action.daysObserved < 5 || action.last7dClicks < 50 || action.last7dQualified !== 0)
      return review("INSUFFICIENT_EVIDENCE", "Amostra não sustenta pausa autônoma.");
  } else if (action.kind === "ads.adjust_budget") {
    if (!action.attributionVerified || !validPositive(action.previousDailyBudgetBrl) ||
        !validPositive(action.proposedDailyBudgetBrl) ||
        !validNonnegative(action.qualifiedLeads) || !validNonnegative(action.daysObserved) ||
        !policyLimit(policy.maxAdsDailyBudgetBrl) || !validNonnegative(policy.maxAdsBudgetChangePct))
      return deny("INVALID_AD_EVIDENCE", "Orçamento e resultados reais precisam estar válidos.");
    const pct = Math.abs(action.proposedDailyBudgetBrl / action.previousDailyBudgetBrl - 1) * 100;
    if (!validPositive(policy.maxAdsDailyBudgetBrl) || !validPositive(policy.maxAdsBudgetChangePct) ||
        action.proposedDailyBudgetBrl > policy.maxAdsDailyBudgetBrl + 0.001 ||
        pct > policy.maxAdsBudgetChangePct + 0.000001)
      return review("BUDGET_CAP", "A mudança ultrapassa os limites autorizados.");
    if (action.daysObserved < 5 || action.qualifiedLeads < 3)
      return review("LOW_SAMPLE", "Ainda faltam resultados comprovados para alterar o orçamento.");
  } else if (action.kind === "ads.resume" || action.kind === "ads.change_creative") {
    return review("CREATIVE_OR_RESTART_REVIEW", "Reativação e alteração criativa precisam de validação de política.");
  } else if (action.kind === "message.reply" || action.kind === "message.template") {
    if (!action.optIn || action.optedOut || action.humanHandoff || !action.contentPolicyPassed)
      return deny("MESSAGING_NOT_ELIGIBLE", "Consentimento, controle humano ou validação da mensagem impedem envio.");
    if (action.kind === "message.reply" && !action.within24h)
      return deny("MESSAGE_WINDOW_CLOSED", "Resposta livre somente dentro da janela de atendimento.");
    if (action.kind === "message.template" && !action.approvedTemplate)
      return deny("TEMPLATE_NOT_APPROVED", "Mensagem fora da janela exige modelo autorizado.");
    if (!validNonnegative(action.sentToday) || !validNonnegative(action.sentToContactToday) ||
        !Number.isSafeInteger(action.sentToday) || !Number.isSafeInteger(action.sentToContactToday))
      return deny("INVALID_MESSAGE_COUNTER", "Contadores de entrega inválidos.");
    if (!validPositive(policy.maxMessagesPerDay) || !validPositive(policy.maxMessagesPerContactPerDay) ||
        action.sentToday >= policy.maxMessagesPerDay ||
        action.sentToContactToday >= policy.maxMessagesPerContactPerDay)
      return review("MESSAGE_CAP", "Limite diário ou por contato atingido.");
  } else if (action.kind === "crm.followup") {
    if (!action.clientExists || !action.validTime || !Number.isSafeInteger(action.createdToday) ||
        action.createdToday < 0) return deny("INVALID_FOLLOWUP", "Cliente e horário devem estar confirmados.");
    if (!validPositive(policy.maxFollowupsPerDay) || action.createdToday >= policy.maxFollowupsPerDay)
      return review("FOLLOWUP_CAP", "Limite de follow-ups do dia atingido.");
  } else if (action.kind === "finance.reconcile") {
    if (!action.providerWebhookSignatureVerified || !action.matchedTransaction || !action.amountMatches)
      return deny("PAYMENT_NOT_VERIFIED", "Pagamento não comprovado por evento assinado e valor conciliado.");
  } else if (action.kind === "finance.bank_transfer") {
    if (!policy.enablePreapprovedTransfers || !action.beneficiaryPreapproved ||
        !action.bankMandateValid || !action.secondFactorOrDelegatedMandateValid ||
        !action.balanceVerified)
      return deny("BANK_AUTH_MISSING", "Transferência sem mandato, destinatário fixo e autenticação bancária válidos.");
    if (!validPositive(action.amountBrl) || !validNonnegative(action.transferredTodayBrl))
      return deny("INVALID_TRANSFER", "Valor da transferência inválido.");
    if (!validPositive(policy.maxTransferBrl) || !validPositive(policy.maxTransfersPerDayBrl) ||
        action.amountBrl > policy.maxTransferBrl ||
        action.amountBrl + action.transferredTodayBrl > policy.maxTransfersPerDayBrl)
      return review("TRANSFER_CAP", "Transferência fora do mandato financeiro pré-autorizado.");
  }

  if (policy.mode === "assisted")
    return review("ASSISTED_MODE", "A ação exige aprovação do responsável antes de ser enviada.");
  return result("allow","BOUNDED_AUTHORIZATION","Ação elegível para execução no adaptador oficial, dentro dos limites.");
}
