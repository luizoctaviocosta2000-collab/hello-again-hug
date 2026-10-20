import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "../styles.css?url";
import "../imobfy-clean.css";
import "../imobfy-fixes.css";
import "../imobfy-shell.css";
import "../imobfy-premium-system.css";
import "../imobfy-design.css";
import FloatingImobfyAI from "../components/FloatingImobfyAI";
import ImobfyAppShell from "../components/ImobfyAppShell";
import { getSession } from "../lib/imobfy-session";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "IMOBFY — Clareza para o próximo passo" },
      { name: "description", content: "Sua operação imobiliária, organizada. Clareza para o próximo passo." },
      { name: "theme-color", content: "#1C1F26" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "IMOBFY" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;750;800&display=swap" },
      { rel: "icon", type: "image/svg+xml", href: "/imobfy-icon.svg" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "apple-touch-icon", href: "/imobfy-icon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => <div style={{ padding: 40 }}>Página não encontrada.</div>,
});

function RootShell({ children }: { children: ReactNode }) {
  return <html lang="pt-BR"><head><HeadContent /></head><body>{children}<Scripts /></body></html>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  const user = getSession();
  const isAuth = location.pathname === "/login" || location.pathname.startsWith("/recuperar");
  const isPublicProperty = location.pathname.startsWith("/p/");
  const authenticated = Boolean(user) && !isAuth && !isPublicProperty;

  return (
    <QueryClientProvider client={queryClient}>
      {authenticated ? <ImobfyAppShell user={user!}><Outlet /></ImobfyAppShell> : <Outlet />}
      {authenticated && location.pathname !== "/ia" && <FloatingImobfyAI />}
    </QueryClientProvider>
  );
}
