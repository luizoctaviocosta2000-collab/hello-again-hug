import { createFileRoute } from "@tanstack/react-router";
import PremiumDashboard from "../components/PremiumDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Imobfy — Visão geral" },
      { name: "description", content: "Painel premium para gestão da operação imobiliária." },
      { property: "og:title", content: "Imobfy — Visão geral" },
      { property: "og:description", content: "Painel premium para gestão da operação imobiliária." },
    ],
  }),
  component: PremiumDashboard,
});
