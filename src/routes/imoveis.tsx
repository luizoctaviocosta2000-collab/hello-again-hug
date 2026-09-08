import { createFileRoute } from "@tanstack/react-router";
import ImobfyApp from "../components/ImobfyApp";

export const Route = createFileRoute("/imoveis")({
  head: () => ({
    meta: [
      { title: "Imóveis — Imobfy" },
      { name: "description", content: "Cadastre, acompanhe e organize sua carteira de imóveis." },
      { property: "og:title", content: "Imóveis — Imobfy" },
      { property: "og:description", content: "Cadastre, acompanhe e organize sua carteira de imóveis." },
    ],
  }),
  component: () => <ImobfyApp module="properties" />,
});
