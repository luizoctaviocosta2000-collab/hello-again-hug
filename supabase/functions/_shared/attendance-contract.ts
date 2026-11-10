/**
 * Contrato de saída do simulador. Não envia mensagens e não grava leads.
 * Todas as strings vindas do Gemini são tratadas como dados não confiáveis.
 */
export type AttendanceRole = "customer" | "assistant";
export type AttendanceTurn = { role: AttendanceRole; text: string };
export type AttendanceBrief = {
  intent: string;
  objection: string | null;
  budget_brl: number | null;
  preferred_neighborhood: string | null;
  handoff_required: boolean;
  handoff_reason: string | null;
  next_step: string;
};
export type AttendanceDraft = { draft: string; brief: AttendanceBrief };

function short(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function requiresHumanForOffer(message: string): boolean {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(proposta|contraproposta|desconto|negociar|negociacao|baixar o preco|fechar por|aceita(ria)?\s+(r\$|\d)|ofereco|oferta de \d)/i.test(normalized);
}

export function parseAttendanceDraft(raw: string, message: string): AttendanceDraft {
  const text = raw.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, "");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("A IA não retornou um resultado estruturado válido."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Resposta inválida da IA.");
  const obj = value as Record<string, unknown>;
  const draft = short(obj.reply, 1800);
  if (!draft || draft.length < 3) throw new Error("A IA não gerou uma resposta utilizável.");
  const forcedHandoff = requiresHumanForOffer(message);
  const handoff = forcedHandoff || obj.handoff_required === true;
  const amount = obj.budget_brl;
  return {
    draft: forcedHandoff
      ? "Entendi sua proposta ou pedido de negociação. Vou encaminhar ao corretor responsável para verificar as possibilidades com o proprietário. Não consigo confirmar descontos ou condições por aqui."
      : draft,
    brief: {
      intent: short(obj.intent, 120) || "Interesse no imóvel",
      objection: short(obj.objection, 180) || null,
      budget_brl: typeof amount === "number" && Number.isFinite(amount) && amount > 0 && amount < 1_000_000_000 ? amount : null,
      preferred_neighborhood: short(obj.preferred_neighborhood, 120) || null,
      handoff_required: handoff,
      handoff_reason: forcedHandoff ? "Negociação comercial exige avaliação humana." : short(obj.handoff_reason, 240) || null,
      next_step: short(obj.next_step, 240) || "Revisar e decidir o próximo contato.",
    },
  };
}

export function safeAttendanceHistory(input: unknown): AttendanceTurn[] {
  if (!Array.isArray(input)) return [];
  return input.slice(-12).flatMap((row: unknown) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const role = item.role;
    if (role !== "customer" && role !== "assistant") return [];
    const value = short(item.text, 1500);
    return value ? [{ role, text: value }] : [];
  });
}
