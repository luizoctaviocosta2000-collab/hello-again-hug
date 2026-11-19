// Run with Bun only after setting server-side environment variables securely.
// Synthetic data, max 3 attempts / 128 output tokens each; no CRM data.
import { generateWithGemini, geminiText } from "../../supabase/functions/_shared/gemini";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.IMOBFY_SMOKE_GEMINI_MODEL;
if (!apiKey || !model || process.env.IMOBFY_CONFIRM_PROVIDER_TEST !== "1")
  throw new Error(
    "Configure GEMINI_API_KEY, IMOBFY_SMOKE_GEMINI_MODEL and IMOBFY_CONFIRM_PROVIDER_TEST=1. No request made.",
  );
try {
  const started = Date.now();
  const result = await generateWithGemini({
    apiKey,
    models: [model],
    request: {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: 'Teste fictício de conectividade. Retorne somente {"status":"ok"}. Não execute ações.',
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 128,
        temperature: 0,
        responseMimeType: "application/json",
      },
    },
  });
  if (JSON.parse(geminiText(result)).status !== "ok") throw new Error("INVALID_CONTRACT");
  console.log(
    JSON.stringify({
      status: "PASS",
      model: result.model,
      elapsed_ms: Date.now() - started,
      scope: "provider-connectivity-only-not-auth-CRM-or-quality",
      max_attempts: 3,
      max_output_tokens_per_attempt: 128,
    }),
  );
} catch {
  console.error(
    "FAIL: provider connectivity/response contract. No key, prompt or provider body logged.",
  );
  process.exitCode = 1;
}
