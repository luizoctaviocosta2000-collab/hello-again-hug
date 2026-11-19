import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { metaPeriod, readMetaInsights } from "../_shared/meta-insights.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { ...cors, "Cache-Control": "no-store" },
  });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: "Método não permitido." }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond({ error: "Faça login." }, 401);
  const url = Deno.env.get("SUPABASE_URL"),
    key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return respond({ error: "Serviço indisponível." }, 503);
  const db = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return respond({ error: "Sessão inválida." }, 401);
  // Controlled initial connection, provisioned by an administrator in Edge
  // secrets after verifying asset ownership. No client-supplied tenant/token.
  const owner = Deno.env.get("IMOBFY_META_OWNER_ID");
  const token = Deno.env.get("IMOBFY_META_READ_TOKEN");
  const adAccountId = Deno.env.get("IMOBFY_META_AD_ACCOUNT_ID");
  const version = Deno.env.get("IMOBFY_META_GRAPH_VERSION");
  if (owner !== user.id || !token || !adAccountId || !version)
    return respond({ error: "Conta Meta não conectada para este usuário." }, 409);
  let body: { since?: string; until?: string; level?: string };
  try {
    body = await req.json();
    if (!body || typeof body.since !== "string" || typeof body.until !== "string")
      throw new Error("invalid");
    metaPeriod(body.since, body.until);
    if (!["campaign", "adset", "ad"].includes(body.level ?? "campaign")) throw new Error("invalid");
  } catch {
    return respond({ error: "Informe nível e período válido de até 93 dias." }, 400);
  }
  try {
    return respond(
      await readMetaInsights(
        { token, adAccountId, version },
        { since: body.since!, until: body.until! },
        (body.level ?? "campaign") as "campaign" | "adset" | "ad",
      ),
    );
  } catch {
    return respond(
      {
        error:
          "A Meta não forneceu uma base completa e válida. Verifique token, permissão ads_read, moeda BRL e disponibilidade. Nenhuma métrica foi estimada.",
      },
      502,
    );
  }
});
