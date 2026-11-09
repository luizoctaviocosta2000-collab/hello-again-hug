export async function readableFunctionError(error: unknown): Promise<string> {
  const candidate = error as { name?: string; message?: string; context?: unknown } | null;
  const context = candidate?.context;
  const causeName = context && typeof context === "object" && "name" in context ? context.name : undefined;
  if ([candidate?.name, causeName].some((name) => name === "AbortError" || name === "TimeoutError")) {
    return "A IA demorou mais que o esperado. Tente novamente em instantes.";
  }
  if (context instanceof Response) {
    try {
      const payload: unknown = await context.clone().json();
      if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") return payload.error;
    } catch { /* A proxy may return HTML rather than the function's JSON response. */ }
    if (context.status === 401) return "Sua sessão expirou. Entre novamente para continuar.";
    return "O serviço de IA não conseguiu concluir a solicitação. Tente novamente em instantes.";
  }
  if (candidate?.name === "FunctionsFetchError") return "Não foi possível conectar à IA. Verifique sua conexão e tente novamente.";
  if (candidate?.name === "FunctionsRelayError") return "O serviço de IA está temporariamente indisponível. Tente novamente em instantes.";
  return error instanceof Error ? error.message : "Não foi possível concluir a solicitação da IA.";
}
