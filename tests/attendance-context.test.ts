import { expect, test } from "bun:test";
import { attendanceContext } from "../src/lib/attendance-context";

test("a saved unsent draft cannot become customer conversation history", () => {
  expect(
    attendanceContext([
      { role: "customer", body: "Tem garagem?" },
      { role: "assistant_draft", body: "Sua visita foi confirmada." },
      { role: "customer", body: "Qual o bairro?" },
      { role: "assistant_draft", body: "Texto ainda em revisão" },
    ]),
  ).toEqual({
    message: "Qual o bairro?",
    history: [{ role: "customer", text: "Tem garagem?" }],
  });
  expect(attendanceContext([{ role: "agent_note", body: "Interno" }])).toBeNull();
});
