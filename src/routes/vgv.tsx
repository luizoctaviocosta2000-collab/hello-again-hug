import { createFileRoute } from "@tanstack/react-router";
import ImobfyApp from "../components/ImobfyApp";

export const Route = createFileRoute("/vgv")({
  head: () => ({
    meta: [
      { title: "Meu VGV — Imobfy" },
      { name: "description", content: "VGV captado, vendido e em carteira em um só painel." },
      { property: "og:title", content: "Meu VGV — Imobfy" },
      { property: "og:description", content: "VGV captado, vendido e em carteira em um só painel." },
    ],
  }),
  component: () => <ImobfyApp module="vgv" />,
});
