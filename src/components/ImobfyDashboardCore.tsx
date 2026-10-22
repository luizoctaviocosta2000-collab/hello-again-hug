import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, Home, Loader2, Target, Users, WalletCards } from "lucide-react";
import { supabase } from "../lib/supabase";
import { financialSummary, isInPeriod, type Period } from "../lib/financial-summary";
import { type ImobfyUser } from "../lib/imobfy-session";

const getGreeting = (date = new Date()) => {
  const hour = date.getHours();
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
};

type Deal = { id: string; status: string; stage: string; property_value: number; created_at: string; updated_at?: string | null };
type Vgv = { id: string; deal_id: string | null; reference_month: string; vgv: number };
type Commission = { id: string; user_amount: number; status: string; created_at?: string; reference_month?: string | null };
type CommissionReceipt = { commission_id: string; amount: number; received_at?: string | null };
type Capture = { id: string; status: string };
type Appointment = { id: string; starts_at: string; status: string; client_id: string | null };
const money = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthName = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
const stageLabels: Record<string, string> = { novo: "Novo", contato: "Contato", visita: "Visita", proposta: "Proposta", negociacao: "Negociação", fechado_ganho: "Fechado" };

export default function ImobfyDashboardCore({ user }: { user: ImobfyUser }) {
  const [deals, setDeals] = useState<Deal[]>([]), [vgv, setVgv] = useState<Vgv[]>([]), [commissions, setCommissions] = useState<Commission[]>([]), [receipts, setReceipts] = useState<CommissionReceipt[]>([]), [captures, setCaptures] = useState<Capture[]>([]), [appointments, setAppointments] = useState<Appointment[]>([]), [clients, setClients] = useState(0), [vgvGoal, setVgvGoal] = useState(0), [loading, setLoading] = useState(true), [notice, setNotice] = useState(""), [period, setPeriod] = useState<Period>("current");
  async function load() {
    setLoading(true); setNotice("");
    const [d, v, c, r, cap, ap, cli, profile] = await Promise.all([
      supabase.from("deals").select("id,status,stage,property_value,created_at,updated_at"),
      supabase.from("vgv_entries").select("id,deal_id,reference_month,vgv").order("reference_month", { ascending: true }),
      supabase.from("commissions").select("id,user_amount,status,created_at,reference_month"),
      supabase.from("commission_receipts").select("commission_id,amount,received_at"),
      supabase.from("captures").select("id,status"),
      supabase.from("visits").select("id,starts_at,status,client_id").order("starts_at", { ascending: true }),
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("vgv_goal").eq("id", user.id).maybeSingle(),
    ]);
    if (d.error || v.error || c.error || r.error || cap.error || ap.error || cli.error || profile.error) { setNotice("Os indicadores estão indisponíveis. Tente carregar novamente."); setLoading(false); return; }
    setDeals((d.data || []) as Deal[]); setVgv((v.data || []) as Vgv[]); setCommissions((c.data || []) as Commission[]); setReceipts((r.data || []) as CommissionReceipt[]); setCaptures((cap.data || []) as Capture[]); setAppointments((ap.data || []) as Appointment[]); setClients(cli.count || 0); setVgvGoal(Number(profile.data?.vgv_goal || 0)); setLoading(false);
  }
  useEffect(() => { void load(); }, [user.id]);
  const periodVgv = useMemo(() => vgv.filter((x) => isInPeriod(x.reference_month, period)), [vgv, period]);
  const periodDeals = useMemo(() => deals.filter((x) => isInPeriod(x.created_at, period)), [deals, period]);
  const financial = useMemo(() => financialSummary(commissions, receipts, period), [commissions, receipts, period]);
  const stats = useMemo(() => {
    const closed = periodDeals.filter((x) => x.status === "closed"); const pipeline = periodDeals.filter((x) => x.status !== "closed" && x.status !== "lost");
    const realized = periodVgv.reduce((s, x) => s + Number(x.vgv || 0), 0);
    const received = financial.received;
    const receivable = financial.receivable;
    return { closed, pipeline, realized, pipelineValue: pipeline.reduce((s, x) => s + Number(x.property_value || 0), 0), received, receivable, conversion: periodDeals.length ? (closed.length / periodDeals.length) * 100 : 0 };
  }, [periodDeals, periodVgv, financial]);
  const chart = useMemo(() => {
    const byMonth = new Map<string, number>(); periodVgv.forEach((x) => byMonth.set(x.reference_month.slice(0, 7), (byMonth.get(x.reference_month.slice(0, 7)) || 0) + Number(x.vgv || 0)));
    if (period === "all") return [...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ label: `${monthName(`${key}-01`)}/${key.slice(2,4)}`, value }));
    const now = new Date(); const count = period === "current" ? 1 : period === "6m" ? 6 : 12;
    const start = new Date(now.getFullYear(), now.getMonth() - count + 1, 1);
    return Array.from({ length: count }, (_, i) => { const d = new Date(start.getFullYear(), start.getMonth() + i, 1); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; return { label: `${monthName(`${key}-01`)}/${key.slice(2,4)}`, value: byMonth.get(key) || 0 }; });
  }, [periodVgv, period, vgv]);
  const attention = useMemo(() => {
    const now = Date.now();
    const next24h = appointments.filter((x) => {
      const time = new Date(x.starts_at).getTime();
      return !["cancelled", "canceled", "done", "completed"].includes(x.status) && time >= now && time <= now + 24 * 60 * 60 * 1000;
    });
    const stalled = deals.filter((x) => {
      if (x.status === "closed" || x.status === "lost") return false;
      const updated = new Date(x.updated_at || x.created_at).getTime();
      return now - updated >= 7 * 24 * 60 * 60 * 1000;
    });
    return { next24h, stalled };
  }, [appointments, deals]);
  const maxChart = Math.max(...chart.map((x) => x.value), 1);
  const currentMonthVgv = vgv.filter(x => isInPeriod(x.reference_month, "current")).reduce((sum, x) => sum + Number(x.vgv || 0), 0);
  const goalProgress = vgvGoal > 0 ? Math.min(100, (currentMonthVgv / vgvGoal) * 100) : 0;
  const goalGap = Math.max(0, vgvGoal - currentMonthVgv);
  const periodLabel = period === "current" ? "Mês atual" : period === "6m" ? "Últimos 6 meses" : period === "12m" ? "Últimos 12 meses" : "Tempo todo";
  if (loading) return <div className="dashboard-loading" aria-live="polite" aria-busy="true">
    <div className="dashboard-loading-heading"><span className="dashboard-skeleton dashboard-skeleton-eyebrow" /><span className="dashboard-skeleton dashboard-skeleton-title" /><span className="dashboard-skeleton dashboard-skeleton-copy" /></div>
    <div className="dashboard-loading-metrics">{[1, 2, 3, 4].map((item) => <div className="dashboard-loading-card" key={item}><span className="dashboard-skeleton dashboard-skeleton-label" /><span className="dashboard-skeleton dashboard-skeleton-value" /><span className="dashboard-skeleton dashboard-skeleton-note" /></div>)}</div>
    <div className="dashboard-loading-content"><div className="dashboard-loading-panel"><span className="dashboard-skeleton dashboard-skeleton-label" /><span className="dashboard-skeleton dashboard-skeleton-title" /><span className="dashboard-skeleton dashboard-skeleton-row" /><span className="dashboard-skeleton dashboard-skeleton-row" /><span className="dashboard-skeleton dashboard-skeleton-row" /></div><div className="dashboard-loading-panel"><span className="dashboard-skeleton dashboard-skeleton-label" /><span className="dashboard-skeleton dashboard-skeleton-title" /><span className="dashboard-skeleton dashboard-skeleton-chart" /></div></div>
    <span className="dashboard-loading-status"><Loader2 className="spin" size={15} /> Preparando sua visão geral…</span>
  </div>;
  if (notice) return <div className="notice" role="alert">{notice} <button className="clean-button secondary" onClick={() => void load()}>Tentar novamente</button></div>;
  return <div className="negocios-core dashboard-core">
    <div className="module-actions"><div><span className="label">MEU DIA</span><h2>{getGreeting()}, {user.name.split(" ")[0]}.</h2><p className="muted">Aqui está o que merece sua atenção na operação.</p></div><a className="clean-button primary" href="/negocios"><BriefcaseBusiness size={16} /> Ver meus negócios</a></div>
    {notice && <div className="notice"><strong>Imobfy:</strong> {notice}</div>}
    {financial.inconsistent > 0 && <div className="notice">{financial.inconsistent} comissão(ões) marcada(s) como recebida(s) sem recebimentos suficientes. Os indicadores usam apenas os recebimentos registrados.</div>}
    <div className="dashboard-periods" role="group" aria-label="Período do dashboard">{([["current", "Mês atual"], ["6m", "Últimos 6 meses"], ["12m", "Últimos 12 meses"], ["all", "Tempo todo"]] as [Period, string][]).map(([key, label]) => <button key={key} aria-pressed={period === key} className={`clean-button ${period === key ? "primary" : "secondary"}`} onClick={() => setPeriod(key)}>{label}</button>)}</div>
    <section className="metrics-grid"><article className="metric-card"><span>VGV realizado</span><strong style={{ "--kpi-len": money(stats.realized).length } as CSSProperties}>{money(stats.realized)}</strong><small>{periodLabel}</small></article><article className="metric-card"><span>VGV em negociação</span><strong style={{ "--kpi-len": money(stats.pipelineValue).length } as CSSProperties}>{money(stats.pipelineValue)}</strong><small className="neutral">{stats.pipeline.length} negócios no período</small></article><article className="metric-card"><span>Comissões recebidas</span><strong style={{ "--kpi-len": money(stats.received).length } as CSSProperties}>{money(stats.received)}</strong><small>Recebimentos por data · {periodLabel}</small></article><article className="metric-card"><span>Comissões a receber</span><strong style={{ "--kpi-len": money(stats.receivable).length } as CSSProperties}>{money(stats.receivable)}</strong><small className="neutral">Saldo total pendente, de todos os períodos</small></article></section>
    <section className="clean-card dashboard-attention">
      <div className="card-title"><div><span className="label">PRÓXIMAS AÇÕES</span><h3>O que merece sua atenção</h3></div><span className="muted">Dados reais do seu CRM</span></div>
      <div className="dashboard-attention-grid">
        <a href="/agenda" className="dashboard-attention-item">
          <CalendarDays size={18} />
          <div><strong>{attention.next24h.length ? `${attention.next24h.length} visita${attention.next24h.length === 1 ? "" : "s"} nas próximas 24h` : "Nenhuma visita nas próximas 24h"}</strong><span>{attention.next24h.length ? "Abra sua agenda e prepare os próximos contatos." : "Não há visitas agendadas neste intervalo."}</span></div>
          <ArrowUpRight size={15} />
        </a>
        <a href="/negocios" className="dashboard-attention-item">
          <BriefcaseBusiness size={18} />
          <div><strong>{attention.stalled.length ? `${attention.stalled.length} negócio${attention.stalled.length === 1 ? "" : "s"} sem atualização há 7+ dias` : "Nenhum negócio parado há 7+ dias"}</strong><span>{attention.stalled.length ? "Vale revisar a próxima ação antes que a oportunidade esfrie." : "Seu pipeline não tem negócios parados nesse critério."}</span></div>
          <ArrowUpRight size={15} />
        </a>
        <a href="/comissoes" className="dashboard-attention-item">
          <WalletCards size={18} />
          <div><strong>{stats.receivable > 0 ? `${money(stats.receivable)} a receber` : "Nenhum valor pendente"}</strong><span>{stats.receivable > 0 ? "Confira os recebimentos e as próximas datas." : "Seu saldo total pendente está zerado."}</span></div>
          <ArrowUpRight size={15} />
        </a>
      </div>
    </section>
    <div className="clean-grid two"><article className="clean-card chart-card"><div className="card-title"><div><span className="label">PERFORMANCE</span><h3>Evolução do VGV</h3></div><span className="muted">{periodLabel}</span></div><div className="dashboard-bars" style={{ overflowX: "auto" }}>{chart.map((x) => <div className="dashboard-bar" style={{ minWidth: 70 }} key={x.label}><div className="bar-track"><i style={{ height: `${Math.max(x.value / maxChart * 100, x.value ? 8 : 2)}%` }} title={money(x.value)} /></div><small>{x.label}</small><span>{x.value ? money(x.value) : "—"}</span></div>)}</div></article><article className="clean-card"><div className="card-title"><div><span className="label">OPERAÇÃO</span><h3>Resumo comercial</h3></div></div><div className="dashboard-list"><div><Users size={17} /><span>Clientes cadastrados</span><b>{clients}</b></div><div><Home size={17} /><span>Captações ativas</span><b>{captures.filter((x) => x.status === "active").length}</b></div><div><CalendarDays size={17} /><span>Negócios no pipeline</span><b>{stats.pipeline.length}</b></div><div><WalletCards size={17} /><span>Recebido no período</span><b>{money(stats.received)}</b></div></div><a className="text-link" href="/comissoes">Ver financeiro <ArrowUpRight size={14} /></a></article></div>
    <div className="clean-grid two"><article className="clean-card"><div className="card-title"><div><span className="label">FUNIL</span><h3>Negócios por etapa</h3></div><span className="muted">{periodLabel}</span></div><div className="dashboard-list">{Object.entries(stageLabels).map(([stage, label]) => { const count = periodDeals.filter((d) => d.stage === stage).length; return <div key={stage}><span>{label}</span><b>{count}</b></div>; })}</div></article><article className="clean-card goal-card"><div className="goal-head"><div><span className="label">META DE VGV</span><h3>{vgvGoal > 0 ? "Sua meta do mês atual" : "Defina sua meta de VGV"}</h3></div><Target size={18} /></div>{vgvGoal > 0 ? <><div className="goal-value-row"><strong>{money(currentMonthVgv)}</strong><span>de {money(vgvGoal)}</span></div><div className="goal-progress" aria-label={"Progresso de " + goalProgress.toFixed(0) + "%"}><i style={{ width: goalProgress + "%" }} /></div><div className="goal-footer"><span>{goalProgress.toFixed(0)}% alcançado</span><span>{goalGap > 0 ? money(goalGap) + " para a meta" : "Meta alcançada"}</span></div></> : <div className="goal-empty"><Target size={20} /><p>Configure uma meta mensal para acompanhar seu avanço diretamente no dashboard.</p></div>}<a className="text-link" href="/configuracoes">{vgvGoal > 0 ? "Ajustar meta" : "Configurar meta"} <ArrowUpRight size={14} /></a></article></div>
  </div>;
}

