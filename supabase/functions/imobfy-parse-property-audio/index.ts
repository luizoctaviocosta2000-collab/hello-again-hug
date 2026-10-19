import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const out = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const allowedMimeTypes = new Set([
  "audio/webm", "audio/webm;codecs=opus", "audio/ogg", "audio/ogg;codecs=opus",
  "audio/mp4", "audio/mpeg", "audio/wav", "audio/aac", "audio/flac",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "Método não permitido." }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return out({ error: "Não autenticado." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!supabaseUrl || !anonKey) return out({ error: "Configuração do Supabase indisponível." }, 503);
  if (!geminiKey) return out({ error: "A chave Gemini não está disponível no servidor." }, 503);

  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return out({ error: "Sua sessão expirou. Entre novamente." }, 401);

  let body: { audioBase64?: unknown; mimeType?: unknown };
  try { body = await req.json(); } catch { return out({ error: "Não consegui ler o áudio enviado." }, 400); }

  const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64 : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType.split(";")[0].trim().toLowerCase() : "";
  if (!audioBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audioBase64)) return out({ error: "Áudio inválido. Grave novamente." }, 400);
  if (audioBase64.length > 11_200_000) return out({ error: "O áudio é muito grande. Grave uma descrição mais curta (até 8 MB)." }, 413);
  if (!allowedMimeTypes.has(mimeType) && !allowedMimeTypes.has(String(body.mimeType || "").toLowerCase())) {
    return out({ error: "Formato de áudio não suportado pelo navegador. Tente gravar novamente." }, 415);
  }

  const prompt = `Você extrai dados de anúncios imobiliários a partir de áudio falado em português brasileiro.
Retorne SOMENTE um objeto JSON válido, sem markdown, com a propriedade "fields".
Não invente nem deduza informações ausentes. Para campos não mencionados, use null.
Converta valores monetários e medidas falados para números (ex.: "seiscentos e cinquenta mil" => 650000; "oitenta e cinco metros" => 85).
Use exatamente estes campos:
{
 "fields": {
  "title": string|null, "property_code": string|null,
  "property_type": "Apartamento"|"Casa"|"Cobertura"|"Loja"|"Lote"|"Conjunto"|"Outro"|null,
  "purpose": "venda"|"locacao"|"venda_locacao"|null,
  "status": "ativo"|"reservado"|"vendido"|"inativo"|null,
  "neighborhood": string|null, "city": string|null, "address": string|null,
  "address_number": string|null, "address_complement": string|null, "zip_code": string|null,
  "bedrooms": number|null, "suites": number|null, "bathrooms": number|null, "parking_spaces": number|null,
  "area_m2": number|null, "asking_price": number|null, "condominium_fee": number|null, "iptu_amount": number|null,
  "habite_se": "Sim"|"Não"|"Em andamento"|"Não se aplica"|null,
  "exclusivity": boolean|null, "description": string|null, "commercial_notes": string|null,
  "origin": string|null, "capture_origin": string|null
 }
}
Regras:
- Preserve fielmente o que foi dito; não complete endereço, bairro, preço ou características por conta própria.
- "três quartos, sendo uma suíte" significa bedrooms=3 e suites=1.
- Não confunda área construída com área do lote. Se o tipo de área não estiver claro, coloque a medida em description e deixe area_m2=null.
- Se uma informação estiver incerta ou inaudível, deixe null em vez de adivinhar.
- "para vender" => purpose="venda"; "para alugar" => purpose="locacao"; "venda ou aluguel" => purpose="venda_locacao".
- Só preencha status se a pessoa o disser explicitamente; caso contrário null.
- Não associe proprietário a cadastro existente e não crie nome/telefone de proprietário a partir deste áudio.
- title pode ser uma referência curta montada apenas com dados explicitamente mencionados, como tipo e bairro; se não houver o suficiente, null.
- Use descrição para características e diferenciais do imóvel. Use commercial_notes para condições de negociação ou informações internas explicitamente ditas.`;

  const { data: quotaAllowed, error: quotaError } = await supabase.rpc("consume_ai_quota", { p_feature: "audio" });
  if (quotaError) { console.error("AI audio quota check failed:", quotaError.message); return out({ error: "Não foi possível validar seu limite diário de IA. Tente novamente em instantes." }, 503); }
  if (quotaAllowed !== true) return out({ error: "Você atingiu o limite diário de 30 análises de áudio. Tente novamente amanhã." }, 429);
  const model = Deno.env.get("GEMINI_AUDIO_MODEL")?.trim() || "gemini-3.8-flash";

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { inlineData: { mimeType, data: audioBase64 } },
          { text: prompt },
        ] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      }),
    });
    if (!response.ok) {
      const details = await response.text();
      console.error("Gemini audio parsing failed:", response.status, details.slice(0, 500));
      if (response.status === 429) return out({ error: "A IA está temporariamente ocupada. Aguarde alguns segundos e tente novamente." }, 503);
      return out({ error: "A IA não conseguiu interpretar esse áudio. Tente gravar novamente com menos ruído." }, 502);
    }
    const result = await response.json();
    const raw = (result.candidates?.[0]?.content?.parts || []).map((part: { text?: string }) => part.text || "").join("").trim();
    if (!raw) return out({ error: "Não consegui entender o áudio. Tente falar um pouco mais devagar." }, 422);
    let parsed: { fields?: Record<string, unknown> };
    try { parsed = JSON.parse(raw); } catch {
      console.error("Gemini returned invalid JSON for property audio.");
      return out({ error: "A resposta da IA veio em formato inválido. Tente novamente." }, 502);
    }
    if (!parsed.fields || typeof parsed.fields !== "object" || Array.isArray(parsed.fields)) {
      return out({ error: "Não identifiquei os dados do imóvel nesse áudio. Tente descrever o imóvel novamente." }, 422);
    }

    const stringFields = ["title","property_code","neighborhood","city","address","address_number","address_complement","zip_code","description","commercial_notes","origin","capture_origin"];
    const numberFields = ["bedrooms","suites","bathrooms","parking_spaces","area_m2","asking_price","condominium_fee","iptu_amount"];
    const fields: Record<string, unknown> = {};
    for (const key of stringFields) {
      const value = parsed.fields[key];
      if (typeof value === "string" && value.trim()) fields[key] = value.trim().slice(0, 3000);
    }
    for (const key of numberFields) {
      const value = parsed.fields[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000) fields[key] = value;
    }
    const enums: Record<string, string[]> = {
      property_type: ["Apartamento","Casa","Cobertura","Loja","Lote","Conjunto","Outro"],
      purpose: ["venda","locacao","venda_locacao"],
      status: ["ativo","reservado","vendido","inativo"],
      habite_se: ["Sim","Não","Em andamento","Não se aplica"],
    };
    for (const [key, values] of Object.entries(enums)) {
      if (typeof parsed.fields[key] === "string" && values.includes(parsed.fields[key] as string)) fields[key] = parsed.fields[key];
    }
    if (typeof parsed.fields.exclusivity === "boolean") fields.exclusivity = parsed.fields.exclusivity;
    if (!Object.keys(fields).length) return out({ error: "Não consegui identificar campos suficientes. Tente falar tipo, bairro, preço e características." }, 422);
    return out({ fields });
  } catch (error) {
    console.error("Property audio processing error:", error instanceof Error ? error.message : String(error));
    return out({ error: "Não consegui processar o áudio agora. Verifique sua conexão e tente novamente." }, 502);
  }
});
