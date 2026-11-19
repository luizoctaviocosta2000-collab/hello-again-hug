/** Verify the exact HTTP body before interpreting any tenant or message ID. */
export async function validWhatsAppSignature(
  body: Uint8Array,
  signature: string | null,
  secret: string,
) {
  if (!signature || !/^sha256=[0-9a-f]{64}$/.test(signature) || secret.length < 16) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(signature.slice(7).match(/../g)!, (hex) => parseInt(hex, 16));
  return crypto.subtle.verify("HMAC", key, bytes, new Uint8Array(body));
}
export type WhatsAppEvent = {
  event_key: string;
  phone_number_id: string;
  waba_id: string;
  message_id: string;
  kind: "inbound" | "sent" | "delivered" | "read" | "failed";
  occurred_at: string;
  payload: Record<string, unknown>;
};
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export function whatsappEvents(input: unknown): WhatsAppEvent[] {
  const body = object(input);
  if (body.object !== "whatsapp_business_account" || !Array.isArray(body.entry))
    throw new Error("WHATSAPP_PAYLOAD_INVALID");
  const events: WhatsAppEvent[] = [];
  for (const entryValue of body.entry) {
    const entry = object(entryValue);
    if (!/^\d{6,25}$/.test(String(entry.id)) || !Array.isArray(entry.changes))
      throw new Error("WHATSAPP_ENTRY_INVALID");
    for (const changeValue of entry.changes) {
      const change = object(changeValue);
      if (change.field !== "messages") continue;
      const value = object(change.value);
      const phone = String(object(value.metadata).phone_number_id ?? "");
      if (!/^\d{6,25}$/.test(phone)) throw new Error("WHATSAPP_PHONE_INVALID");
      const add = (raw: unknown, inbound: boolean) => {
        const message = object(raw),
          id = String(message.id ?? "");
        const kind = inbound ? "inbound" : message.status;
        const timestamp = Number(message.timestamp);
        if (
          !/^wamid\.[A-Za-z0-9+/=_-]{1,174}$/.test(id) ||
          !["inbound", "sent", "delivered", "read", "failed"].includes(String(kind)) ||
          !Number.isSafeInteger(timestamp) ||
          timestamp < 1 ||
          timestamp > 253402300799
        )
          throw new Error("WHATSAPP_EVENT_INVALID");
        const occurred_at = new Date(timestamp * 1000).toISOString();
        events.push({
          event_key: `${phone}:${id}:${kind}`,
          phone_number_id: phone,
          waba_id: String(entry.id),
          message_id: id,
          kind: kind as WhatsAppEvent["kind"],
          occurred_at,
          // Only message/status, never whole webhook with unrelated contacts.
          payload: message,
        });
      };
      if (Array.isArray(value.messages)) value.messages.forEach((m) => add(m, true));
      if (Array.isArray(value.statuses)) value.statuses.forEach((s) => add(s, false));
      if (events.length > 100) throw new Error("WHATSAPP_BATCH_TOO_LARGE");
    }
  }
  return events;
}

export async function boundedWebhookBody(req: Request, maxBytes = 262144) {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("EMPTY_BODY");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw new Error("BODY_TOO_LARGE");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
