import { describe, expect, test } from "bun:test";
import { buildSpecialistReport, isSpecialistKind, parseSpecialistBriefing } from "../supabase/functions/_shared/specialist-agents";

const now = new Date("2026-11-18T12:00:00.000Z");
describe("IMOBFY specialist agents: safe, evidence-only reports", () => {
  test("allows only the four configured specialist domains", () => {
    for (const agent of ["ads","atendimento","comercial","financeiro"]) expect(isSpecialistKind(agent)).toBe(true);
    for (const invalid of ["admin","execute_campaign",null,{},""]) expect(isSpecialistKind(invalid)).toBe(false);
  });

  test("never makes up ad performance without registered campaigns", () => {
    const report = buildSpecialistReport("ads", {}, now);
    expect(report.coverage).toBe("sem_dados");
    expect(report.metrics.find(x=>x.label==="Custo por lead vinculado")?.value).toBe("Sem base");
    expect(report.recommendations[0]?.requiresApproval).toBe(true);
    expect(report.mode).toBe("regras");
  });

  test("counts only matching, evidence-linked and deduplicated ad funnel stages", () => {
    const metrics = [{ report_date:"2026-11-12",ad_account_id:"act_A",campaign_id:"campaign1",campaign_name:"A",spend_brl:"200",clicks:40 }];
    const events = [
      {ad_account_id:"act_A",campaign_id:"campaign1",client_id:"c1",stage:"lead",occurred_at:"2026-11-13T10:00:00Z"},
      {ad_account_id:"act_A",campaign_id:"campaign1",client_id:"c1",stage:"lead",occurred_at:"2026-11-13T11:00:00Z"},
      {ad_account_id:"act_A",campaign_id:"campaign1",client_id:"c1",stage:"qualificado",occurred_at:"2026-11-13T11:00:00Z"},
      {ad_account_id:"act_B",campaign_id:"campaign1",client_id:"c2",stage:"lead",occurred_at:"2026-11-13T11:00:00Z"},
      {ad_account_id:"act_A",campaign_id:"campaign2",client_id:"c3",stage:"lead",occurred_at:"2026-11-13T11:00:00Z"},
      {ad_account_id:null,campaign_id:"campaign1",client_id:"c4",stage:"lead",occurred_at:"2026-11-13T11:00:00Z"},
    ];
    const report = buildSpecialistReport("ads",{metrics,events},now);
    expect(report.metrics.find(x=>x.label==="Leads vinculados")?.value).toBe("1");
    expect(report.metrics.find(x=>x.label==="Leads qualificados")?.value).toBe("1");
    expect(report.metrics.find(x=>x.label==="Custo por lead vinculado")?.value).toContain("200,00");
    expect(report.notice).toContain("não importadas");
  });

  test("keeps attendance internal and prioritizes human handoffs", () => {
    const report = buildSpecialistReport("atendimento",{threads:[
      {status:"open"},{status:"handoff"},{status:"paused"}
    ],messages:[{role:"assistant_draft"},{role:"customer"}]},now);
    expect(report.coverage).toBe("com_dados");
    expect(report.metrics.find(x=>x.label==="Rascunhos salvos")?.value).toBe("1");
    expect(report.recommendations[0]?.priority).toBe("alta");
    expect(report.notice).toContain("Sem conexão");
  });

  test("spots stale active deals and excludes closed deals", () => {
    const report = buildSpecialistReport("comercial",{deals:[
      {status:"new",updated_at:"2026-11-01T00:00:00Z"},
      {status:"closed",updated_at:"2026-10-01T00:00:00Z"},
      {status:"new",updated_at:"2026-11-18T00:00:00Z"},
    ],visits:[{status:"scheduled",starts_at:"2026-11-19T12:00:00Z"}]},now);
    expect(report.metrics.find(x=>x.label==="Negócios em aberto")?.value).toBe("2");
    expect(report.metrics.find(x=>x.label==="Sem atualização há 7+ dias")?.value).toBe("1");
    expect(report.recommendations[0]?.priority).toBe("alta");
  });

  test("derives financial amounts from registered receipts, never from AI", () => {
    const report = buildSpecialistReport("financeiro",{
      commissions:[{id:"commission-1",user_amount:"500.00"}],
      receipts:[{commission_id:"commission-1",amount:"125.30",received_at:"2026-11-17"}],
      vgv:[{vgv:"750000",reference_month:"2026-11-01"}],
    },now);
    expect(report.metrics.find(x=>x.label==="Saldo pendente (base)")?.value).toContain("374,70");
    expect(report.metrics.find(x=>x.label==="VGV registrado (base)")?.value).toContain("750.000,00");
    expect(report.metrics.find(x=>x.label==="Recebido nos últimos 30 dias")?.value).toContain("125,30");
    expect(report.recommendations.every(x=>x.requiresApproval)).toBe(true);
  });

  test("refuses to label truncated datasets as official totals", () => {
    const report = buildSpecialistReport("financeiro",{commissions:[{id:"a",user_amount:100}]},now,true);
    expect(report.coverage).toBe("amostra");
    expect(report.notice).toContain("incompletos");
  });

  test("accepts only bounded qualitative model text with no numbers or identifiers", () => {
    expect(parseSpecialistBriefing('{"briefing":"Priorize qualificação antes de aumentar os investimentos."}'))
      .toContain("Priorize");
    for(const text of [
      "not JSON",
      '{"briefing":"Gaste R$ 200,00 agora."}',
      '{"briefing":"Me envie email@example.com."}',
      '{"briefing":"Veja https://exemplo.com"}',
      '{"briefing":"ok"}',
      '{"briefing":123}',
    ]) expect(parseSpecialistBriefing(text)).toBeNull();
  });
});
