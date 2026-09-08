export type DealSide = "capture" | "capture_split" | "sale" | "sale_split";
export type DealStatus = "new" | "qualified" | "properties_sent" | "visit_scheduled" | "visit_done" | "proposal" | "negotiation" | "closed" | "lost";

/** Imobfy's commission rule: each full side is 20% of net brokerage; each half side is 10%. */
export const SIDE_PARTICIPATION: Record<DealSide, number> = {
  capture: 20,
  capture_split: 10,
  sale: 20,
  sale_split: 10,
};

export function participationForSides(sides: DealSide[]) {
  return sides.reduce((total, side) => total + SIDE_PARTICIPATION[side], 0);
}

export function calculateCommission(propertyValue: number, brokeragePct: number, taxPct: number, sides: DealSide[], userPct = 20) {
  const gross = propertyValue * brokeragePct / 100;
  const tax = gross * taxPct / 100;
  const net = gross - tax;
  const participationPct = participationForSides(sides);
  const participationAmount = net * participationPct / 100;
  const userCommission = participationAmount * userPct / 100;
  return { gross, tax, net, participationPct, participationAmount, userCommission };
}

export function nextDealStatuses(status: DealStatus): DealStatus[] {
  const flow: DealStatus[] = ["new", "qualified", "properties_sent", "visit_scheduled", "visit_done", "proposal", "negotiation", "closed"];
  const index = flow.indexOf(status);
  return index >= 0 && index < flow.length - 1 ? [flow[index + 1]] : [];
}

export function dealStatusLabel(status: DealStatus) {
  return ({
    new: "Novo lead",
    qualified: "Qualificado",
    properties_sent: "Imóveis enviados",
    visit_scheduled: "Visita agendada",
    visit_done: "Visita realizada",
    proposal: "Proposta",
    negotiation: "Negociação",
    closed: "Fechado",
    lost: "Perdido",
  } as Record<DealStatus, string>)[status];
}
