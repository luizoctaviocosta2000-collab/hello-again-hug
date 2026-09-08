import { createFileRoute } from "@tanstack/react-router";
import ClientOnlyImobfyApp from "../components/ClientOnlyImobfyApp";

export const Route = createFileRoute("/comissoes")({
  head: () => ({
    meta: [
      { title: "Comissões — Imobfy" },
      { name: "description", content: "Controle de comissões geradas e recebidas." },
      { property: "og:title", content: "Comissões — Imobfy" },
      { property: "og:description", content: "Controle de comissões geradas e recebidas." },
    ],
  }),
  component: () => <ClientOnlyImobfyApp module="commissions" />,
});
