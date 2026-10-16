import { supabase } from "./supabase";
import type { MvpModule } from "../components/ImobfyMvpApp";

export type DataRow = { id: string; name: string; detail: string; status: string; value?: number; created_at?: string };
type TableName = "properties" | "clients" | "deals" | "appointments" | "commissions" | "vgv_entries";
type CreateInput = { name: string; detail: string; value?: number; phone?: string; email?: string; intent?: string; property_types?: string[]; state?: string; city?: string; preferred_neighborhoods?: string[]; budget_min?: number | null; budget_max?: number | null; bedrooms_min?: number | null; status?: string };

function tableFor(module: Exclude<MvpModule, "dashboard" | "configuracoes">): TableName { return ({ imoveis: "properties", clientes: "clients", negocios: "deals", agenda: "appointments", comissoes: "commissions", vgv: "vgv_entries" } as const)[module]; }
function fromDb(module: Exclude<MvpModule, "dashboard" | "configuracoes">, row: Record<string, unknown>): DataRow {
  const base = { id: String(row.id), created_at: row.created_at ? String(row.created_at) : undefined };
  switch (module) {
    case "imoveis": return { ...base, name: String(row.title ?? "Imóvel"), detail: String([row.property_type, row.neighborhood, row.city].filter(Boolean).join(" · ") || row.address || "Sem detalhes"), status: String(row.status ?? "Ativo"), value: Number(row.sale_value ?? 0) || undefined };
    case "clientes": return { ...base, name: String(row.name ?? "Cliente"), detail: String(row.phone ?? row.email ?? "Sem contato"), status: String(row.status ?? "Ativo") };
    case "negocios": return { ...base, name: String(row.notes ?? "Negócio"), detail: String(row.status ?? "Novo"), status: String(row.status ?? "Novo"), value: Number(row.property_value ?? 0) || undefined };
    case "agenda": return { ...base, name: String(row.title ?? "Compromisso"), detail: row.starts_at ? new Date(String(row.starts_at)).toLocaleString("pt-BR") : "Sem horário", status: String(row.status ?? "Agendado") };
    case "comissoes": return { ...base, name: "Comissão", detail: String(row.status ?? "Previsão"), status: String(row.status ?? "Previsão"), value: Number(row.user_amount ?? 0) || undefined };
    case "vgv": return { ...base, name: "VGV", detail: String(row.month ?? ""), status: String(row.status ?? "Realizado"), value: Number(row.property_value ?? 0) || undefined };
  }
}
export async function loadRemoteRows(userId: string, module: Exclude<MvpModule, "dashboard" | "configuracoes">): Promise<DataRow[]> { if (!supabase) return []; const { data, error } = await supabase.from(tableFor(module)).select("*").eq("user_id", userId).order("created_at", { ascending: false }); if (error) throw error; return (data ?? []).map(row => fromDb(module, row as Record<string, unknown>)); }
export async function createRemoteRow(userId: string, module: Exclude<MvpModule, "dashboard" | "configuracoes">, input: CreateInput): Promise<DataRow> {
  if (!supabase) throw new Error("Supabase não configurado.");
  let financeRules = { commissionPercent: 6, taxPercent: 9, participationPercent: 20 };
  if (module === "negocios" || module === "comissoes") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("default_commission_pct,tax_pct,participation_pct")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    financeRules = {
      commissionPercent: Number(profile?.default_commission_pct ?? 6),
      taxPercent: Number(profile?.tax_pct ?? 9),
      participationPercent: Number(profile?.participation_pct ?? 20),
    };
  }
  const common = { user_id: userId }; let payload: Record<string, unknown>;
  switch (module) {
    case "imoveis": payload = { ...common, title: input.name, neighborhood: input.preferred_neighborhoods?.[0] ?? input.detail, city: input.city || null, state: input.state || null, property_type: input.property_types?.[0] || null, sale_value: input.value ?? 0, status: "active" }; break;
    case "clientes": payload = { ...common, name: input.name, phone: input.phone || input.detail || null, email: input.email || null, intent: input.intent || "Comprar", property_types: input.property_types ?? [], state: input.state || null, city: input.city || null, preferred_neighborhoods: input.preferred_neighborhoods ?? [], budget_min: input.budget_min ?? null, budget_max: input.budget_max ?? null, bedrooms_min: input.bedrooms_min ?? null, status: input.status || "active" }; break;
    case "negocios": payload = { ...common, notes: input.name, status: "new", property_value: input.value ?? 0, brokerage_pct: financeRules.commissionPercent, tax_pct: financeRules.taxPercent, participation_pct: financeRules.participationPercent }; break;
    case "agenda": payload = { ...common, title: input.name, notes: input.detail, starts_at: new Date().toISOString(), status: "scheduled" }; break;
    case "comissoes": { const propertyValue = input.value ?? 0; const gross = propertyValue * (financeRules.commissionPercent / 100); const tax = gross * (financeRules.taxPercent / 100); const net = gross - tax; payload = { ...common, property_value: propertyValue, gross_pct: financeRules.commissionPercent, gross_amount: gross, tax_pct: financeRules.taxPercent, tax_amount: tax, net_brokerage: net, participation_pct: financeRules.participationPercent, user_amount: net * (financeRules.participationPercent / 100), status: "forecast" }; break; }
    case "vgv": payload = { ...common, property_value: input.value ?? 0, month: new Date().toISOString().slice(0, 10), status: "realized" }; break;
  }
  const { data, error } = await supabase.from(tableFor(module)).insert(payload).select("*").single(); if (error) throw error; return fromDb(module, data as Record<string, unknown>);
}