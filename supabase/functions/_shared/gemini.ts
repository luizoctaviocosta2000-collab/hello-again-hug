type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
export type GeminiRequest = {
  contents: Array<{ role: string; parts: GeminiPart[] }>;
  systemInstruction?: { parts: GeminiPart[] };
  generationConfig?: Record<string, unknown>;
};
export type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
};

export class GeminiError extends Error {
  constructor(public status: number, public model: string, public reason: string) {
    super(`Gemini request failed (${status}, ${reason})`);
    this.name = "GeminiError";
  }
}

export function geminiModels(preferred?: string, general?: string): string[] {
  // The common model is also the fallback when a feature-specific model is retired.
  const common = general?.trim() || "gemini-3.5-flash-lite";
  return [...new Set([preferred?.trim() || common, common])];
}

export async function generateWithGemini(options: {
  apiKey: string;
  models: string[];
  request: GeminiRequest;
  fetch?: typeof fetch;
  timeoutMs?: number;
  attemptTimeoutMs?: number;
  retryDelayMs?: number;
}): Promise<{ result: GeminiResponse; model: string }> {
  const fetcher = options.fetch ?? fetch;
  const deadline = Date.now() + (options.timeoutMs ?? 25_000);
  const models = [...new Set(options.models.map((model) => model.trim()).filter(Boolean))];
  if (!models.length) throw new GeminiError(503, "", "MODEL_NOT_CONFIGURED");
  let modelIndex = 0;
  let lastError = new GeminiError(504, models[0]!, "TIMEOUT");

  for (let attempt = 0; attempt < 3 && Date.now() < deadline; attempt++) {
    const model = models[modelIndex]!;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(options.attemptTimeoutMs ?? 8_000, deadline - Date.now()));
    let retry = false;
    try {
      const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": options.apiKey },
        body: JSON.stringify(options.request),
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch((error) => {
        if (controller.signal.aborted) throw error;
        return null;
      });
      if (response.ok) {
        if (!body || typeof body !== "object") throw new GeminiError(502, model, "INVALID_RESPONSE");
        return { result: body as GeminiResponse, model };
      }
      const providerError = (body as { error?: { status?: string; message?: string } } | null)?.error;
      const reason = typeof providerError?.status === "string" && /^[A-Z_]+$/.test(providerError.status) ? providerError.status : "HTTP_ERROR";
      lastError = new GeminiError(response.status, model, reason);
      const unavailableModel = response.status === 404 || (response.status === 400 && /model.*(?:not found|not supported|not available)|unsupported model/i.test(providerError?.message ?? ""));
      if (unavailableModel && modelIndex + 1 < models.length) {
        modelIndex++;
        retry = true;
      } else if ([429, 500, 502, 503, 504].includes(response.status)) {
        if (attempt >= 1 && modelIndex + 1 < models.length) modelIndex++;
        retry = true;
      } else {
        throw lastError;
      }
    } catch (error) {
      if (error instanceof GeminiError) throw error;
      lastError = new GeminiError(controller.signal.aborted ? 504 : 502, model, controller.signal.aborted ? "TIMEOUT" : "NETWORK_ERROR");
      if (attempt >= 1 && modelIndex + 1 < models.length) modelIndex++;
      retry = true;
    } finally {
      clearTimeout(timer);
    }
    if (!retry || attempt === 2) break;
    const delay = Math.min((options.retryDelayMs ?? 400) * (attempt + 1), Math.max(0, deadline - Date.now()));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw lastError;
}

export function geminiText(result: GeminiResponse): string {
  return (result.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("\n").trim();
}

export function geminiFailure(error: unknown): { status: number; message: string } {
  // Log only bounded metadata: never keys, prompts, media, or a provider response body.
  if (error instanceof GeminiError) {
    console.error("Gemini request failed", { status: error.status, model: error.model, reason: error.reason });
    if (error.status === 504) return { status: 504, message: "A IA demorou mais que o esperado. Tente novamente em instantes." };
    if (error.status === 429) return { status: 503, message: "A IA está temporariamente ocupada. Tente novamente em instantes." };
    if ([400, 401, 403, 404, 503].includes(error.status)) return { status: 503, message: "O serviço de IA está temporariamente indisponível. Tente novamente mais tarde." };
  }
  return { status: 502, message: "A IA não conseguiu concluir a análise agora. Tente novamente." };
}
