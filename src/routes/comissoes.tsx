import { createFileRoute } from "@tanstack/react-router";
import ImobfyFinanceiro from "../components/ImobfyFinanceiro";

export const Route = createFileRoute("/comissoes")({ component: ImobfyFinanceiro });
