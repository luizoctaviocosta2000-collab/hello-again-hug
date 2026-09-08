import { createFileRoute } from "@tanstack/react-router";
import ClientOnlyImobfyApp from "../components/ClientOnlyImobfyApp";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Imobfy" },
      { name: "description", content: "CRM imobiliário: leads, qualificação e follow-up." },
      { property: "og:title", content: "Clientes — Imobfy" },
      { property: "og:description", content: "CRM imobiliário: leads, qualificação e follow-up." },
    ],
  }),
  component: () => <ClientOnlyImobfyApp module="clients" />,
});
