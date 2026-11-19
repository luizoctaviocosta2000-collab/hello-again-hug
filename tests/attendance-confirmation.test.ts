import { expect, test } from "bun:test";
import { parseAttendanceDraft } from "../supabase/functions/_shared/attendance-contract";

test("a model cannot declare a booking or transfer completed through the draft contract", () => {
  for (const reply of [
    "Sua visita está confirmada.",
    "Agendei para amanhã.",
    "Transferi seu atendimento.",
  ]) {
    const result = parseAttendanceDraft(
      JSON.stringify({ reply, handoff_required: false, next_step: "Aguardar" }),
      "Olá",
    );
    expect(result.brief.handoff_required).toBe(true);
    expect(result.draft).not.toBe(reply);
    expect(result.brief.next_step).toContain("nenhuma ação externa");
  }
});
test("appointment request requires human confirmation regardless of model flag", () => {
  const result = parseAttendanceDraft(
    JSON.stringify({ reply: "Tudo certo!", handoff_required: false }),
    "Pode agendar uma visita?",
  );
  expect(result.brief.handoff_required).toBe(true);
});
