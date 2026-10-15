import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "../styles.css?url";
import "../imobfy-clean.css";
import "../imobfy-fixes.css";
import "../imobfy-shell.css";
import "../imobfy-premium-system.css";
import FloatingImobfyAI from "../components/FloatingImobfyAI";
import ImobfyAppShell from "../components/ImobfyAppShell";
import { getSession } from "../lib/imobfy-session";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Imobfy — Gestão imobiliária" },
      { name: "description", content: "Gestão imobiliária simples, elegante e orientada a resultado." },
      { name: "theme-color", content: "#214E3B" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "IMOBIFY" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/imobify-icon.svg" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "apple-touch-icon", href: "/imobify-icon.svg" },
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
      {authenticated && <FloatingImobfyAI />}
    </QueryClientProvider>
  );
}
