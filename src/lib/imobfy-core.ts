export type DealSide = "capture" | "capture_split" | "sale" | "sale_split";
export type DealStatus = "new" | "qualified" | "properties_sent" | "visit_scheduled" | "visit_done" | "proposal" | "negotiation" | "closed" | "lost";

/**
 * Regra comercial do Imobfy:
 * captação inteira = 20%, meia captação = 10%, venda inteira = 20%, meia venda = 10%.
 * Esses percentuais já representam a participação do corretor sobre a corretagem líquida.
 */
export const SIDE_PARTICIPATION: Record<DealSide, number> = { capture: 20, capture_split: 10, sale: 20, sale_split: 10 };

export function participationForSides(sides: DealSide[]) { return sides.reduce((total, side) => total + SIDE_PARTICIPATION[side], 0); }

export function calculateCommission(propertyValue: number, brokeragePct: number, taxPct: number, sides: DealSide[]) {
  const gross = propertyValue * brokeragePct / 100;
  const tax = gross * taxPct / 100;
  const net = gross - tax;
  const participationPct = participationForSides(sides);
  const userCommission = net * participationPct / 100;
  return { gross, tax, net, participationPct, participationAmount: userCommission, userCommission };
}

export function nextDealStatuses(status: DealStatus): DealStatus[] {
  const flow: DealStatus[] = ["new", "qualified", "properties_sent", "visit_scheduled", "visit_done", "proposal", "negotiation", "closed"];
  const index = flow.indexOf(status);
  return index >= 0 && index < flow.length - 1 ? [flow[index + 1]] : [];
}

export function dealStatusLabel(status: DealStatus) {
  return ({ new: "Novo lead", qualified: "Qualificado", properties_sent: "Imóveis enviados", visit_scheduled: "Visita agendada", visit_done: "Visita realizada", proposal: "Proposta", negotiation: "Negociação", closed: "Fechado", lost: "Perdido" } as Record<DealStatus, string>)[status];
}
