import { createFileRoute } from "@tanstack/react-router";
import ClientOnlyImobfyApp from "../components/ClientOnlyImobfyApp";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Imobfy" },
      { name: "description", content: "Visitas, reuniões, ligações e follow-ups organizados." },
      { property: "og:title", content: "Agenda — Imobfy" },
      { property: "og:description", content: "Visitas, reuniões, ligações e follow-ups organizados." },
    ],
  }),
  component: () => <ClientOnlyImobfyApp module="agenda" />,
});
