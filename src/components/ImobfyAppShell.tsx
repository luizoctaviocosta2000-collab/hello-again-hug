import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { BarChart3, Building2, CalendarDays, ChevronRight, CircleDollarSign, LayoutDashboard, LogOut, Menu, Settings, Sparkles, Users, X, BriefcaseBusiness } from "lucide-react";
import type { ImobfyUser } from "../lib/imobfy-session";
import { signOut } from "../lib/imobfy-session";

type Props = { user: ImobfyUser; children: ReactNode };
type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const primary: NavItem[] = [
  { to: "/", label: "Visão geral", icon: LayoutDashboard },
  { to: "/imoveis", label: "Imóveis", icon: Building2 },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/negocios", label: "Negócios", icon: BriefcaseBusiness },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
];
const performance: NavItem[] = [
  { to: "/comissoes", label: "Comissões", icon: CircleDollarSign },
  { to: "/vgv", label: "Meu VGV", icon: BarChart3 },
  { to: "/ia", label: "Imobfy IA", icon: Sparkles },
];
const settings: NavItem[] = [{ to: "/configuracoes", label: "Configurações", icon: Settings }];

function NavGroup({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate: () => void }) {
  return <div className="imobfy-nav-group">{items.map(({ to, label, icon: Icon }) => {
    const active = to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
    return <Link key={to} to={to} className={active ? "active" : ""} onClick={onNavigate}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{active && <ChevronRight size={13} className="nav-chevron" />}</Link>;
  })}</div>;
}

export default function ImobfyAppShell({ user, children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pathname = location.pathname;
  const initials = user.name.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
  const pageTitles: Record<string, [string, string, string]> = {
    "/": ["VISÃO GERAL", "Dashboard", "Tudo que merece sua atenção, em um só lugar."],
    "/imoveis": ["OPERAÇÃO", "Imóveis", "Seu estoque, captações e oportunidades de venda."],
    "/clientes": ["RELACIONAMENTO", "Clientes", "Quem está comprando, o que procura e qual é o próximo passo."],
    "/negocios": ["COMERCIAL", "Negócios", "Acompanhe cada oportunidade até o fechamento."],
    "/agenda": ["ROTINA", "Agenda", "Visitas, follow-ups e compromissos que movem sua operação."],
    "/comissoes": ["FINANCEIRO", "Comissões", "Quanto você gerou, quanto recebeu e quanto ainda falta receber."],
    "/vgv": ["PERFORMANCE", "Meu VGV", "Sua produção imobiliária organizada por período."],
    "/ia": ["INTELIGÊNCIA", "Imobfy IA", "Transforme os dados da sua operação em próximas ações."],
    "/configuracoes": ["SISTEMA", "Configurações", "Seu perfil, metas e regras de comissionamento."],
  };
  const [kicker, title, description] = pageTitles[pathname] || ["IMOBFY", "Gestão imobiliária", "Sua operação imobiliária, organizada em um só lugar."];
  async function handleLogout() { await signOut(); setOpen(false); await navigate({ to: "/login" }); }

  return <div className="imobfy-app-shell">
    {open && <button aria-label="Fechar menu" className="imobfy-sidebar-overlay" onClick={() => setOpen(false)} />}
    <aside className={`clean-sidebar imobfy-sidebar ${open ? "open" : ""}`}>
      <div className="clean-brand imobfy-brand"><div className="brand-symbol" aria-hidden="true"><svg viewBox="0 0 40 40" role="img"><path d="M7 17.5 20 7l13 10.5V32H7V17.5Z" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round"/><path d="M14 32V22h12v10M14 16h.1M26 16h.1" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/><path d="m15.5 25.5 3 3 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></div><div className="imobfy-brand-copy"><strong>IMOBIFY<span>.</span></strong><span>GESTÃO IMOBILIÁRIA</span></div><button className="mobile-close" aria-label="Fechar menu" onClick={() => setOpen(false)}><X size={19} /></button></div>
      <nav><div className="nav-section">OPERAÇÃO</div><NavGroup items={primary} pathname={pathname} onNavigate={() => setOpen(false)} /><div className="nav-section">PERFORMANCE</div><NavGroup items={performance} pathname={pathname} onNavigate={() => setOpen(false)} /><div className="nav-section">SISTEMA</div><NavGroup items={settings} pathname={pathname} onNavigate={() => setOpen(false)} /></nav>
      <div className="sidebar-footer"><div className="profile-avatar">{initials || "L"}</div><div><strong>{user.name}</strong><span>{user.creci ? `CRECI ${user.creci}` : "Corretor / Captador"}</span></div><button title="Sair" aria-label="Sair" onClick={handleLogout}><LogOut size={15} /></button></div>
    </aside>
    <main className={`clean-main imobfy-main ${pathname === "/ia" ? "imobfy-main-ai" : ""}`}>
      {pathname !== "/ia" && <header className="clean-header imobfy-header">
        <button className="mobile-menu imobfy-mobile-menu" aria-label="Abrir menu" onClick={() => setOpen(true)}><Menu size={21} /></button>
        <div className="imobfy-header-copy"><span className="header-kicker">{kicker}</span><h1>{title}</h1><p>{description}</p></div>
        <div className="header-actions"><div className="header-avatar">{initials || "L"}</div></div>
      </header>}
      <div className={`content imobfy-content ${pathname === "/ia" ? "imobfy-content-ai" : ""}`}>{children}</div>
    </main>
  </div>;
}
