import { createFileRoute } from "@tanstack/react-router";
import ImobfyCleanApp from "../components/ImobfyCleanApp";
export const Route = createFileRoute("/configuracoes")({ component: () => <ImobfyCleanApp module="configuracoes" /> });
