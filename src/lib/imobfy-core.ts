import { supabase } from "./supabase";

export type DealSide = "capture" | "capture_split" | "sale" | "sale_split";
export type DealStatus = "new" | "qualified" | "properties_sent" | "visit_scheduled" | "visit_done" | "proposal" | "negotiation" | "closed" | "lost";

/** Regra comercial: captação 20%, meia captação 10%, venda 20%, meia venda 10%. */
export const SIDE_PARTICIPATION: Record<DealSide, number> = { capture: 20, capture_split: 10, sale: 20, sale_split: 10 };
export const COMMISSION_DEFAULTS = { brokeragePct: 6, taxPct: 9 } as const;

export function participationForSides(sides: DealSide[]) { return sides.reduce((total, side) => total + SIDE_PARTICIPATION[side], 0); }

export function calculateCommission(propertyValue: number, brokeragePct = COMMISSION_DEFAULTS.brokeragePct, taxPct = COMMISSION_DEFAULTS.taxPct, sides: DealSide[] = ["capture"]) {
  const gross = propertyValue * brokeragePct / 100;
  const tax = gross * taxPct / 100;
  const net = gross - tax;
  const participationPct = participationForSides(sides);
  const userCommission = net * participationPct / 100;
  return { gross, tax, net, participationPct, participationAmount: userCommission, userCommission };
}

export type CoreTable = "properties" | "clients" | "deals" | "appointments" | "commissions" | "vgv_entries";

export async function listOwned<T>(table: CoreTable, userId: string): Promise<T[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from(table).select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function createOwned<T extends Record<string, unknown>>(table: CoreTable, userId: string, values: T) {
  if (!supabase) throw new Error("Supabase ainda não está configurado.");
  const { data, error } = await supabase.from(table).insert({ ...values, user_id: userId }).select().single();
  if (error) throw error;
  return data;
}

export async function updateOwned<T extends Record<string, unknown>>(table: CoreTable, userId: string, id: string, values: T) {
  if (!supabase) throw new Error("Supabase ainda não está configurado.");
  const { data, error } = await supabase.from(table).update(values).eq("id", id).eq("user_id", userId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteOwned(table: CoreTable, userId: string, id: string) {
  if (!supabase) throw new Error("Supabase ainda não está configurado.");
  const { error } = await supabase.from(table).delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export function nextDealStatuses(status: DealStatus): DealStatus[] {
  const flow: DealStatus[] = ["new", "qualified", "properties_sent", "visit_scheduled", "visit_done", "proposal", "negotiation", "closed"];
  const index = flow.indexOf(status);
  return index >= 0 && index < flow.length - 1 ? [flow[index + 1]!] : [];
}

export function dealStatusLabel(status: DealStatus) {
  return ({ new: "Novo lead", qualified: "Qualificado", properties_sent: "Imóveis enviados", visit_scheduled: "Visita agendada", visit_done: "Visita realizada", proposal: "Proposta", negotiation: "Negociação", closed: "Fechado", lost: "Perdido" } as Record<DealStatus, string>)[status];
}
