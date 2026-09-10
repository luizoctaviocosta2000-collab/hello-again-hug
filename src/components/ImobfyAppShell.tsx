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
  const pageTitles: Record<string, [string, string]> = {
    "/": ["VISÃO GERAL", "Dashboard"], "/imoveis": ["OPERAÇÃO", "Imóveis"], "/clientes": ["RELACIONAMENTO", "Clientes"], "/negocios": ["COMERCIAL", "Negócios"], "/agenda": ["ROTINA", "Agenda"], "/comissoes": ["FINANCEIRO", "Comissões"], "/vgv": ["PERFORMANCE", "Meu VGV"], "/ia": ["INTELIGÊNCIA", "Imobfy IA"], "/configuracoes": ["SISTEMA", "Configurações"],
  };
  const [kicker, title] = pageTitles[pathname] || ["IMOBFY", "Gestão imobiliária"];
  async function handleLogout() { await signOut(); setOpen(false); await navigate({ to: "/login" }); }

  return <div className="imobfy-app-shell">
    {open && <button aria-label="Fechar menu" className="imobfy-sidebar-overlay" onClick={() => setOpen(false)} />}
    <aside className={`clean-sidebar imobfy-sidebar ${open ? "open" : ""}`}>
      <div className="clean-brand"><div className="brand-symbol">I</div><div><strong>Imobfy</strong><span>GESTÃO IMOBILIÁRIA</span></div><button className="mobile-close" aria-label="Fechar menu" onClick={() => setOpen(false)}><X size={19} /></button></div>
      <nav><div className="nav-section">OPERAÇÃO</div><NavGroup items={primary} pathname={pathname} onNavigate={() => setOpen(false)} /><div className="nav-section">PERFORMANCE</div><NavGroup items={performance} pathname={pathname} onNavigate={() => setOpen(false)} /><div className="nav-section">SISTEMA</div><NavGroup items={settings} pathname={pathname} onNavigate={() => setOpen(false)} /></nav>
      <div className="sidebar-footer"><div className="profile-avatar">{initials || "L"}</div><div><strong>{user.name}</strong><span>{user.creci ? `CRECI ${user.creci}` : "Corretor / Captador"}</span></div><button title="Sair" aria-label="Sair" onClick={handleLogout}><LogOut size={15} /></button></div>
    </aside>
    <main className="clean-main imobfy-main">
      <header className="clean-header imobfy-header">
        <button className="mobile-menu imobfy-mobile-menu" aria-label="Abrir menu" onClick={() => setOpen(true)}><Menu size={21} /></button>
        <div className="imobfy-header-copy"><span className="header-kicker">{kicker}</span><h1>{title}</h1><p>Seu negócio imobiliário, organizado em um só lugar.</p></div>
        <div className="header-actions"><div className="header-avatar">{initials || "L"}</div></div>
      </header>
      <div className="content imobfy-content">{children}</div>
    </main>
  </div>;
}
