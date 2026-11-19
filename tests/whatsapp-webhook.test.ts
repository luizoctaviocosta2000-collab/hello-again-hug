import { expect, test } from "bun:test";
import {
  boundedWebhookBody,
  validWhatsAppSignature,
  whatsappEvents,
} from "../supabase/functions/_shared/whatsapp-webhook";

test("signature binds raw bytes, rejects tampering, missing and malformed signature", async () => {
  const secret = "synthetic-secret-not-real";
  const body = new TextEncoder().encode('{"test":true}');
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, body));
  const signature = "sha256=" + [...digest].map((n) => n.toString(16).padStart(2, "0")).join("");
  expect(await validWhatsAppSignature(body, signature, secret)).toBe(true);
  expect(await validWhatsAppSignature(new Uint8Array([...body, 32]), signature, secret)).toBe(
    false,
  );
  expect(await validWhatsAppSignature(body, null, secret)).toBe(false);
  expect(await validWhatsAppSignature(body, "sha256=bad", secret)).toBe(false);
});
test("event keys distinguish delivery states and preserve stable inbound deduplication", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "123456",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "789123" },
              messages: [
                {
                  id: "wamid.abc",
                  timestamp: "1795000000",
                  type: "text",
                  text: { body: "Fictício" },
                },
              ],
              statuses: [{ id: "wamid.abc", timestamp: "1795000001", status: "delivered" }],
            },
          },
        ],
      },
    ],
  };
  const result = whatsappEvents(payload);
  expect(result.length).toBe(2);
  expect(result[0]?.event_key).not.toBe(result[1]?.event_key);
  expect(whatsappEvents(payload)).toEqual(result);
  expect(() => whatsappEvents({ object: "other" })).toThrow();
});
test("body limit is enforced without trusting Content-Length", async () => {
  await expect(
    boundedWebhookBody(
      new Request("https://test.invalid", {
        method: "POST",
        body: "123456",
      }),
      5,
    ),
  ).rejects.toThrow("BODY_TOO_LARGE");
});
