import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  question?: string;
  conversation_id?: string | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return json({ error: "A chave da IA ainda não foi configurada no servidor." }, 503);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Não autenticado." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return json({ error: "Sessão inválida." }, 401);

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const question = String(body.question || "").trim();
  if (!question) return json({ error: "Digite uma pergunta." }, 400);

  let conversationId = body.conversation_id || null;

  if (conversationId) {
    const { data: conversation, error } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !conversation) conversationId = null;
  }

  if (!conversationId) {
    const { data: conversation, error } = await supabase
      .from("ai_conversations")
      .insert({ user_id: user.id, title: question.slice(0, 80) })
      .select("id")
      .single();
    if (error || !conversation) return json({ error: "Não consegui iniciar a conversa com a IA." }, 500);
    conversationId = conversation.id;
  }

  const { error: userMessageError } = await supabase.from("ai_messages").insert({
    user_id: user.id,
    conversation_id: conversationId,
    role: "user",
    content: question,
  });
  if (userMessageError) return json({ error: "Não consegui registrar sua pergunta." }, 500);

  const [
    clients,
    properties,
    deals,
    appointments,
    commissions,
    vgv,
    dealProperties,
    visits,
    proposals,
    sales,
    activities,
    history,
  ] = await Promise.all([
    supabase.from("clients").select("id,name,phone,email,status,purpose,preferred_neighborhoods,min_price,max_price,notes,created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("properties").select("id,title,name,neighborhood,city,state,property_type,sale_value,asking_price,status,bedrooms,suites,parking_spaces,area_m2,owner_name,owner_phone,created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("deals").select("id,name,title,value,sale_value,operation_value,status,stage,property_id,client_id,closed_at,expected_close_at,expected_close_date,created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("appointments").select("id,title,starts_at,ends_at,status,client_id,property_id,deal_id,notes,appointment_type").order("starts_at", { ascending: false }).limit(200),
    supabase.from("commissions").select("id,deal_id,vgv,property_value,gross_amount,gross_commission,tax_amount,net_amount,net_brokerage,user_amount,status,due_date,due_at,paid_at,received_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("vgv_entries").select("id,deal_id,property_value,vgv,month,reference_month").order("reference_month", { ascending: false }).limit(200),
    supabase.from("deal_properties").select("deal_id,property_id,visit_status,visited_at,proposal_made,sold,notes").limit(500),
    supabase.from("visits").select("id,deal_id,client_id,starts_at,ends_at,status,location,notes").order("starts_at", { ascending: false }).limit(200),
    supabase.from("proposals").select("id,deal_id,property_id,amount,status,financing,down_payment,proposed_at,responded_at,notes").order("proposed_at", { ascending: false }).limit(300),
    supabase.from("sales").select("id,deal_id,property_id,proposal_id,sale_value,sold_at,notes").order("sold_at", { ascending: false }).limit(200),
    supabase.from("activities").select("id,client_id,deal_id,property_id,activity_type,title,description,occurred_at").order("occurred_at", { ascending: false }).limit(300),
    supabase.from("ai_messages").select("role,content,created_at").eq("conversation_id", conversationId).eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);

  const datasets = [clients, properties, deals, appointments, commissions, vgv, dealProperties, visits, proposals, sales, activities, history];
  if (datasets.some((result) => result.error)) {
    console.error("CRM context error", datasets.filter((result) => result.error).map((result) => result.error));
    return json({ error: "Não consegui ler todos os dados do CRM." }, 500);
  }

  const context = {
    clients: clients.data || [],
    properties: properties.data || [],
    deals: deals.data || [],
    appointments: appointments.data || [],
    commissions: commissions.data || [],
    vgv: vgv.data || [],
    deal_properties: dealProperties.data || [],
    visits: visits.data || [],
    proposals: proposals.data || [],
    sales: sales.data || [],
    activities: activities.data || [],
  };

  const previousMessages = (history.data || [])
    .reverse()
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({ role: message.role, content: message.content }));

  const system = `Você é o Imobfy AI, o cérebro comercial de um CRM imobiliário.
Responda sempre em português do Brasil, de forma objetiva, clara e acionável.
Você está atendendo somente o corretor autenticado e recebeu dados reais da operação dele.

REGRAS:
- Nunca invente clientes, imóveis, negócios, visitas, propostas, vendas, VGV ou comissões.
- Relacione entidades pelos campos disponíveis e deixe claro quando uma relação não estiver registrada.
- Quando houver dados suficientes, priorize recomendações comerciais práticas e explique o motivo.
- Para valores financeiros, use os números do CRM e mostre a conta quando isso ajudar.
- Não exponha IDs internos, tokens ou detalhes técnicos desnecessários.
- Se os dados estiverem incompletos, diga exatamente o que falta em vez de preencher com suposições.
- Considere o histórico da conversa, mas sempre dê prioridade aos dados atuais do CRM.

OBJETIVOS PRIORITÁRIOS:
1. identificar clientes que merecem follow-up;
2. detectar negócios parados e oportunidades de fechamento;
3. cruzar clientes, imóveis visitados e propostas;
4. acompanhar visitas, propostas e vendas;
5. analisar VGV e comissões;
6. transformar dados em próxima ação comercial concreta.

DADOS ATUAIS DO CRM:
${JSON.stringify(context)}`;

  const aiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: Deno.env.get("AI_MODEL") || "gpt-5.6-luna",
      input: [
        { role: "system", content: system },
        ...previousMessages,
      ],
      max_output_tokens: 1200,
    }),
  });

  if (!aiResponse.ok) {
    console.error("OpenAI error", await aiResponse.text());
    return json({ error: "O modelo de IA não respondeu. Verifique a configuração da chave do provedor." }, 502);
  }

  const result = await aiResponse.json();
  const answer = (result.output || [])
    .flatMap((item: any) => item.content || [])
    .filter((part: any) => part.type === "output_text")
    .map((part: any) => part.text)
    .join("\n")
    .trim();

  if (!answer) return json({ error: "Não consegui gerar uma resposta agora." }, 502);

  const { error: assistantMessageError } = await supabase.from("ai_messages").insert({
    user_id: user.id,
    conversation_id: conversationId,
    role: "assistant",
    content: answer,
  });
  if (assistantMessageError) console.error("AI history error", assistantMessageError);

  await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", user.id);

  return json({ answer, conversation_id: conversationId });
});
