import { expect, test } from "bun:test";
import { buildSpecialistReport } from "../supabase/functions/_shared/specialist-agents";
const now = new Date("2026-11-18T12:00:00Z");
test("financial recent receipts exclude future and invalid timestamps", () => {
  const r = buildSpecialistReport(
    "financeiro",
    {
      commissions: [{ id: "c", user_amount: 1000 }],
      receipts: [
        { commission_id: "c", amount: 10, received_at: "2026-11-18T11:00:00Z" },
        { commission_id: "c", amount: 200, received_at: "2026-11-18T15:00:00Z" },
        { commission_id: "c", amount: 300, received_at: "2027-01-01" },
        { commission_id: "c", amount: 400, received_at: "invalid" },
      ],
    },
    now,
  );
  expect(r.metrics.find((m) => m.label === "Recebido nos últimos 30 dias")?.value).toBe(
    (10).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  );
});
test("commercial upcoming visits count only recognized active states", () => {
  const r = buildSpecialistReport(
    "comercial",
    {
      deals: [{ status: "new" }],
      visits: [
        "cancelado",
        "realizado",
        "no_show",
        "unknown",
        "confirmed",
        "confirmado",
        "pendente",
        "scheduled",
      ].map((status) => ({ status, starts_at: "2026-11-19T12:00:00Z" })),
    },
    now,
  );
  expect(r.metrics.find((m) => m.label === "Visitas nos próximos 7 dias")?.value).toBe("4");
});
test("ads 30 calendar days does not accidentally include a 31st day", () => {
  const r = buildSpecialistReport(
    "ads",
    {
      metrics: [
        { report_date: "2026-10-19", spend_brl: 100 },
        { report_date: "2026-10-20", spend_brl: 25 },
      ],
    },
    now,
  );
  expect(r.metrics[0].value).toBe(
    (25).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  );
});

test("coverage detects caps smaller than requested and accepts exactly complete 500 rows", async () => {
  const { isIncompleteAgentDataset } = await import("../supabase/functions/_shared/agent-coverage");
  expect(isIncompleteAgentDataset(700, 100)).toBe(true);
  expect(isIncompleteAgentDataset(null, 100)).toBe(true);
  expect(isIncompleteAgentDataset(500, 500)).toBe(false);
  expect(isIncompleteAgentDataset(0, 0)).toBe(false);
  expect(isIncompleteAgentDataset(1, 2)).toBe(true);
});
