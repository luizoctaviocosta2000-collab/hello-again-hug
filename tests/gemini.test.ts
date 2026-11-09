import { describe, expect, test } from "bun:test";
import { GeminiError, geminiModels, generateWithGemini } from "../supabase/functions/_shared/gemini";

const request = { contents: [{ role: "user", parts: [{ text: "synthetic test" }] }] };
const answer = () => Response.json({ candidates: [{ content: { parts: [{ text: "OK" }] } }] });

describe("Gemini transport", () => {
  test("falls back only when the feature-specific model is unavailable", async () => {
    const models: string[] = [];
    const result = await generateWithGemini({ apiKey: "test", models: geminiModels("retired-model", "current-model"), request, retryDelayMs: 0, fetch: (async (url: string | URL | Request) => {
      models.push(String(url));
      return models.length === 1 ? Response.json({ error: { status: "NOT_FOUND" } }, { status: 404 }) : answer();
    }) as typeof fetch });
    expect(result.model).toBe("current-model");
    expect(models).toHaveLength(2);
  });

  test("retries transient provider failures without changing the requested model", async () => {
    let calls = 0;
    const result = await generateWithGemini({ apiKey: "test", models: ["preferred", "fallback"], request, retryDelayMs: 0, fetch: (async () => ++calls === 1 ? Response.json({ error: { status: "UNAVAILABLE" } }, { status: 503 }) : answer()) as typeof fetch });
    expect(calls).toBe(2);
    expect(result.model).toBe("preferred");
  });

  test("does not retry authorization failures or invalid input", async () => {
    for (const status of [400, 401, 403]) {
      let calls = 0;
      await expect(generateWithGemini({ apiKey: "test", models: ["preferred", "fallback"], request, retryDelayMs: 0, fetch: (async () => { calls++; return Response.json({ error: { status: "INVALID_ARGUMENT", message: "Invalid image data" } }, { status }); }) as typeof fetch })).rejects.toBeInstanceOf(GeminiError);
      expect(calls).toBe(1);
    }
  });

  test("falls back after repeated overload while preserving time for the last attempt", async () => {
    const models: string[] = [];
    const result = await generateWithGemini({ apiKey: "test", models: ["preferred", "fallback"], request, retryDelayMs: 0, fetch: (async (url: string | URL | Request) => {
      models.push(String(url));
      return models.length < 3 ? Response.json({ error: { status: "UNAVAILABLE" } }, { status: 503 }) : answer();
    }) as typeof fetch });
    expect(models).toHaveLength(3);
    expect(models[0]).toBe(models[1]);
    expect(result.model).toBe("fallback");
  });

  test("bounds retries and never includes provider messages or keys in errors", async () => {
    let calls = 0;
    let caught: unknown;
    try {
      await generateWithGemini({ apiKey: "private-test-key", models: ["model"], request, retryDelayMs: 0, fetch: (async () => { calls++; return Response.json({ error: { status: "RESOURCE_EXHAUSTED", message: "sensitive provider details" } }, { status: 429 }); }) as typeof fetch });
    } catch (error) { caught = error; }
    expect(calls).toBe(3);
    expect(caught).toBeInstanceOf(GeminiError);
    expect(String(caught)).not.toContain("private-test-key");
    expect(String(caught)).not.toContain("sensitive provider details");
  });

  test("aborts stalled requests within the total deadline", async () => {
    let calls = 0;
    const start = Date.now();
    const fetcher = (async (_: unknown, init: RequestInit) => {
      calls++;
      return new Promise<Response>((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
    }) as typeof fetch;
    await expect(generateWithGemini({ apiKey: "test", models: ["model"], request, timeoutMs: 35, attemptTimeoutMs: 20, retryDelayMs: 0, fetch: fetcher })).rejects.toMatchObject({ status: 504, reason: "TIMEOUT" });
    expect(calls).toBeLessThanOrEqual(3);
    expect(Date.now() - start).toBeLessThan(500);
  });

  test("reports a timeout when headers arrive but the response body stalls", async () => {
    const fetcher = (async (_: unknown, init: RequestInit) => new Response(new ReadableStream({
      start(controller) {
        init.signal!.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
      },
    }))) as typeof fetch;
    await expect(generateWithGemini({ apiKey: "test", models: ["model"], request, timeoutMs: 35, attemptTimeoutMs: 20, retryDelayMs: 0, fetch: fetcher })).rejects.toMatchObject({ status: 504, reason: "TIMEOUT" });
  });
});
