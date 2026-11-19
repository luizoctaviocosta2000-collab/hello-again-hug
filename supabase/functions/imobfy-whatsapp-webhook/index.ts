import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  boundedWebhookBody,
  validWhatsAppSignature,
  whatsappEvents,
} from "../_shared/whatsapp-webhook.ts";

const reply = (status: number) =>
  new Response(null, { status, headers: { "Cache-Control": "no-store" } });
Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("IMOBFY_META_APP_SECRET");
  const verify = Deno.env.get("IMOBFY_WHATSAPP_VERIFY_TOKEN");
  if (!secret || !verify || verify.length < 32) return reply(503);
  if (req.method === "GET") {
    const params = new URL(req.url).searchParams;
    const challenge = params.get("hub.challenge");
    if (
      params.get("hub.mode") !== "subscribe" ||
      params.get("hub.verify_token") !== verify ||
      !challenge ||
      !/^\d{1,100}$/.test(challenge)
    )
      return reply(403);
    return new Response(challenge, {
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  }
  if (req.method !== "POST") return reply(405);
  let body: Uint8Array;
  try {
    body = await boundedWebhookBody(req);
  } catch {
    return reply(413);
  }
  if (!(await validWhatsAppSignature(body, req.headers.get("x-hub-signature-256"), secret)))
    return reply(401);
  try {
    const events = whatsappEvents(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)),
    );
    const url = Deno.env.get("SUPABASE_URL"),
      key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return reply(503);
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const event of events) {
      // Tenant mapping is private DB state, never a webhook-provided user ID.
      // Atomic RPC persists the event before ACK; duplicates are harmless.
      const { error } = await db.rpc("imobfy_accept_whatsapp_event", { p_event: event });
      if (error) return reply(503); // Meta retries; do not acknowledge lost data
    }
    return reply(200);
  } catch {
    return reply(400);
  } // No payload, token or contact information in logs
});
