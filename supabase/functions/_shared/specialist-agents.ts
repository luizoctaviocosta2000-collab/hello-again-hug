/**
 * Read-only specialist agent contract. Deterministic numbers and recommendations
 * are calculated from already RLS-scoped CRM rows; Gemini never supplies metrics.
 * No side-effect commands, IDs, client contacts or owner details leave this module.
 */
export const specialistKinds = ["ads", "atendimento", "comercial", "financeiro"] as const;
export type SpecialistKind = typeof specialistKinds[number];
export type AgentRow = Record<string, unknown>;
export type AgentMetric = { label: string; value: string };
export type AgentRecommendation = { title: string; reason: string; priority: "alta" | "media"; requiresApproval: true };
export type AgentReport = {
  agent: SpecialistKind;
  generatedAt: string;
  mode: "regras" | "gemini";
  coverage: "sem_dados" | "amostra" | "com_dados";
  sources: string[];
  metrics: AgentMetric[];
  recommendations: AgentRecommendation[];
  briefing?: string;
  notice: string;
};
export type AgentData = {
  metrics?: AgentRow[];
  events?: AgentRow[];
  threads?: AgentRow[];
  messages?: AgentRow[];
  deals?: AgentRow[];
  visits?: AgentRow[];
  commissions?: AgentRow[];
  receipts?: AgentRow[];
  vgv?: AgentRow[];
};

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const count = (v: number) => v.toLocaleString("pt-BR");
const value = (v: unknown) => {
  const n = typeof v === "number" || typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const shortDate = (d: Date) => d.toISOString().slice(0, 10);
const rec = (title: string, reason: string, priority: "alta" | "media" = "media"): AgentRecommendation =>
  ({ title, reason, priority, requiresApproval: true });
const mk = (label: string, valueText: string): AgentMetric => ({ label, value: valueText });
const activeDeal = (x: AgentRow) => !["closed", "lost", "fechado_ganho", "fechado_perdido"].includes(String(x.status));

export function isSpecialistKind(input: unknown): input is SpecialistKind {
  return typeof input === "string" && (specialistKinds as readonly string[]).includes(input);
}

/** Only a short, non-numeric qualitative paragraph may come from the model. */
export function parseSpecialistBriefing(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const text = (parsed as { briefing?: unknown }).briefing;
    if (typeof text !== "string") return null;
    const cleaned = text.trim();
    if (cleaned.length < 12 || cleaned.length > 700) return null;
    if (/\d|https?:\/\/|@|[<>]/.test(cleaned)) return null;
    return cleaned;
  } catch { return null; }
}

