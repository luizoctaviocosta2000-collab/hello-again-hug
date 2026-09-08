import { createFileRoute } from "@tanstack/react-router";
import ImobfyApp from "../components/ImobfyApp";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Imobfy" },
      { name: "description", content: "Visitas, reuniões, ligações e follow-ups organizados." },
      { property: "og:title", content: "Agenda — Imobfy" },
      { property: "og:description", content: "Visitas, reuniões, ligações e follow-ups organizados." },
    ],
  }),
  component: () => <ImobfyApp module="agenda" />,
});
