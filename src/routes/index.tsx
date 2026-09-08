import { createFileRoute } from "@tanstack/react-router";
import ImobfyApp from "../components/ImobfyApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Imobfy" },
      { name: "description", content: "Painel do corretor com VGV, comissões e metas em tempo real." },
      { property: "og:title", content: "Dashboard — Imobfy" },
      { property: "og:description", content: "Painel do corretor com VGV, comissões e metas em tempo real." },
    ],
  }),
  component: () => <ImobfyApp module="dashboard" />,
});
