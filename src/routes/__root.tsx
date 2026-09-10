import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "../styles.css?url";
import "../imobfy-clean.css";
import "../imobfy-fixes.css";
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
    ],
    links: [{ rel: "stylesheet", href: appCss }],
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

  return (
    <QueryClientProvider client={queryClient}>
      {isAuth || !user ? <Outlet /> : <ImobfyAppShell user={user}><Outlet /></ImobfyAppShell>}
      <FloatingImobfyAI />
    </QueryClientProvider>
  );
}
