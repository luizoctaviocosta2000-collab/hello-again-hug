import { Link } from "@tanstack/react-router";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Building2, CalendarDays, ChevronRight, CircleDollarSign, Home, Moon, Plus, Settings, Sun, TrendingUp, Users, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ImobfyApp from "./ImobfyApp";

type Property = { id: string; name: string; neighborhood: string; value: number; status: string; type?: string; created_at?: string };
type Deal = { id: string; property_value: number; user_commission: number; status: string; deal_date: string; property_name: string; neighborhood: string; };
type Profile = { name?: string; role?: string; city?: string; monthlyGoal?: number };
type Store = { properties?: Property[]; deals?: Deal[]; profile?: Profile; };

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value || 0);
const firstName = (value: string) => value.trim().split(/\s+/)[0] || "Corretor";
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };
const monthName = (date: Date) => date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

function readStore(): Store {
  try {
    const session = JSON.parse(localStorage.getItem("imobfy-session-v1") || "null");
    const id = String(session?.user_id || session?.email || "local").trim().toLowerCase().replace(/[^a-z0-9@._-]/g, "-");
    const raw = localStorage.getItem(`imobfy-v1:${id}`) || localStorage.getItem("imobfy-v1");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

const nav = [
  ["Visão geral", "/", Home], ["Imóveis", "/imoveis", Building2], ["Clientes", "/clientes", Users],
  ["Negócios", "/negocios", BarChart3], ["Agenda", "/agenda", CalendarDays], ["Comissões", "/comissoes", Wallet],
  ["Meu VGV", "/vgv", TrendingUp],
] as const;

export default function PremiumDashboard() {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Store>({});
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setReady(true);
    setData(readStore());
    setDark(localStorage.getItem("imobfy-theme") === "dark");
    const refresh = () => setData(readStore());
    window.addEventListener("storage", refresh);
    const timer = window.setInterval(refresh, 1500);
    return () => { window.removeEventListener("storage", refresh); window.clearInterval(timer); };
  }, []);
  useEffect(() => { if (ready) { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("imobfy-theme", dark ? "dark" : "light"); } }, [dark, ready]);

  if (!ready) return null;
  if (!localStorage.getItem("imobfy-session-v1")) return <ImobfyApp module="dashboard" />;

  const props = data.properties || [];
  const deals = data.deals || [];
  const profile = data.profile || {};
  const active = props.filter(p => p.status !== "cancelled");
  const sold = props.filter(p => p.status === "sold");
  const wallet = props.filter(p => p.status === "active" || p.status === "negotiating");
  const soldDeals = deals.filter(d => d.status !== "cancelled");
  const received = deals.filter(d => d.status === "received");
  const vgv = active.reduce((sum, p) => sum + Number(p.value || 0), 0);
  const vgvSold = sold.reduce((sum, p) => sum + Number(p.value || 0), 0);
  const vgvWallet = wallet.reduce((sum, p) => sum + Number(p.value || 0), 0);
  const commissionDue = soldDeals.reduce((sum, d) => sum + Number(d.user_commission || 0), 0);
  const commissionReceived = received.reduce((sum, d) => sum + Number(d.user_commission || 0), 0);
  const goal = Number(profile.monthlyGoal || 0);

  const chart = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthDeals = deals.filter(d => String(d.deal_date || "").slice(0, 7) === key);
      return { month: monthName(date), vgv: monthDeals.reduce((s, d) => s + Number(d.property_value || 0), 0), commission: monthDeals.reduce((s, d) => s + Number(d.user_commission || 0), 0) };
    });
  }, [deals]);

  const activities = [...deals].sort((a, b) => String(b.deal_date).localeCompare(String(a.deal_date))).slice(0, 4);
  const progress = goal > 0 ? Math.min(100, Math.round((vgvSold / goal) * 100)) : 0;
  const pending = [
    !props.length ? { title: "Cadastre seu primeiro imóvel", text: "Comece construindo sua carteira.", href: "/imoveis" } : null,
    !deals.length ? { title: "Crie seu primeiro negócio", text: "Transforme um lead em oportunidade.", href: "/negocios" } : null,
    { title: "Organize sua agenda", text: "Não deixe nenhum follow-up passar.", href: "/agenda" },
  ].filter(Boolean) as { title: string; text: string; href: string }[];

  return (
    <div className="premium-app">
      <aside className="premium-sidebar">
        <Link to="/" className="premium-brand"><span className="premium-brand-mark">I</span><span><strong>imobfy</strong><small>gestão imobiliária</small></span></Link>
        <div className="premium-nav-label">OPERAÇÃO</div>
        <nav>{nav.map(([label, href, Icon]) => <Link key={href} to={href} className={href === "/" ? "premium-nav active" : "premium-nav"}><Icon size={17}/><span>{label}</span>{href === "/" && <ChevronRight size={14}/>}</Link>)}</nav>
        <div className="premium-sidebar-bottom"><Link to="/configuracoes" className="premium-nav"><Settings size={17}/><span>Configurações</span></Link><button className="premium-theme" onClick={() => setDark(v => !v)}>{dark ? <Sun size={16}/> : <Moon size={16}/>}<span>{dark ? "Modo claro" : "Modo escuro"}</span></button><div className="premium-user"><span>{firstName(profile.name || "Corretor")[0].toUpperCase()}</span><div><strong>{firstName(profile.name || "Corretor")}</strong><small>{profile.role || "Corretor"}</small></div></div></div>
      </aside>
      <main className="premium-main">
        <header className="premium-header"><div><span className="premium-kicker">{profile.city ? profile.city.toUpperCase() : "GESTÃO IMOBILIÁRIA"}</span><h1>{greeting()}, {firstName(profile.name || "Corretor")}.</h1><p>Acompanhe sua operação em uma única visão.</p></div><div className="premium-header-actions"><button className="premium-period">Este mês <ChevronRight size={14}/></button><Link to="/negocios" className="premium-primary"><Plus size={17}/> Novo negócio</Link></div></header>
        <section className="premium-kpis">
          <article className="premium-kpi premium-kpi-featured"><span>VGV em carteira</span><strong>{money(vgvWallet)}</strong><small><TrendingUp size={13}/> {wallet.length} imóveis ativos</small></article>
          <article className="premium-kpi"><span>VGV vendido</span><strong>{money(vgvSold)}</strong><small>{sold.length} vendas registradas</small></article>
          <article className="premium-kpi"><span>Comissão a receber</span><strong>{money(Math.max(0, commissionDue - commissionReceived))}</strong><small>líquido das operações</small></article>
          <article className="premium-kpi"><span>Comissão recebida</span><strong>{money(commissionReceived)}</strong><small>{received.length} recebimentos</small></article>
        </section>
        <section className="premium-grid-main">
          <article className="premium-panel premium-chart"><div className="premium-panel-head"><div><span>DESEMPENHO</span><h2>VGV da operação</h2></div><div className="premium-legend"><i/> VGV</div></div><div className="premium-chart-value">{money(vgv)}</div><div className="premium-chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}><defs><linearGradient id="premiumFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity={0.18}/><stop offset="100%" stopColor="currentColor" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v/1000)}k` : `${v}`} /><Tooltip formatter={(v: number) => [money(v), "VGV"]} contentStyle={{ borderRadius: 12, border: "1px solid var(--premium-border)", boxShadow: "0 12px 35px rgba(0,0,0,.08)" }} /><Area type="monotone" dataKey="vgv" stroke="currentColor" fill="url(#premiumFill)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer></div></article>
          <article className="premium-panel premium-goal"><div className="premium-panel-head"><div><span>OBJETIVO</span><h2>Meta de vendas</h2></div><CircleDollarSign size={19}/></div>{goal > 0 ? <><div className="premium-goal-number">{progress}%</div><p>{money(vgvSold)} de {money(goal)}</p><div className="premium-progress"><i style={{ width: `${progress}%` }}/></div><small>{progress >= 100 ? "Meta atingida. Excelente trabalho." : `${money(Math.max(0, goal - vgvSold))} restantes para sua meta.`}</small></> : <div className="premium-empty-goal"><div><CircleDollarSign size={22}/></div><strong>Defina sua meta</strong><span>Tenha um número claro para perseguir todos os meses.</span><Link to="/configuracoes">Configurar meta <ChevronRight size={14}/></Link></div>}</article>
        </section>
        <section className="premium-grid-bottom">
          <article className="premium-panel"><div className="premium-panel-head"><div><span>PRÓXIMOS PASSOS</span><h2>O que merece sua atenção</h2></div></div><div className="premium-tasks">{pending.slice(0, 3).map(item => <Link to={item.href} key={item.title} className="premium-task"><span className="premium-task-icon"><Plus size={16}/></span><div><strong>{item.title}</strong><small>{item.text}</small></div><ChevronRight size={16}/></Link>)}</div></article>
          <article className="premium-panel"><div className="premium-panel-head"><div><span>ATIVIDADE</span><h2>Últimas operações</h2></div><Link to="/negocios" className="premium-see">Ver tudo</Link></div>{activities.length ? <div className="premium-activity-list">{activities.map(item => <div className="premium-activity" key={item.id}><span className="premium-activity-icon"><Wallet size={15}/></span><div><strong>{item.property_name || "Negócio imobiliário"}</strong><small>{item.neighborhood || ""}</small></div><b>{money(item.user_commission)}</b></div>)}</div> : <div className="premium-activity-empty">Suas próximas operações aparecerão aqui.</div>}</article>
        </section>
      </main>
    </div>
  );
}
