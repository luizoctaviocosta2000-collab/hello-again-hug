import { expect, test } from "bun:test";
import { metaPeriod, readMetaInsights } from "../supabase/functions/_shared/meta-insights";

const connection = {
  token: "synthetic-token-not-real-123",
  adAccountId: "act_123456",
  version: "v27.0",
};
const period = { since: "2026-11-01", until: "2026-11-19" };
const row = {
  account_id: "123456",
  campaign_id: "789123",
  campaign_name: "Fictícia",
  spend: "40.50",
  impressions: "100",
  clicks: "5",
  reach: "80",
  actions: [
    { action_type: "lead", value: "2" },
    { action_type: "offsite_conversion.fb_pixel_lead", value: "2" },
  ],
};
const fixture = (pages: unknown[], currency = "BRL") => {
  const calls: string[] = [];
  const fetcher = (async (url: unknown) => {
    calls.push(String(url));
    return Response.json(
      calls.length === 1
        ? { id: "act_123456", currency, timezone_name: "America/Sao_Paulo" }
        : pages.shift(),
    );
  }) as typeof fetch;
  return { calls, fetcher };
};
test("official rows keep Meta attribution separate, without overlapping leads", async () => {
  const f = fixture([{ data: [row] }]);
  const result = await readMetaInsights(connection, period, "campaign", f.fetcher);
  expect(result.rows[0]?.meta_leads).toBe(2);
  expect(result.rows[0]?.spend_brl).toBe(40.5);
  expect(result.source).toBe("meta");
  expect(f.calls.join()).not.toContain(connection.token);
});
test("pagination ignores untrusted next URLs and rejects repeated cursors", async () => {
  const f = fixture([
    { data: [row], paging: { next: "https://attacker.invalid", cursors: { after: "cursor" } } },
    { data: [], paging: { next: "https://attacker.invalid", cursors: { after: "cursor" } } },
  ]);
  await expect(readMetaInsights(connection, period, "campaign", f.fetcher)).rejects.toThrow(
    "META_PAGINATION_INVALID",
  );
  expect(f.calls.every((u) => u.startsWith("https://graph.facebook.com/v27.0/"))).toBe(true);
});
test("rejects currency, ownership, malformed metrics and duplicate rows", async () => {
  const usd = fixture([], "USD");
  await expect(readMetaInsights(connection, period, "campaign", usd.fetcher)).rejects.toThrow();
  expect(usd.calls.length).toBe(1);
  for (const rows of [[{ ...row, account_id: "999999" }], [{ ...row, spend: "NaN" }], [row, row]]) {
    const f = fixture([{ data: rows }]);
    await expect(readMetaInsights(connection, period, "campaign", f.fetcher)).rejects.toThrow();
  }
});
test("validates actual calendar dates and bounds period", () => {
  expect(() => metaPeriod("2026-02-30", "2026-03-01")).toThrow();
  expect(() => metaPeriod("2026-01-01", "2026-11-19")).toThrow();
});
