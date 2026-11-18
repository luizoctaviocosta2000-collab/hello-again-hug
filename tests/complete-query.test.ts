import { expect, test } from "bun:test";
import { completeQuery } from "../src/lib/complete-query";
test("loads 1201 rows even when the server caps pages below the requested size", async () => {
  const all = Array.from({ length: 1201 }, (_, i) => ({ id: String(i), amount: 1 }));
  const result = await completeQuery(async (from) => ({
    data: all.slice(from, from + 200),
    count: all.length,
    error: null,
  }));
  expect(result.error).toBeNull();
  expect(result.data?.reduce((n, row) => n + row.amount, 0)).toBe(1201);
});
test("discards partial totals when a later page fails", async () => {
  const result = await completeQuery(async (from) =>
    from
      ? { data: null, count: null, error: new Error("offline") }
      : { data: [{ id: "1" }], count: 2, error: null },
  );
  expect(result.data).toBeNull();
  expect(result.error).toBeTruthy();
});
test("rejects count changes and overlapping pages instead of counting twice", async () => {
  for (const changedCount of [true, false]) {
    let n = 0;
    const result = await completeQuery(async () => ({
      data: [{ id: "1" }],
      count: changedCount && n++ ? 3 : 2,
      error: null,
    }));
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  }
});
test("accepts an empty dataset and rejects a prematurely empty page", async () => {
  expect((await completeQuery(async () => ({ data: [], count: 0, error: null }))).data).toEqual([]);
  expect((await completeQuery(async () => ({ data: [], count: 1, error: null }))).data).toBeNull();
});
