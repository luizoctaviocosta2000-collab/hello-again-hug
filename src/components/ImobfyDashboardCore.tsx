import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, Home, Loader2, Target, Users, WalletCards } from "lucide-react";
import { supabase } from "../lib/supabase";
import { type ImobfyUser } from "../lib/imobfy-session";

const getGreeting = (date = new Date()) => {
  const hour = date.getHours();
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
};

type Deal = { id: string; status: string; property_value: number; created_at: string; updated_at?: string | null };
type Vgv = { id: string; deal_id: string | null; reference_month: string; vgv: number };
type Commission = { id: string; user_amount: number; status: string; created_at?: string; reference_month?: string | null };
type CommissionReceipt = { commission_id: string; amount: number; received_at?: string | null };
type Capture = { id: string; status: string };
type Appointment = { id: string; starts_at: string; status: string; client_id: string | null };
type Period = "current" | "6m" | "12m" | "all";
const money = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthName = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
const stageLabels: Record<string, string> = { new: "Novo", qualified: "Qualificado", properties_sent: "Imóveis enviados", visit_scheduled: "Visita agendada", visit_done: "Visita realizada", proposal: "Proposta", negotiation: "Negociação", closed: "Fechado", lost: "Perdido" };

export default function ImobfyDashboardCore({ user }: { user: ImobfyUser }) {
  const [deals, setDeals] = useState<Deal[]>([]), [vgv, setVgv] = useState<Vgv[]>([]), [commissions, setCommissions] = useState<Commission[]>([]), [receipts, setReceipts] = useState<CommissionReceipt[]>([]), [captures, setCaptures] = useState<Capture[]>([]), [appointments, setAppointments] = useState<Appointment[]>([]), [clients, setClients] = useState(0), [vgvGoal, setVgvGoal] = useState(0), [loading, setLoading] = useState(true), [notice, setNotice] = useState(""), [period, setPeriod] = useState<Period>("current");
  async function load() {
    setLoading(true); setNotice("");
    const [d, v, c, r, cap, ap, cli, profile] = await Promise.all([
      supabase.from("deals").select("id,status,property_value,created_at,updated_at"),
      supabase.from("vgv_entries").select("id,deal_id,reference_month,vgv").order("reference_month", { ascending: true }),
      supabase.from("commissions").select("id,user_amount,status,created_at,reference_month"),
      supabase.from("commission_receipts").select("commission_id,amount,received_at"),
      supabase.from("captures").select("id,status"),
      supabase.from("appointments").select("id,starts_at,status,client_id").order("starts_at", { ascending: true }),
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("vgv_goal").eq("id", user.id).maybeSingle(),
    ]);
    if (d.error || v.error || c.error || r.error || cap.error || ap.error || cli.error || profile.error) setNotice("Alguns indicadores não puderam ser carregados. Tente novamente.");
    setDeals((d.data || []) as Deal[]); setVgv((v.data || []) as Vgv[]); setCommissions((c.data || []) as Commission[]); setReceipts((r.data || []) as CommissionReceipt[]); setCaptures((cap.data || []) as Capture[]); setAppointments((ap.data || []) as Appointment[]); setClients(cli.count || 0); setVgvGoal(Number(profile.data?.vgv_goal || 0)); setLoading(false);
  }
  useEffect(() => { void load(); }, [user.id]);
  const periodStart = useMemo(() => { const now = new Date(); if (period === "all") return null; const monthsBack = period === "current" ? 0 : period === "6m" ? 5 : 11; return new Date(now.getFullYear(), now.getMonth() - monthsBack, 1); }, [period]);
  const inPeriod = (date?: string | null) => { if (period === "all") return true; if (!date || !periodStart) return false; return new Date(`${date.slice(0, 10)}T12:00:00`) >= periodStart; };
  const periodVgv = useMemo(() => vgv.filter((x) => inPeriod(x.reference_month)), [vgv, period]);
  const periodCommissions = useMemo(() => commissions.filter((x) => inPeriod(x.reference_month || x.created_at)), [commissions, period]);
  const periodDeals = useMemo(() => deals.filter((x) => inPeriod(x.created_at)), [deals, period]);
  const receivedByCommission = useMemo(() => {
    const map = new Map<string, number>();
    receipts.forEach((r) => map.set(r.commission_id, (map.get(r.commission_id) || 0) + Number(r.amount || 0)));
    return map;
  }, [receipts]);
  const stats = useMemo(() => {
    const closed = periodDeals.filter((x) => x.status === "closed"); const pipeline = periodDeals.filter((x) => x.status !== "closed" && x.status !== "lost");
    const realized = periodVgv.reduce((s, x) => s + Number(x.vgv || 0), 0);
    const received = periodCommissions.reduce((s, x) => s + (receivedByCommission.get(x.id) || ((x.status === "received" || x.status === "recebida") ? Number(x.user_amount || 0) : 0)), 0);
    const receivable = periodCommissions.reduce((s, x) => { const receivedAmount = receivedByCommission.get(x.id) || 0; return s + Math.max(0, Number(x.user_amount || 0) - receivedAmount); }, 0);
    return { closed, pipeline, realized, pipelineValue: pipeline.reduce((s, x) => s + Number(x.property_value || 0), 0), received, receivable, conversion: periodDeals.length ? (closed.length / periodDeals.length) * 100 : 0 };
  }, [periodDeals, periodVgv, periodCommissions, receivedByCommission]);
  const chart = useMemo(() => {
    const byMonth = new Map<string, number>(); periodVgv.forEach((x) => byMonth.set(x.reference_month.slice(0, 7), (byMonth.get(x.reference_month.slice(0, 7)) || 0) + Number(x.vgv || 0)));
    const now = new Date(); const count = period === "current" ? 1 : period === "6m" ? 6 : period === "12m" ? 12 : Math.min(12, Math.max(1, new Set(vgv.map((x) => x.reference_month.slice(0, 7))).size));
    const firstReferenceMonth = vgv[0]?.reference_month?.slice(0, 7); const start = period === "all" && firstReferenceMonth ? new Date(`${firstReferenceMonth}-01T12:00:00`) : new Date(now.getFullYear(), now.getMonth() - count + 1, 1);
    return Array.from({ length: count }, (_, i) => { const d = new Date(start.getFullYear(), start.getMonth() + i, 1); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; return { label: monthName(`${key}-01`), value: byMonth.get(key) || 0 }; });
  }, [periodVgv, period, vgv]);
  const attention = useMemo(() => {
    const now = Date.now();
    const next24h = appointments.filter((x) => {
      const time = new Date(x.starts_at).getTime();
      return x.status !== "cancelled" && time >= now && time <= now + 24 * 60 * 60 * 1000;
    });
    const stalled = deals.filter((x) => {
      if (x.status === "closed" || x.status === "lost") return false;
      const updated = new Date(x.updated_at || x.created_at).getTime();
      return now - updated >= 7 * 24 * 60 * 60 * 1000;
    });
    return { next24h, stalled };
  }, [appointments, deals]);
  const maxChart = Math.max(...chart.map((x) => x.value), 1);
  const goalProgress = vgvGoal > 0 ? Math.min(100, (stats.realized / vgvGoal) * 100) : 0;
  const goalGap = Math.max(0, vgvGoal - stats.realized);
  const periodLabel = period === "current" ? "Mês atual" : period === "6m" ? "Últimos 6 meses" : period === "12m" ? "Últimos 12 meses" : "Tempo todo";
  if (loading) return <div className="empty" aria-live="polite"><Loader2 className="spin" /> Organizando sua operação…</div>;
  return <div className="negocios-core dashboard-core">
    <div className="module-actions"><div><span className="label">MEU DIA</span><h2>{getGreeting()}, {user.name.split(" ")[0]}.</h2><p className="muted">Aqui está o que merece sua atenção na operação.</p></div><a className="clean-button primary" href="/negocios"><BriefcaseBusiness size={16} /> Ver meus negócios</a></div>
    {notice && <div className="notice"><strong>Imobfy:</strong> {notice}</div>}
    <div className="dashboard-periods" role="tablist" aria-label="Período do dashboard">{([["current", "Mês atual"], ["6m", "Últimos 6 meses"], ["12m", "Últimos 12 meses"], ["all", "Tempo todo"]] as [Period, string][]).map(([key, label]) => <button key={key} className={`clean-button ${period === key ? "primary" : "secondary"}`} onClick={() => setPeriod(key)}>{label}</button>)}</div>
    <section className="metrics-grid"><article className="metric-card"><span>VGV realizado</span><strong>{money(stats.realized)}</strong><small className="positive">{periodLabel}</small></article><article className="metric-card"><span>VGV em negociação</span><strong>{money(stats.pipelineValue)}</strong><small className="neutral">{stats.pipeline.length} negócios no período</small></article><article className="metric-card"><span>Comissões recebidas</span><strong>{money(stats.received)}</strong><small className="positive">Dinheiro já recebido</small></article><article className="metric-card"><span>Comissões a receber</span><strong>{money(stats.receivable)}</strong><small className="neutral">Saldo ainda não recebido</small></article></section>
    <section className="clean-card dashboard-attention">
      <div className="card-title"><div><span className="label">PRÓXIMAS AÇÕES</span><h3>O que merece sua atenção</h3></div><span className="muted">Dados reais do seu CRM</span></div>
      <div className="dashboard-attention-grid">
        <a href="/agenda" className="dashboard-attention-item">
          <CalendarDays size={18} />
          <div><strong>{attention.next24h.length ? `${attention.next24h.length} compromisso${attention.next24h.length === 1 ? "" : "s"} nas próximas 24h` : "Nenhum compromisso nas próximas 24h"}</strong><span>{attention.next24h.length ? "Abra sua agenda e prepare os próximos contatos." : "Sua agenda está livre neste intervalo."}</span></div>
          <ArrowUpRight size={15} />
        </a>
        <a href="/negocios" className="dashboard-attention-item">
          <BriefcaseBusiness size={18} />
          <div><strong>{attention.stalled.length ? `${attention.stalled.length} negócio${attention.stalled.length === 1 ? "" : "s"} sem atualização há 7+ dias` : "Nenhum negócio parado há 7+ dias"}</strong><span>{attention.stalled.length ? "Vale revisar a próxima ação antes que a oportunidade esfrie." : "Seu pipeline não tem negócios parados nesse critério."}</span></div>
          <ArrowUpRight size={15} />
        </a>
        <a href="/comissoes" className="dashboard-attention-item">
          <WalletCards size={18} />
          <div><strong>{stats.receivable > 0 ? `${money(stats.receivable)} a receber` : "Nenhum valor pendente no período"}</strong><span>{stats.receivable > 0 ? "Confira os recebimentos e as próximas datas." : "Seu saldo pendente está zerado neste período."}</span></div>
          <ArrowUpRight size={15} />
        </a>
      </div>
    </section>
    <div className="clean-grid two"><article className="clean-card chart-card"><div className="card-title"><div><span className="label">PERFORMANCE</span><h3>Evolução do VGV</h3></div><span className="muted">{periodLabel}</span></div><div className="dashboard-bars">{chart.map((x) => <div className="dashboard-bar" key={x.label}><div className="bar-track"><i style={{ height: `${Math.max(x.value / maxChart * 100, x.value ? 8 : 2)}%` }} title={money(x.value)} /></div><small>{x.label}</small><span>{x.value ? money(x.value) : "—"}</span></div>)}</div></article><article className="clean-card"><div className="card-title"><div><span className="label">OPERAÇÃO</span><h3>Resumo comercial</h3></div></div><div className="dashboard-list"><div><Users size={17} /><span>Clientes cadastrados</span><b>{clients}</b></div><div><Home size={17} /><span>Captações ativas</span><b>{captures.filter((x) => x.status === "active").length}</b></div><div><CalendarDays size={17} /><span>Negócios no pipeline</span><b>{stats.pipeline.length}</b></div><div><WalletCards size={17} /><span>Recebido no período</span><b>{money(stats.received)}</b></div></div><a className="text-link" href="/comissoes">Ver financeiro <ArrowUpRight size={14} /></a></article></div>
    <div className="clean-grid two"><article className="clean-card"><div className="card-title"><div><span className="label">FUNIL</span><h3>Negócios por etapa</h3></div><span className="muted">{periodLabel}</span></div><div className="dashboard-list">{Object.entries(stageLabels).map(([stage, label]) => { const count = periodDeals.filter((d) => d.status === stage).length; return <div key={stage}><span>{label}</span><b>{count}</b></div>; })}</div></article><article className="clean-card goal-card"><span className="label">META</span><div className="goal-placeholder"><Target size={22} /><div><strong>Meta personalizada</strong><p>Configure sua meta de VGV em Configurações para acompanhar o progresso aqui.</p></div></div><a className="text-link" href="/configuracoes">Configurar meta <ArrowUpRight size={14} /></a></article></div>
  </div>;
}
