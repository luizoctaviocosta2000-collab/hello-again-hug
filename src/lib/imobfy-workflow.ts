import type { DealStatus } from "./imobfy-core";

export const DEAL_STATUS_ORDER: DealStatus[] = [
  "new",
  "qualified",
  "properties_sent",
  "visit_scheduled",
  "visit_done",
  "proposal",
  "negotiation",
  "closed",
];

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  new: "Novo lead",
  qualified: "Qualificado",
  properties_sent: "Imóveis enviados",
  visit_scheduled: "Visita agendada",
  visit_done: "Visita realizada",
  proposal: "Proposta",
  negotiation: "Negociação",
  closed: "Fechado",
  lost: "Perdido",
};

export function nextDealStatus(status: DealStatus): DealStatus | null {
  const index = DEAL_STATUS_ORDER.indexOf(status);
  return index >= 0 && index < DEAL_STATUS_ORDER.length - 1 ? DEAL_STATUS_ORDER[index + 1]! : null;
}

export function dealProgress(status: DealStatus) {
  if (status === "lost") return 0;
  const index = DEAL_STATUS_ORDER.indexOf(status);
  return index < 0 ? 0 : Math.round((index / (DEAL_STATUS_ORDER.length - 1)) * 100);
}

export function normalizeDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
