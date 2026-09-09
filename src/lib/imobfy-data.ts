import { supabase } from "./supabase";
import type { MvpModule } from "../components/ImobfyMvpApp";

export type DataRow = { id: string; name: string; detail: string; status: string; value?: number };

type TableName = "properties" | "clients" | "deals" | "appointments" | "commissions" | "vgv_entries";

function tableFor(module: Exclude<MvpModule, "dashboard" | "configuracoes">): TableName {
  return ({
    imoveis: "properties",
    clientes: "clients",
    negocios: "deals",
    agenda: "appointments",
    comissoes: "commissions",
    vgv: "vgv_entries",
  } as const)[module];
}

function fromDb(module: Exclude<MvpModule, "dashboard" | "configuracoes">, row: Record<string, unknown>): DataRow {
  switch (module) {
    case "imoveis":
      return { id: String(row.id), name: String(row.title ?? "Imóvel"), detail: String(row.neighborhood ?? row.address ?? "Sem detalhes"), status: String(row.status ?? "Ativo"), value: Number(row.sale_value ?? 0) || undefined };
    case "clientes":
      return { id: String(row.id), name: String(row.name ?? "Cliente"), detail: String(row.phone ?? row.email ?? "Sem contato"), status: String(row.status ?? "Ativo") };
    case "negocios":
      return { id: String(row.id), name: String(row.notes ?? "Negócio"), detail: String(row.status ?? "Novo"), status: String(row.status ?? "Novo"), value: Number(row.property_value ?? 0) || undefined };
    case "agenda":
      return { id: String(row.id), name: String(row.title ?? "Compromisso"), detail: row.starts_at ? new Date(String(row.starts_at)).toLocaleString("pt-BR") : "Sem horário", status: String(row.status ?? "Agendado") };
    case "comissoes":
      return { id: String(row.id), name: "Comissão", detail: String(row.status ?? "Previsão"), status: String(row.status ?? "Previsão"), value: Number(row.user_amount ?? 0) || undefined };
    case "vgv":
      return { id: String(row.id), name: "VGV", detail: String(row.month ?? ""), status: "Realizado", value: Number(row.property_value ?? 0) || undefined };
  }
}

export async function loadRemoteRows(userId: string, module: Exclude<MvpModule, "dashboard" | "configuracoes">): Promise<DataRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from(tableFor(module)).select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => fromDb(module, row as Record<string, unknown>));
}

export async function createRemoteRow(userId: string, module: Exclude<MvpModule, "dashboard" | "configuracoes">, input: { name: string; detail: string; value?: number }): Promise<DataRow> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const common = { user_id: userId };
  let payload: Record<string, unknown>;
  switch (module) {
    case "imoveis": payload = { ...common, title: input.name, neighborhood: input.detail, sale_value: input.value ?? 0, status: "active" }; break;
    case "clientes": payload = { ...common, name: input.name, phone: input.detail, status: "active" }; break;
    case "negocios": payload = { ...common, notes: input.name, status: "new", property_value: input.value ?? 0, brokerage_pct: 6, tax_pct: 9, participation_pct: 20 }; break;
    case "agenda": payload = { ...common, title: input.name, notes: input.detail, starts_at: new Date().toISOString(), status: "scheduled" }; break;
    case "comissoes": payload = { ...common, property_value: input.value ?? 0, gross_amount: (input.value ?? 0) * 0.06, tax_pct: 9, tax_amount: (input.value ?? 0) * 0.06 * 0.09, net_brokerage: (input.value ?? 0) * 0.06 * 0.91, participation_pct: 20, user_amount: (input.value ?? 0) * 0.06 * 0.91 * 0.2, status: "forecast" }; break;
    case "vgv": payload = { ...common, property_value: input.value ?? 0, month: new Date().toISOString().slice(0, 10) }; break;
  }
  const { data, error } = await supabase.from(tableFor(module)).insert(payload).select("*").single();
  if (error) throw error;
  return fromDb(module, data as Record<string, unknown>);
}
