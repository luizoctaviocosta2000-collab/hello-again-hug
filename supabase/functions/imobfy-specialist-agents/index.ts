import { isIncompleteAgentDataset } from "../_shared/agent-coverage.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateWithGemini, geminiFailure, geminiModels, geminiText } from "../_shared/gemini.ts";
import {
  buildSpecialistReport,
  isSpecialistKind,
  parseSpecialistBriefing,
  type AgentData,
  type AgentReport,
  type AgentRow,
  type SpecialistKind,
} from "../_shared/specialist-agents.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const domains: Record<SpecialistKind,string> = {
  ads: "Você é um analista sênior de Meta Ads para imóveis. Foque qualidade dos leads, funil real, criatividade, hipóteses de teste e custos atribuídos. Nunca confunda dados manuais com Ads Insights, não invente ROAS, nem garanta clientes.",
  atendimento: "Você é um treinador de atendimento imobiliário. Foque velocidade, qualificação ética, objeções, atendimento humano e organização da conversa. Não prometa desconto, aprovação de financiamento ou agendamento confirmado.",
  comercial: "Você é gerente de vendas imobiliárias. Identifique gargalos, seguimento de propostas e visitas, oportunidades paradas e estratégias de retomada sem pressionar nem inventar disponibilidade.",
  financeiro: "Você é analista de comissões e recebimentos. Separe valores recebidos de pendentes, destaque conciliação e limitações da amostra. Jamais refaça números oficiais nem autorize pagamentos ou lançamentos.",
};

const MAX_ROWS = 500;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: "Método não permitido." }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond({ error: "Faça login para acessar os agentes." }, 401);

  let body: unknown;
  try { body = await req.json(); } catch { return respond({ error: "Requisição inválida." }, 400); }
  const kind = body && typeof body === "object" && "agent" in body ? (body as {agent:unknown}).agent : null;
  if (!isSpecialistKind(kind)) return respond({ error: "Escolha um especialista válido." }, 400);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return respond({ error: "Serviço indisponível." }, 503);
  const db = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return respond({ error: "Sessão inválida. Entre novamente." }, 401);

  try {
    // This closure retains the precise generic SupabaseClient inferred by Deno,
    // instead of widening its database/schema types across function parameters.
    const scopedRows = async (
      table: string,
      columns: string,
      orderBy: string,
    ): Promise<{rows:AgentRow[];truncated:boolean}> => {
      const {data,error,count} = await db.from(table).select(columns, { count: "exact" })
        .eq("user_id",user.id).order(orderBy,{ascending:false}).limit(MAX_ROWS);
      if(error) {
        if(error.code==="42P01" || error.code==="PGRST205") throw new Error("DATASET_MISSING");
        console.error("Agent dataset query failed", {table,code:error.code||"unknown"});
        throw new Error("DATASET_UNAVAILABLE");
      }
      const rows = Array.isArray(data) ?
        data.filter(row => row!==null && typeof row==="object" && !Array.isArray(row)) as unknown as AgentRow[] : [];
      return {rows,truncated:isIncompleteAgentDataset(count,rows.length)};
    };
    const definitions: Record<SpecialistKind,Array<[string,string,string]>> = {
      ads: [
        ["imobfy_ads_daily_metrics","report_date,ad_account_id,campaign_id,campaign_name,spend_brl,clicks,source","report_date"],
        ["imobfy_ads_funnel_events","event_key,stage,ad_account_id,campaign_id,client_id,deal_id,occurred_at,source","occurred_at"],
      ],
      atendimento: [
        ["imobfy_attendance_threads","status,updated_at","updated_at"],
        ["imobfy_attendance_messages","role,created_at","created_at"],
      ],
      comercial: [
        ["deals","status,stage,created_at,updated_at","updated_at"],
        ["visits","status,starts_at","starts_at"],
      ],
      financeiro: [
        ["commissions","id,user_amount,status,created_at,due_date","created_at"],
        ["commission_receipts","commission_id,amount,received_at","received_at"],
        ["vgv_entries","vgv,reference_month","reference_month"],
      ],
    };
    const selected = definitions[kind];
    // Queries carry the authenticated user's JWT and RLS, plus an explicit
    // user_id predicate. No service role, no arbitrary query, and no CRM writes.
    const results = await Promise.all(selected.map(async ([table, columns, order]) =>
      scopedRows(table, columns, order)
    ));
    const data: AgentData = {};
    const keys: Record<SpecialistKind, (keyof AgentData)[]> = {
      ads: ["metrics","events"],
      atendimento: ["threads","messages"],
      comercial: ["deals","visits"],
      financeiro: ["commissions","receipts","vgv"],
    };
    results.forEach((result,index) => { data[keys[kind][index]!] = result.rows; });
    const truncated = results.some(r => r.truncated);
    const report: AgentReport = buildSpecialistReport(kind, data, new Date(), truncated);

    // Without data, don't make a paid model call or fabricate conclusions.
    if (report.coverage === "sem_dados" || report.coverage === "amostra") return respond(report);

    const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
    if (!apiKey) {
      report.notice += " IA generativa indisponível; recomendações baseadas em regras verificáveis.";
      return respond(report);
    }
    const { data: allowed, error: quotaError } = await db.rpc("consume_ai_quota",{p_feature:"chat"});
    if (quotaError || allowed !== true) {
      report.notice += " Cota de IA indisponível ou esgotada; recomendações em modo de regras.";
      return respond(report);
    }

    const system = [
      domains[kind],
      "Você é apenas consultor INTERNO. Não pode enviar mensagens, criar compromissos, alterar anúncios, gastar orçamento, registrar vendas, recebimentos ou comissões.",
      "A fonte é o resumo determinístico e anônimo abaixo. Não adivinhe nomes, telefones, campanhas, resultados de vendas nem novos valores.",
      "Proponha uma PRIORIDADE ESTRATÉGICA clara, em uma única frase qualitativa, SEM NÚMEROS, sem URLs, sem e-mails, sem promessas garantidas.",
      "Responda somente JSON no formato: {\"briefing\":\"frase qualitativa em português\"}. Sem markdown.",
    ].join("\n");
    try {
      const { result } = await generateWithGemini({
        apiKey, models: geminiModels(Deno.env.get("GEMINI_SPECIALISTS_MODEL"),Deno.env.get("GEMINI_MODEL")),
        request: {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: JSON.stringify({
            agent: kind,
            coverage: report.coverage,
            metrics: report.metrics,
            recommendations: report.recommendations,
            notice: report.notice,
          }) }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json", maxOutputTokens: 300 },
        },
      });
      const briefing = parseSpecialistBriefing(geminiText(result));
      if (briefing) {
        report.mode = "gemini";
        report.briefing = briefing;
      } else {
        report.notice += " Resposta da IA não passou na validação; exibindo apenas regras.";
      }
    } catch (cause) {
      const failure = geminiFailure(cause);
      report.notice += " " + failure.message + " Exibindo recomendações por regras.";
    }
    return respond(report);
  } catch (cause) {
    const missing = cause instanceof Error && cause.message === "DATASET_MISSING";
    return respond({ error: missing
      ? "Esta área ainda precisa da migration de Inteligência no banco. Nenhuma análise foi inventada."
      : "Não foi possível consultar os dados necessários. Tente novamente." }, missing ? 409 : 503);
  }
});
