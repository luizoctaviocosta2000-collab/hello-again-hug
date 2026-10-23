import { describe, expect, test } from "bun:test";
import { financialSummary, isInPeriod, localDateKey } from "../src/lib/financial-summary";
const now = new Date(2026, 9, 22, 12);
const commissions = [{ id: "old", user_amount: 1000, status: "received" }, { id: "new", user_amount: 500, status: "receivable" }];
describe("cash and outstanding balance share receipt source", () => {
  test("old commission paid now counts as cash in this month", () => {
    const summary = financialSummary(commissions, [{commission_id:"old",amount:400,received_at:"2026-10-15T15:00:00Z"}], "current", now);
    expect(summary.received).toBe(400); expect(summary.receivable).toBe(1100);
  });
  test("status alone never invents a payment", () => {
    const result=financialSummary(commissions,[],"current",now);
    expect(result.received).toBe(0);expect(result.receivable).toBe(1500);expect(result.inconsistent).toBe(1);
  });
  test("older cash reduces outstanding balance but not current cash", () => {
    const result=financialSummary(commissions,[{commission_id:"old",amount:1000,received_at:"2026-09-01T12:00:00Z"}],"current",now);
    expect(result.received).toBe(0);expect(result.receivable).toBe(500);expect(result.inconsistent).toBe(0);
  });
  test("no artificial cap on cash and no negative outstanding balance", () => {
    const result=financialSummary(commissions,[{commission_id:"new",amount:600}]);
    expect(result.received).toBe(600);expect(result.receivable).toBe(1000);
  });
  test("cent arithmetic reconciles fractional payments",()=>{
    const result=financialSummary([{id:"x",user_amount:0.3}],[{commission_id:"x",amount:0.1},{commission_id:"x",amount:0.2}]);
    expect(result.received).toBe(0.3);expect(result.receivable).toBe(0);
  });
  test("unrelated receipts do not enter the summary",()=>expect(financialSummary(commissions,[{commission_id:"unknown",amount:50}]).received).toBe(0));
});
describe("calendar period boundaries",()=>{
  test("current month excludes future and previous months",()=>{
    expect(isInPeriod("2026-10-01","current",now)).toBe(true);
    expect(isInPeriod("2026-10-31","current",now)).toBe(true);
    expect(isInPeriod("2026-11-01","current",now)).toBe(false);
    expect(isInPeriod("2026-09-30","current",now)).toBe(false);
  });
  test("six months include May through October",()=>{
    expect(isInPeriod("2026-05-01","6m",now)).toBe(true);
    expect(isInPeriod("2026-04-30","6m",now)).toBe(false);
    expect(isInPeriod("2026-11-01","6m",now)).toBe(false);
  });
  test("invalid and missing dates do not count",()=>{
    expect(isInPeriod(null,"all",now)).toBe(false);
    expect(isInPeriod("invalid","current",now)).toBe(false);
  });
  test("visit edit and today use local calendar, including after UTC midnight",()=>{
    const previous=process.env.TZ;process.env.TZ="America/Sao_Paulo";
    try {expect(localDateKey("2026-10-22T01:30:00Z")).toBe("2026-10-21");}
    finally {if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
  });
});
