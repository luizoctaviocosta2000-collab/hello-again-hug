import { createFileRoute } from "@tanstack/react-router";
import ClientOnlyImobfyApp from "../components/ClientOnlyImobfyApp";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Imobfy" },
      { name: "description", content: "Percentuais, perfil e preferências do seu Imobfy." },
      { property: "og:title", content: "Configurações — Imobfy" },
      { property: "og:description", content: "Percentuais, perfil e preferências do seu Imobfy." },
    ],
  }),
  component: () => <ClientOnlyImobfyApp module="settings" />,
});
