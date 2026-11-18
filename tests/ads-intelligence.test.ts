import { describe, expect, test } from "bun:test";
import { adsAdvice, safeCostPer, summarizeAds, type AdDailyMetric, type AdFunnelEvent } from "../src/lib/ads-intelligence";

const daily: AdDailyMetric[] = [
 { report_date:"2026-11-18",ad_account_id:"act_1",campaign_id:"cmp_1",campaign_name:"Pampulha",spend_brl:100,clicks:40,impressions:1000,source:"manual" },
 { report_date:"2026-11-19",ad_account_id:"act_1",campaign_id:"cmp_1",campaign_name:"Pampulha",spend_brl:"50",clicks:20,impressions:500,source:"manual" },
 { report_date:"2026-11-18",ad_account_id:"act_2",campaign_id:"cmp_1",campaign_name:"Outro",spend_brl:50,clicks:10,impressions:200,source:"manual" },
];
const row=(id:string,stage:AdFunnelEvent["stage"],clientId:string, account: string | null="act_1"):AdFunnelEvent=>({
 id,event_key:id,stage,campaign_id:"cmp_1",ad_account_id:account,
 client_id:clientId,deal_id:null,occurred_at:"2026-11-19T12:00:00.000Z",source:"manual",
});
describe("Ads Intelligence — measured attribution and costs", () => {
 test("aggregates only measured spend and distinct attributed leads",()=>{
  const events=[row("e1","lead","client-a"),row("e2","lead","client-a"),row("e3","qualificado","client-a"),row("e4","visita","client-a")];
  const a=summarizeAds(daily,events,"2026-11-01","2026-11-30");
  expect(a).toHaveLength(2);
  expect(a[0].spendBrl).toBe(150);
  expect(a[0].impressions).toBe(1500);
  expect(a[0].leads).toBe(1);
  expect(a[0].qualified).toBe(1);
  expect(a[0].cpl).toBe(150);
  expect(a[0].cpql).toBe(150);
  expect(a[0].cpv).toBe(150);
  expect(a[1].leads).toBe(0);
  expect(a[1].cpl).toBeNull();
 });
 test("does not attribute ambiguous or unattributed CRM records",()=>{
  const events=[row("e1","lead","client-a",null),
   {...row("e2","lead","client-b"),campaign_id:null},
   {...row("e3","venda","client-c"),client_id:null,deal_id:null},
  ];
  const a=summarizeAds(daily,events,"2026-11-01","2026-11-30");
  expect(a.every(c=>c.leads===0&&c.sales===0)).toBe(true);
 });
 test("never invents a conversion cost when there is no denominator",()=>{
  expect(safeCostPer(150,0)).toBeNull();
  expect(summarizeAds(daily,[],"2027-01-01","2027-01-31")).toEqual([]);
 });
 test("advice requires evidence and never generates automatic actions",()=>{
  const a=summarizeAds(daily,[row("e1","lead","client-a"),row("e2","lead","client-b"),
   row("e3","lead","client-c"),row("e4","lead","client-d"),row("e5","lead","client-e")],
   "2026-11-01","2026-11-30");
  const advice=adsAdvice(a);
  expect(advice.length).toBeGreaterThan(0);
  expect(advice[0].evidence).toContain("5 leads");
  expect(advice[0].message).toContain("Revise");
 });
});
