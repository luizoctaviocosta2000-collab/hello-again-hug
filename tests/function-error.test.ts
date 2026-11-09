import { describe, expect, test } from "bun:test";
import { readableFunctionError } from "../src/lib/function-error";

describe("AI function errors", () => {
  test("shows the useful function message and leaves the original response readable", async () => {
    const context = Response.json({ error: "Limite diário atingido." }, { status: 429 });
    expect(await readableFunctionError({ name: "FunctionsHttpError", context })).toBe("Limite diário atingido.");
    expect(await context.json()).toEqual({ error: "Limite diário atingido." });
  });
  test("does not display proxy HTML or implementation details", async () => {
    const context = new Response("<html>Internal proxy configuration</html>", { status: 502 });
    const message = await readableFunctionError({ name: "FunctionsHttpError", context });
    expect(message).toContain("Tente novamente");
    expect(message).not.toContain("Internal proxy");
  });
  test("recognizes an SDK-wrapped timeout", async () => {
    const message = await readableFunctionError({ name: "FunctionsFetchError", context: new DOMException("Aborted", "AbortError") });
    expect(message).toContain("demorou mais");
  });
});
