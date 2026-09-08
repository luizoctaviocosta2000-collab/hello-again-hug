import { createFileRoute } from "@tanstack/react-router";
import ImobfyCleanApp from "../components/ImobfyCleanApp";
export const Route = createFileRoute("/negocios")({ component: () => <ImobfyCleanApp module="negocios" /> });
