import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Home,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings,
  Users,
  WalletCards,
  X,
} from "lucide-react";

export type CleanModule = "dashboard" | "imoveis" | "clientes" | "negocios" | "agenda" | "comissoes" | "vgv" | "configuracoes";

type NavItem = { id: CleanModule; label: string; icon: typeof Home; to: string };

const nav: NavItem[] = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard, to: "/" },
  { id: "imoveis", label: "Imóveis", icon: Home, to: "/imoveis" },
  { id: "clientes", label: "Clientes", icon: Users, to: "/clientes" },
  { id: "negocios", label: "Negócios", icon: CircleDollarSign, to: "/negocios" },
  { id: "agenda", label: "Agenda", icon: CalendarDays, to: "/agenda" },
  { id: "comissoes", label: "Comissões", icon: WalletCards, to: "/comissoes" },
  { id: "vgv", label: "Meu VGV", icon: ClipboardList, to: "/vgv" },
];

const data = {
  dashboard: {
    eyebrow: "VISÃO GERAL",
    title: "Sua operação, em um só lugar.",
    description: "Acompanhe captações, clientes, negócios e dinheiro sem perder o controle.",
  },
  imoveis: { eyebrow: "INVENTÁRIO", title: "Imóveis", description: "Seu estoque organizado, pronto para vender." },
  clientes: { eyebrow: "CRM", title: "Clientes", description: "Relacionamentos e próximas ações em um único lugar." },
  negocios: { eyebrow: "PIPELINE", title: "Negócios", description: "Veja cada negociação avançar até o fechamento." },
  agenda: { eyebrow: "ROTINA", title: "Agenda", description: "Visitas, reuniões e follow-ups que não podem escapar." },
  comissoes: { eyebrow: "FINANCEIRO", title: "Comissões", description: "Tenha clareza sobre o que é bruto, imposto e líquido." },
  vgv: { eyebrow: "PERFORMANCE", title: "Meu VGV", description: "Transforme seus fechamentos em uma visão financeira clara." },
  configuracoes: { eyebrow: "CONTA", title: "Configurações", description: "Ajuste seu perfil e as regras da sua operação." },
} as const;

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function Dashboard() {
  const [period, setPeriod] = useState("Este mês");
  const [showMore, setShowMore] = useState(false);
  const metrics = [
    ["VGV realizado", money(428000), "+18,4%", "positive"],
    ["Comissão líquida", money(15585), "+12,1%", "positive"],
    ["Imóveis ativos", "24", "+3 este mês", "neutral"],
    ["Negócios em andamento", "07", "2 propostas", "neutral"],
  ];
  return (
    <>
      <div className="clean-toolbar">
        <div className="period-tabs">
          {["Este mês", "Últimos 90 dias", "Este ano"].map((item) => (
            <button key={item} className={period === item ? "selected" : ""} onClick={() => setPeriod(item)}>{item}</button>
          ))}
        </div>
        <button className="clean-button secondary" onClick={() => setShowMore(!showMore)}><Bell size={15} /> Alertas</button>
      </div>
      {showMore && <div className="notice">Você tem <strong>2 follow-ups</strong> para hoje e 1 proposta aguardando retorno.</div>}
      <section className="metrics-grid">
        {metrics.map(([label, value, change, tone]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong><small className={tone}>{change}</small></article>)}
      </section>
      <section className="clean-grid two">
        <article className="clean-card chart-card">
          <div className="card-title"><div><span className="label">EVOLUÇÃO</span><h3>VGV por mês</h3></div><span className="muted">2026</span></div>
          <div className="fake-chart"><div className="chart-line" /><div className="chart-labels"><span>abr</span><span>mai</span><span>jun</span><span>jul</span><span>ago</span><span>set</span></div></div>
        </article>
        <article className="clean-card goal-card"><span className="label">META DO MÊS</span><strong>R$ 80.000</strong><p>R$ 61.400 realizados</p><div className="progress"><i style={{ width: "77%" }} /></div><small>77% da meta alcançada</small><Link to="/vgv" className="text-link">Ver performance <ChevronRight size={14} /></Link></article>
      </section>
      <section className="clean-grid two bottom-grid">
        <article className="clean-card"><div className="card-title"><div><span className="label">ATIVIDADE</span><h3>Últimas movimentações</h3></div><Link to="/negocios" className="text-link">Ver tudo <ChevronRight size={14} /></Link></div><Activity title="Apartamento 3 quartos · Castelo" detail="Proposta enviada · Hoje, 09:12" value="R$ 680.000" /><Activity title="Casa · Santa Amélia" detail="Nova captação · Ontem, 17:40" value="R$ 920.000" /><Activity title="Cliente João Mendes" detail="Visita agendada · Ontem, 14:20" value="Amanhã" /></article>
        <article className="clean-card"><span className="label">ATENÇÃO</span><h3>Próximas ações</h3><div className="action-item"><div className="action-dot" /><div><strong>Visita · Casa Santa Rosa</strong><span>Hoje · 15:30</span></div></div><div className="action-item"><div className="action-dot" /><div><strong>Follow-up · Mariana</strong><span>Hoje · 17:00</span></div></div><div className="action-item"><div className="action-dot" /><div><strong>Proposta · Carlos</strong><span>Amanhã · 10:00</span></div></div></article>
      </section>
    </>
  );
}

function Activity({ title, detail, value }: { title: string; detail: string; value: string }) {
  return <div className="activity-row"><div className="activity-mark"><Home size={15} /></div><div className="activity-copy"><strong>{title}</strong><span>{detail}</span></div><b>{value}</b></div>;
}

function GenericModule({ module }: { module: Exclude<CleanModule, "dashboard"> }) {
  const info = data[module];
  const [query, setQuery] = useState("");
  const rows = module === "imoveis"
    ? [["Apartamento · Castelo", "R$ 680.000", "Ativo"], ["Casa · Santa Amélia", "R$ 920.000", "Captação"], ["Apartamento · Itapoã", "R$ 540.000", "Ativo"], ["Casa · Santa Rosa", "R$ 1.180.000", "Visita"]]
    : module === "clientes"
      ? [["Mariana Alves", "Compra · 3 quartos", "Quente"], ["João Mendes", "Casa até R$ 800 mil", "Visita"], ["Carlos Henrique", "Investimento", "Proposta"], ["Fernanda Lima", "Apartamento", "Novo"]]
      : module === "negocios"
        ? [["Apartamento · Castelo", "R$ 680.000", "Proposta"], ["Casa · Santa Amélia", "R$ 920.000", "Negociação"], ["Apartamento · Itapoã", "R$ 540.000", "Visita"]]
        : module === "agenda"
          ? [["Visita · Casa Santa Rosa", "Hoje · 15:30", "Visita"], ["Follow-up · Mariana", "Hoje · 17:00", "Follow-up"], ["Proposta · Carlos", "Amanhã · 10:00", "Proposta"]]
          : module === "comissoes"
            ? [["Apartamento · Castelo", money(40800), "Líquido"], ["Casa · Santa Amélia", money(55200), "Projetado"], ["Apartamento · Itapoã", money(32400), "Líquido"]]
            : module === "vgv"
              ? [["Setembro", money(428000), "77% da meta"], ["Agosto", money(512000), "Concluído"], ["Julho", money(386000), "Concluído"]]
              : [["Perfil profissional", "CRECI · MG", "Ativo"], ["Comissão padrão", "6%", "Configuração"], ["Imposto", "9%", "Configuração"]];

  return <>
    <div className="module-actions"><div className="search-box"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Buscar em ${info.title.toLowerCase()}...`} /></div><button className="clean-button primary"><Plus size={16} /> Novo {module === "imoveis" ? "imóvel" : module === "clientes" ? "cliente" : module === "negocios" ? "negócio" : module === "agenda" ? "compromisso" : "registro"}</button></div>
    <article className="clean-card table-card"><div className="card-title"><div><span className="label">OPERAÇÃO</span><h3>{info.title}</h3></div><span className="muted">{rows.length} registros</span></div><div className="table"><div className="table-head"><span>Nome / referência</span><span>Valor / detalhe</span><span>Status</span><span /></div>{rows.filter((r) => r.join(" ").toLowerCase().includes(query.toLowerCase())).map((r) => <div className="table-row" key={r.join("-")}><div><strong>{r[0]}</strong><small>{module === "clientes" ? "Cliente" : module === "imoveis" ? "Imóvel" : "Operação"}</small></div><span>{r[1]}</span><span><em>{r[2]}</em></span><button className="icon-button"><ChevronRight size={16} /></button></div>)}</div></article>
  </>;
}

export default function ImobfyCleanApp({ module }: { module: CleanModule }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const info = data[module];
  return <div className="clean-app">
    <aside className={`clean-sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="clean-brand"><div className="brand-symbol">I</div><div><strong>imobfy</strong><span>GESTÃO IMOBILIÁRIA</span></div><button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
      <nav><span className="nav-section">OPERAÇÃO</span>{nav.map((item) => { const Icon = item.icon; return <Link key={item.id} to={item.to} className={module === item.id ? "active" : ""} onClick={() => setMobileOpen(false)}><Icon size={17} /><span>{item.label}</span></Link>; })}<span className="nav-section">SISTEMA</span><Link to="/configuracoes" className={module === "configuracoes" ? "active" : ""} onClick={() => setMobileOpen(false)}><Settings size={17} /><span>Configurações</span></Link></nav>
      <div className="sidebar-footer"><div className="profile-avatar">LC</div><div><strong>Luiz Costa</strong><span>Corretor · CRECI</span></div><button><ChevronRight size={15} /></button></div>
    </aside>
    {mobileOpen && <button className="sidebar-overlay" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
    <main className="clean-main"><header className="clean-header"><button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div><span className="header-kicker">TERÇA, 08 DE SETEMBRO</span><h1>{info.title}</h1><p>{info.description}</p></div><div className="header-actions"><button className="notification"><Bell size={17} /><i /></button><div className="header-avatar">LC</div></div></header><div className="content">{module === "dashboard" ? <Dashboard /> : <GenericModule module={module} />}</div></main>
  </div>;
}
