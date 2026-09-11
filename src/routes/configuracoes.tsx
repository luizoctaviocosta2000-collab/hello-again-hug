import { createFileRoute } from "@tanstack/react-router";
import ImobfyConfiguracoesCore from "../components/ImobfyConfiguracoesCore";

export const Route = createFileRoute("/configuracoes")({
  component: ImobfyConfiguracoesCore,
});
