import { createFileRoute } from "@tanstack/react-router";
import ImobfyMvpApp from "../components/ImobfyMvpApp";
export const Route = createFileRoute("/comissoes")({ component: () => <ImobfyMvpApp module="comissoes" /> });
