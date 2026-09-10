import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = { question?: string; conversation_id?: string | null };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function getGeminiKey() {
  const names = ["GEMINI_API_KEY", "GOOGLE_API_KEY"];
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const geminiKey = getGeminiKey();
  if (!geminiKey) return json({ error: "A chave Gemini não está disponível para esta função. Crie a Secret GEMINI_API_KEY no Supabase Edge Functions." }, 503);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Não autenticado." }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return json({ error: "Sessão inválida." }, 401);

  let body: Body = {};
  try { body = await req.json(); } catch { body = {}; }
  const question = String(body.question || "").trim();
  if (!question) return json({ error: "Digite uma pergunta." }, 400);

  let conversationId = body.conversation_id || null;
  if (conversationId) {
    const { data: conversation, error } = await supabase.from("ai_conversations").select("id").eq("id", conversationId).eq("user_id", user.id).maybeSingle();
    if (error || !conversation) conversationId = null;
  }
  if (!conversationId) {
    const { data: conversation, error } = await supabase.from("ai_conversations").insert({ user_id: user.id, title: question.slice(0, 80) }).select("id").single();
    if (error || !conversation) return json({ error: "Não consegui iniciar a conversa com a IA." }, 500);
    conversationId = conversation.id;
  }

  const { error: userMessageError } = await supabase.from("ai_messages").insert({ user_id: user.id, conversation_id: conversationId, role: "user", content: question });
  if (userMessageError) return json({ error: "Não consegui registrar sua pergunta." }, 500);

  const [clients, properties, deals, commissions, vgv, dealProperties, visits, visitProperties, proposals, sales, activities, history] = await Promise.all([
    supabase.from("clients").select("id,name,email,phone,intent,budget_min,budget_max,preferred_neighborhoods,property_types,bedrooms_min,status,notes,created_at,updated_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("properties").select("id,title,address,neighborhood,city,state,property_type,bedrooms,bathrooms,parking_spaces,area_m2,sale_value,asking_price,status,owner_name,owner_phone,notes,created_at,updated_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("deals").select("id,property_id,client_id,status,property_value,brokerage_pct,tax_pct,participation_pct,sides,notes,created_at,updated_at,closed_at,expected_close_at,title,stage,operation_value,sale_value").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("commissions").select("id,deal_id,property_value,brokerage_pct,gross_amount,tax_pct,tax_amount,net_brokerage,participation_pct,user_amount,status,received_at,due_at,paid_at,notes,vgv,gross_pct,role_pct,commission_type,capture_id,sale_id,due_date").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("vgv_entries").select("id,deal_id,property_value,month,reference_month,vgv").eq("user_id", user.id).order("reference_month", { ascending: false }).limit(200),
    supabase.from("deal_properties").select("id,deal_id,property_id,visit_status,proposal_made,sold,created_at,updated_at").eq("user_id", user.id).limit(500),
    supabase.from("visits").select("id,deal_id,client_id,starts_at,ends_at,status,location,notes,created_at,updated_at").eq("user_id", user.id).order("starts_at", { ascending: false }).limit(200),
    supabase.from("visit_properties").select("id,visit_id,property_id,sequence,visited,notes").eq("user_id", user.id).limit(500),
    supabase.from("proposals").select("id,deal_id,property_id,amount,status,financing,down_payment,proposed_at,responded_at,notes").eq("user_id", user.id).order("proposed_at", { ascending: false }).limit(300),
    supabase.from("sales").select("id,deal_id,property_id,proposal_id,sale_value,sold_at,notes").eq("user_id", user.id).order("sold_at", { ascending: false }).limit(200),
    supabase.from("activities").select("id,client_id,deal_id,property_id,activity_type,title,description,occurred_at").eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(300),
    supabase.from("ai_messages").select("role,content,created_at").eq("conversation_id", conversationId).eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);

  const datasets = [clients, properties, deals, commissions, vgv, dealProperties, visits, visitProperties, proposals, sales, activities, history];
  if (datasets.some((result) => result.error)) return json({ error: "Não consegui ler todos os dados do CRM." }, 500);

  const context = { clients: clients.data || [], properties: properties.data || [], deals: deals.data || [], commissions: commissions.data || [], vgv: vgv.data || [], deal_properties: dealProperties.data || [], visits: visits.data || [], visit_properties: visitProperties.data || [], proposals: proposals.data || [], sales: sales.data || [], activities: activities.data || [] };
  const previousMessages = (history.data || []).reverse().filter((message) => message.role === "user" || message.role === "assistant").map((message) => ({ role: message.role, content: message.content }));

  const system = `Você é o Imobfy AI, o cérebro comercial de um CRM imobiliário. Responda sempre em português do Brasil, de forma objetiva, clara e acionável. Você atende somente o corretor autenticado e recebeu dados reais da operação dele.

REGRAS:
- Nunca invente clientes, imóveis, negócios, visitas, propostas, vendas, VGV ou comissões.
- Use somente os dados fornecidos e relacione entidades pelos IDs internos, sem expor esses IDs ao usuário.
- A fonte oficial de visitas é visits + visit_properties.
- Para valores financeiros, use os números do CRM e mostre a conta quando ajudar.
- Se os dados estiverem incompletos, diga exatamente o que falta.
- Priorize ações comerciais concretas.

DADOS ATUAIS DO CRM:
${JSON.stringify(context)}`;

  const model = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-3.1-pro";
  const contents = [...previousMessages, { role: "user", content: question }].map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] }));

  const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: 1600, temperature: 0.4 } }),
  });

  if (!aiResponse.ok) {
    const providerError = await aiResponse.text();
    console.error("Gemini error", providerError);
    return json({ error: `A chave Gemini foi encontrada, mas o Gemini recusou a solicitação. Verifique a chave, as restrições da API e o modelo ${model}.` }, 502);
  }

  const result = await aiResponse.json();
  const answer = result?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("\n").trim() || "";
  if (!answer) return json({ error: "O Gemini não retornou uma resposta." }, 502);

  const { error: assistantMessageError } = await supabase.from("ai_messages").insert({ user_id: user.id, conversation_id: conversationId, role: "assistant", content: answer });
  if (assistantMessageError) console.error("AI history error", assistantMessageError);
  await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", user.id);
  return json({ answer, conversation_id: conversationId });
});
