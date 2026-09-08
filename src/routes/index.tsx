import { createFileRoute } from "@tanstack/react-router";
import PremiumDashboard from "../components/PremiumDashboard";
import ImobfyApp from "../components/ImobfyApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Imobfy — Visão geral" },
      { name: "description", content: "Painel premium para gestão da operação imobiliária." },
      { property: "og:title", content: "Imobfy — Visão geral" },
      { property: "og:description", content: "Painel premium para gestão da operação imobiliária." },
    ],
  }),
  component: () => {
    try {
      const session = JSON.parse(localStorage.getItem("imobfy-session-v1") || "null");
      return session ? <PremiumDashboard /> : <ImobfyApp module="dashboard" />;
    } catch {
      return <ImobfyApp module="dashboard" />;
    }
  },
});
