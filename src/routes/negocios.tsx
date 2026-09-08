import { createFileRoute } from "@tanstack/react-router";
import ClientOnlyImobfyApp from "../components/ClientOnlyImobfyApp";

export const Route = createFileRoute("/negocios")({
  head: () => ({
    meta: [
      { title: "Negócios — Imobfy" },
      { name: "description", content: "Pipeline comercial do primeiro contato ao fechamento." },
      { property: "og:title", content: "Negócios — Imobfy" },
      { property: "og:description", content: "Pipeline comercial do primeiro contato ao fechamento." },
    ],
  }),
  component: () => <ClientOnlyImobfyApp module="deals" />,
});
