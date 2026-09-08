import { createFileRoute } from "@tanstack/react-router";
import ImobfyMvpApp from "../components/ImobfyMvpApp";
export const Route = createFileRoute("/clientes")({ component: () => <ImobfyMvpApp module="clientes" /> });
