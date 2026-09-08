import type { AgendaEvent } from "./imobfy-agenda";
import type { Client } from "./imobfy-crm";
import type { DealStatus } from "./imobfy-core";

export type AnalyticsDeal = {
  id: string;
  propertyValue: number;
  userCommission: number;
  status: DealStatus;
  dealDate?: string;
  receivedDate?: string;
};

export type AnalyticsSnapshot = {
  vgv: number;
  soldVgv: number;
  pipelineVgv: number;
  commissionToReceive: number;
  commissionReceived: number;
  activeClients: number;
  openDeals: number;
  todayEvents: number;
  pendingFollowUps: number;
};

export function buildAnalyticsSnapshot(
  properties: { value: number; status: string }[],
  deals: AnalyticsDeal[],
  clients: Client[],
  agenda: AgendaEvent[],
  todayKey: string,
): AnalyticsSnapshot {
  const activeProperties = properties.filter(p => p.status !== "cancelled");
  const sold = properties.filter(p => p.status === "sold");
  const openDeals = deals.filter(d => !["closed", "lost"].includes(d.status));
  const received = deals.filter(d => d.status === "received" || Boolean(d.receivedDate));

  return {
    vgv: activeProperties.reduce((sum, p) => sum + (Number(p.value) || 0), 0),
    soldVgv: sold.reduce((sum, p) => sum + (Number(p.value) || 0), 0),
    pipelineVgv: openDeals.reduce((sum, d) => sum + (Number(d.propertyValue) || 0), 0),
    commissionToReceive: deals.filter(d => d.status !== "received" && d.status !== "lost").reduce((sum, d) => sum + (Number(d.userCommission) || 0), 0),
    commissionReceived: received.reduce((sum, d) => sum + (Number(d.userCommission) || 0), 0),
    activeClients: clients.filter(c => !["inactive", "converted"].includes(c.status)).length,
    openDeals: openDeals.length,
    todayEvents: agenda.filter(e => e.date === todayKey).length,
    pendingFollowUps: agenda.filter(e => e.type === "follow_up" && !e.completed && e.date <= todayKey).length,
  };
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value || 0);
}
