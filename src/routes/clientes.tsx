import { createFileRoute } from "@tanstack/react-router";
import ImobfyOperacaoPage from "../components/ImobfyOperacaoPage";
export const Route = createFileRoute("/clientes")({ component: () => <ImobfyOperacaoPage module="clientes" /> });
