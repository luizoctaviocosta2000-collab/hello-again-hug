import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Método não permitido." }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return new Response(JSON.stringify({ error: "A chave da IA ainda não foi configurada no servidor." }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
  const auth = req.headers.get("Authorization");
  if (!auth) return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return new Response(JSON.stringify({ error: "Sessão inválida." }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  let body: { question?: string };
  try { body = await req.json(); } catch { body = {}; }
  const question = String(body.question || "").trim();
  if (!question) return new Response(JSON.stringify({ error: "Digite uma pergunta." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  const [clients, properties, deals, appointments, commissions, vgv] = await Promise.all([
    supabase.from("clients").select("id,name,phone,email,intent,property_types,state,city,neighborhood,budget_min,budget_max,bedrooms_min,status,created_at").limit(100),
    supabase.from("properties").select("id,title,name,neighborhood,city,state,property_type,sale_value,status,created_at").limit(100),
    supabase.from("deals").select("id,name,value,status,property_id,client_id,brokerage_pct,tax_pct,participation_pct,closed_at,expected_close_at,created_at").limit(100),
    supabase.from("appointments").select("id,title,starts_at,status,client_id,property_id,deal_id,notes").limit(100),
    supabase.from("commissions").select("id,deal_id,property_value,gross_amount,tax_amount,net_brokerage,participation_pct,user_amount,status,due_at,paid_at,received_at").limit(100),
    supabase.from("vgv_entries").select("id,deal_id,property_value,month").limit(100),
  ]);
  const errors = [clients, properties, deals, appointments, commissions, vgv].filter(x => x.error);
  if (errors.length) return new Response(JSON.stringify({ error: "Não consegui ler todos os dados do CRM." }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  const context = { clients: clients.data || [], properties: properties.data || [], deals: deals.data || [], appointments: appointments.data || [], commissions: commissions.data || [], vgv: vgv.data || [] };
  const system = `Você é o Imobfy AI, assistente comercial de um CRM imobiliário. Responda em português do Brasil, de forma objetiva e útil. Você recebeu dados reais somente do usuário autenticado. Nunca invente registros, valores, clientes ou imóveis. Quando não houver informação suficiente, diga claramente. Faça cálculos simples quando necessário e explique a lógica. Priorize ações comerciais práticas: follow-up, negócios parados, oportunidades cliente x imóvel, agenda, VGV e comissões. Não exponha IDs internos, tokens ou dados técnicos desnecessários.\n\nDADOS DO CRM:\n${JSON.stringify(context)}`;
  const aiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({ model: "gpt-5.6-luna", input: [{ role: "system", content: system }, { role: "user", content: question }], max_output_tokens: 900 }),
  });
  if (!aiResponse.ok) {
    console.error("OpenAI error", await aiResponse.text());
    return new Response(JSON.stringify({ error: "O modelo de IA não respondeu. Verifique a configuração da chave do provedor." }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const result = await aiResponse.json();
  const answer = (result.output || []).flatMap((item: any) => item.content || []).filter((part: any) => part.type === "output_text").map((part: any) => part.text).join("\n").trim();
  return new Response(JSON.stringify({ answer: answer || "Não consegui gerar uma resposta agora." }), { headers: { ...cors, "Content-Type": "application/json" } });
});