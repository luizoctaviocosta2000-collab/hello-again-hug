import { supabase } from "./supabase";
import {
  buildSpecialistReport,
  type AgentData,
  type AgentReport,
  type AgentRow,
  type SpecialistKind,
} from "../../supabase/functions/_shared/specialist-agents";

const limit = 500;
const sources: Record<SpecialistKind, Array<{ field: keyof AgentData; table: string; select: string; order: string }>> = {
  ads: [
    {field:"metrics",table:"imobfy_ads_daily_metrics",select:"report_date,ad_account_id,campaign_id,spend_brl,clicks,source",order:"report_date"},
    {field:"events",table:"imobfy_ads_funnel_events",select:"event_key,stage,ad_account_id,campaign_id,client_id,deal_id,occurred_at,source",order:"occurred_at"},
  ],
  atendimento: [
    {field:"threads",table:"imobfy_attendance_threads",select:"status,updated_at",order:"updated_at"},
    {field:"messages",table:"imobfy_attendance_messages",select:"role,created_at",order:"created_at"},
  ],
  comercial: [
    {field:"deals",table:"deals",select:"status,stage,created_at,updated_at",order:"updated_at"},
    {field:"visits",table:"visits",select:"status,starts_at",order:"starts_at"},
  ],
  financeiro: [
    {field:"commissions",table:"commissions",select:"id,user_amount,status,created_at,due_date",order:"created_at"},
    {field:"receipts",table:"commission_receipts",select:"commission_id,amount,received_at",order:"received_at"},
    {field:"vgv",table:"vgv_entries",select:"vgv,reference_month",order:"reference_month"},
  ],
};

/** Browser has only its own Supabase Auth session and RLS grants. No service key. */
export async function loadLocalAgentReport(agent: SpecialistKind, verifiedUserId: string): Promise<AgentReport> {
  const data: AgentData = {};
  if (!verifiedUserId) throw new Error("Sessão inválida. Entre novamente.");
  const outcomes = await Promise.all(sources[agent].map(async source => {
    const {data:rows,error} = await supabase.from(source.table)
      .select(source.select).eq("user_id",verifiedUserId)
      .order(source.order,{ascending:false}).limit(limit);
    if (error) {
      if (error.code==="42P01" || error.code==="PGRST205" || /does not exist|Could not find the table/i.test(error.message)) {
        throw new Error("O banco desta área ainda não foi ativado no IMOBFY. Nenhum resultado foi inventado.");
      }
      throw new Error("Não consegui carregar os registros da área. Confira sua conexão e entre novamente.");
    }
    const safeRows = Array.isArray(rows) ? rows.filter(row => row !== null && typeof row === "object" && !Array.isArray(row)) as unknown as AgentRow[] : [];
    return {field:source.field,rows:safeRows};
  }));
  let truncated = false;
  for (const result of outcomes) {
    data[result.field] = result.rows;
    if (result.rows.length===limit) truncated = true;
  }
  const report = buildSpecialistReport(agent,data,new Date(),truncated);
  report.notice += " Análise calculada com sua sessão autenticada e regras locais; nenhuma chamada Gemini foi feita.";
  return report;
}
