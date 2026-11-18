/** First-party funnel analytics: counts only actual CRM events and declared ad spend.
 * No inferred campaign attribution, invented leads or automatic ad changes.
 */
export type AdDailyMetric = {
  report_date: string; ad_account_id: string; campaign_id: string;
  campaign_name: string; spend_brl: number | string; impressions: number; clicks: number;
  source: "manual" | "meta";
};
export type FunnelStage = "lead" | "atendimento" | "qualificado" | "visita" | "proposta" | "venda";
export type AdFunnelEvent = {
  id: string; event_key: string; stage: FunnelStage; campaign_id: string | null;
  ad_account_id: string | null; client_id: string | null; deal_id: string | null;
  occurred_at: string; source: "manual" | "crm" | "meta";
};
export type CampaignFunnel = {
  key: string; name: string; accountId: string; campaignId: string;
  spendBrl: number; impressions: number; clicks: number;
  leads: number; attended: number; qualified: number; visits: number; proposals: number; sales: number;
  cpl: number | null; cpql: number | null; cpv: number | null; cps: number | null;
  attributionMissing: boolean;
};
const valid = (x: unknown) => typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null;
export const safeRatio = (numerator: number, denominator: number) =>
  denominator > 0 ? numerator / denominator : null;
export const safeCostPer = (cost: number, count: number) => count > 0 ? cost / count : null;

export function summarizeAds(
  reports: AdDailyMetric[], events: AdFunnelEvent[], startDate: string, endDate: string,
): CampaignFunnel[] {
  const campaigns = new Map<string, CampaignFunnel>();
  for (const row of reports) {
    if (row.report_date < startDate || row.report_date > endDate) continue;
    const spend = Number(row.spend_brl);
    if (!row.ad_account_id || !row.campaign_id || !Number.isFinite(spend) || spend < 0) continue;
    const key = row.ad_account_id + ":" + row.campaign_id;
    const current = campaigns.get(key) ?? {
      key, name: row.campaign_name || row.campaign_id, accountId: row.ad_account_id,
      campaignId: row.campaign_id, spendBrl: 0, impressions: 0, clicks: 0,
      leads: 0, attended: 0, qualified: 0, visits: 0, proposals: 0, sales: 0,
      cpl: null, cpql: null, cpv: null, cps: null, attributionMissing: true,
    };
    current.spendBrl += spend;
    current.impressions += valid(row.impressions) ?? 0;
    current.clicks += valid(row.clicks) ?? 0;
    campaigns.set(key, current);
  }

  // A conversion is counted once per client and stage per campaign.
  // Events without a campaign ID or without a provable CRM entity never get
  // silently attributed to an ad. The event key also protects reprocessing.
  const seen = new Set<string>();
  for (const event of events) {
    if (!event.campaign_id || (!event.client_id && !event.deal_id)) continue;
    const day = event.occurred_at?.slice(0, 10);
    if (!day || day < startDate || day > endDate) continue;
    const matching = [...campaigns.values()].filter(c =>
      c.campaignId === event.campaign_id &&
      (!event.ad_account_id || event.ad_account_id === c.accountId)
    );
    if (matching.length !== 1) continue; // ambiguous account attribution
    const row = matching[0];
    const personKey = event.client_id || event.deal_id || event.event_key;
    const idempotency = row.key + ":" + event.stage + ":" + personKey;
    if (seen.has(idempotency)) continue;
    seen.add(idempotency);
    row.attributionMissing = false;
    if (event.stage === "lead") row.leads++;
    if (event.stage === "atendimento") row.attended++;
    if (event.stage === "qualificado") row.qualified++;
    if (event.stage === "visita") row.visits++;
    if (event.stage === "proposta") row.proposals++;
    if (event.stage === "venda") row.sales++;
  }
  return [...campaigns.values()].map(row => ({
    ...row, cpl: safeCostPer(row.spendBrl,row.leads),
    cpql: safeCostPer(row.spendBrl,row.qualified), cpv: safeCostPer(row.spendBrl,row.visits),
    cps: safeCostPer(row.spendBrl,row.sales),
  })).sort((a,b) => b.spendBrl - a.spendBrl);
}

export type AdsAdvice = { campaignKey: string; message: string; evidence: string };
export function adsAdvice(rows: CampaignFunnel[]): AdsAdvice[] {
  const result: AdsAdvice[] = [];
  for (const row of rows) {
    if (row.clicks >= 50 && row.leads === 0) {
      result.push({
        campaignKey: row.key,
        message: "Revise a captação e a vinculação de origem dos leads antes de investir mais.",
        evidence: row.clicks + " cliques registrados e nenhum lead atribuído ao CRM.",
      });
    } else if (row.leads >= 5 && row.qualified === 0) {
      result.push({
        campaignKey: row.key,
        message: "Revise o atendimento e os critérios de qualificação antes de mexer no anúncio.",
        evidence: row.leads + " leads atribuídos e nenhuma qualificação registrada.",
      });
    } else if (row.visits > 0 && row.sales === 0) {
      result.push({
        campaignKey: row.key,
        message: "Acompanhe o pós-visita e as propostas; ainda não há venda atribuída.",
        evidence: row.visits + " visita(s) e nenhuma venda atribuída no período.",
      });
    }
  }
  // Suggestions are read-only and require human interpretation. Never pause,
  // scale, or edit campaigns from these signals alone.
  return result;
}
