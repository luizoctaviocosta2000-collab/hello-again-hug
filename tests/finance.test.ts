import { describe, expect, test } from "bun:test";
import { calculateCommission, DEFAULT_FINANCE_RULES, formatBRL } from "../src/lib/finance";

describe("commission calculation specification (not the SQL trigger)", () => {
  test("calculates the default sale commission chain", () => {
    const result = calculateCommission(500_000);
    expect(result.grossCommission).toBe(30_000);
    expect(result.tax).toBe(2_700);
    expect(result.netCommission).toBe(27_300);
    expect(result.userCommission).toBe(5_460);
  });

  test("uses the configured brokerage percentage", () => {
    const result = calculateCommission(200_000, { ...DEFAULT_FINANCE_RULES, commissionPercent: 5 });
    expect(result.grossCommission).toBe(10_000);
    expect(result.netCommission).toBe(9_100);
  });

  test("calculates tax on gross brokerage, not on the property value", () => {
    const result = calculateCommission(500_000);
    expect(result.tax).toBe(2_700);
    expect(result.tax).not.toBe(45_000);
  });

  test("uses the configured participation for a regular sale", () => {
    const result = calculateCommission(100_000, { ...DEFAULT_FINANCE_RULES, participationPercent: 25 }, "sale");
    expect(result.userCommission).toBe(1_365);
  });

  test("uses 10 percent participation for a split sale", () => {
    const result = calculateCommission(500_000, DEFAULT_FINANCE_RULES, "sale_split");
    expect(result.userCommission).toBe(2_730);
  });

  test("uses 10 percent participation for a split capture", () => {
    const result = calculateCommission(500_000, DEFAULT_FINANCE_RULES, "capture_split");
    expect(result.userCommission).toBe(2_730);
  });

  test("clamps zero and negative property values to zero", () => {
    expect(calculateCommission(0).userCommission).toBe(0);
    expect(calculateCommission(-100).userCommission).toBe(0);
  });

  test("formats currency in Brazilian Real", () => {
    expect(formatBRL(5_460)).toContain("5.460,00");
  });
});