export function buildSpecialistReport(
  agent: SpecialistKind,
  data: AgentData,
  now: Date = new Date(),
  truncated = false,
): AgentReport {
  const ago30 = new Date(now.getTime() - 30 * 86400000);
  const last30 = shortDate(ago30);
  const sourceNames: Record<SpecialistKind, string[]> = {
    ads: ["Gastos e impressões lançados no IMOBFY", "Etapas vinculadas ao CRM"],
    atendimento: ["Conversas internas e respectivos estados", "Quantidade de rascunhos e perguntas"],
    comercial: ["Negócios e etapas do CRM", "Agenda de visitas"],
    financeiro: ["Comissões, VGV e recebimentos registrados"],
  };
  const report: AgentReport = {
    agent,
    generatedAt: now.toISOString(),
    mode: "regras",
    coverage: "sem_dados",
    sources: sourceNames[agent],
    metrics: [],
    recommendations: [],
    notice: "Análise interna, sem executar mensagens, anúncios, vendas ou movimentações financeiras.",
  };
  if (agent === "ads") {
    const rows = (data.metrics || []).filter(r => String(r.report_date || "") >= last30 && String(r.report_date || "") <= shortDate(now));
    const accounts = new Set(rows.map(r => String(r.ad_account_id) + ":" + String(r.campaign_id)));
    const eventKeys = new Set<string>();
    const attributed = { lead: 0, qualificado: 0 };
    for (const event of data.events || []) {
      if (!event.ad_account_id || !event.campaign_id || (!event.client_id && !event.deal_id)) continue;
      if (String(event.occurred_at || "").slice(0, 10) < last30) continue;
      if (String(event.occurred_at || "").slice(0, 10) > shortDate(now)) continue;
      const key = String(event.ad_account_id) + ":" + String(event.campaign_id);
      if (!accounts.has(key)) continue;
      const stage = String(event.stage);
      if (stage !== "lead" && stage !== "qualificado") continue;
      const identifier = key + ":" + stage + ":" + String(event.client_id || event.deal_id);
      if (eventKeys.has(identifier)) continue;
      eventKeys.add(identifier);
      attributed[stage] += 1;
    }
    const spend = rows.reduce((sum,r) => sum + value(r.spend_brl), 0);
    const clicks = rows.reduce((sum,r) => sum + value(r.clicks), 0);
    report.metrics = [
      mk("Investimento informado (30 dias)", money(spend)),
      mk("Cliques registrados (30 dias)", count(clicks)),
      mk("Leads vinculados", count(attributed.lead)),
      mk("Leads qualificados", count(attributed.qualificado)),
      mk("Custo por lead vinculado", attributed.lead ? money(spend / attributed.lead) : "Sem base"),
    ];
    if (rows.length === 0) report.recommendations.push(rec("Registrar campanhas reais", "Não há gastos no período. Sem isso, não é possível comparar custo e qualidade de leads."));
    else if (clicks >= 30 && attributed.lead === 0) report.recommendations.push(rec("Revisar a origem dos contatos", "Há cliques registrados, mas nenhum lead com origem de campanha confirmada.", "alta"));
    else if (attributed.lead >= 5 && attributed.qualificado === 0) report.recommendations.push(rec("Investigar qualidade dos leads", "Leads foram vinculados, mas nenhum avançou à qualificação.", "alta"));
    else report.recommendations.push(rec("Comparar campanhas pelo funil", "Priorize campanhas com origem e qualificação confirmadas, não apenas quantidade de cliques."));
    report.coverage = rows.length ? "com_dados" : "sem_dados";
    report.notice = "Métricas informadas no CRM, não importadas nem atribuídas automaticamente pela Meta. Nenhum anúncio será alterado.";
  } else if (agent === "atendimento") {
    const threads = data.threads || [], msgs = data.messages || [];
    const open = threads.filter(r => r.status === "open").length;
    const handoff = threads.filter(r => r.status === "handoff").length;
    const waiting = threads.filter(r => r.status === "paused").length;
    const drafts = msgs.filter(r => r.role === "assistant_draft").length;
    report.metrics = [
      mk("Conversas internas", count(threads.length)),
      mk("Conversas abertas", count(open)),
      mk("Encaminhadas ao corretor", count(handoff)),
      mk("Pausadas", count(waiting)),
      mk("Rascunhos salvos", count(drafts)),
    ];
    if (!threads.length) report.recommendations.push(rec("Iniciar atendimento assistido", "Cadastre uma conversa e associe o imóvel antes de usar o rascunho de IA."));
    else if (handoff) report.recommendations.push(rec("Priorizar repasses humanos", "Existem atendimentos marcados para acompanhamento do corretor.", "alta"));
    else if (waiting) report.recommendations.push(rec("Revisar conversas pausadas", "Há conversas sem atendimento ativo; avalie o momento correto de retomá-las."));
    else report.recommendations.push(rec("Revisar objeções recorrentes", "Use perguntas registradas e respostas revisadas para melhorar o roteiro da equipe."));
    report.coverage = threads.length ? "com_dados" : "sem_dados";
    report.notice = "Somente registros internos. Sem conexão de entrada ou envio com WhatsApp/Instagram.";
  } else if (agent === "comercial") {
    const deals = data.deals || [], visits = data.visits || [];
    const active = deals.filter(activeDeal);
    const stalled = active.filter(r => {
      const t = Date.parse(String(r.updated_at || r.created_at || ""));
      return Number.isFinite(t) && now.getTime() - t >= 7 * 86400000;
    });
    const coming = visits.filter(r => {
      const t = Date.parse(String(r.starts_at || ""));
      return Number.isFinite(t) && t >= now.getTime() && t <= now.getTime()+7*86400000
        && !["cancelled","canceled","done","completed"].includes(String(r.status));
    });
    report.metrics = [
      mk("Negócios em aberto", count(active.length)),
      mk("Sem atualização há 7+ dias", count(stalled.length)),
      mk("Visitas nos próximos 7 dias", count(coming.length)),
      mk("Negócios fechados (base consultada)", count(deals.filter(r => r.status === "closed").length)),
    ];
    if (!deals.length) report.recommendations.push(rec("Registrar a jornada comercial", "Ainda não há negócios para classificar por etapa ou tempo sem contato."));
    else if (stalled.length) report.recommendations.push(rec("Retomar negócios parados", "Há negócios abertos sem atualização há pelo menos sete dias.", "alta"));
    else if (coming.length) report.recommendations.push(rec("Preparar visitas e pós-visita", "Há visitas futuras que merecem confirmação humana e acompanhamento."));
    else report.recommendations.push(rec("Revisar próximos passos do pipeline", "As etapas registradas podem orientar novas ações de contato."));
    report.coverage = deals.length ? "com_dados" : "sem_dados";
    report.notice = "Não confirma visitas nem propostas automaticamente. Requer revisão do corretor.";
  } else {
    const commissions = data.commissions || [], receipts = data.receipts || [], vgv = data.vgv || [];
    const byCommission = new Map<string,number>();
    for (const r of receipts) {
      const key = String(r.commission_id || "");
      byCommission.set(key, (byCommission.get(key)||0) + Math.round(value(r.amount)*100));
    }
    const totalCents = commissions.reduce((n,c) => n+Math.round(value(c.user_amount)*100), 0);
    const vgvCents = vgv.reduce((n,row)=>n+Math.round(value(row.vgv)*100),0);
    const pendingCents = commissions.reduce((n,c) => n+Math.max(0, Math.round(value(c.user_amount)*100)-(byCommission.get(String(c.id))||0)), 0);
    const receivedCents = receipts.reduce((n,r)=>n+Math.round(value(r.amount)*100), 0);
    const monthReceiptsCents = receipts.filter(r => String(r.received_at || "").slice(0,10) >= last30)
      .reduce((n,r)=>n+Math.round(value(r.amount)*100), 0);
    report.metrics = [
      mk("VGV registrado (base)", money(vgvCents/100)),
      mk("Comissões registradas (base)", money(totalCents/100)),
      mk("Recebimentos registrados (base)", money(receivedCents/100)),
      mk("Saldo pendente (base)", money(pendingCents/100)),
      mk("Recebido nos últimos 30 dias", money(monthReceiptsCents/100)),
    ];
    if (!commissions.length) report.recommendations.push(rec("Conferir vendas e comissões", "Não há comissões na base consultada; confirme se os fechamentos já foram registrados."));
    else if (pendingCents) report.recommendations.push(rec("Conferir pendências", "Há saldo ainda não coberto por recebimentos registrados; confira datas e acordos."));
    else report.recommendations.push(rec("Reconciliar recebimentos", "Confirme se o registro financeiro corresponde aos valores realmente recebidos."));
    report.coverage = commissions.length || vgv.length ? "com_dados" : "sem_dados";
    report.notice = "Resumo da base consultada, não extrato bancário nem previsão garantida. IA sem permissão financeira.";
  }
  if (truncated) {
    report.coverage = "amostra";
    report.notice += " Limite de registros atingido: valores podem estar incompletos; não use como totais oficiais.";
  }
  return report;
}
