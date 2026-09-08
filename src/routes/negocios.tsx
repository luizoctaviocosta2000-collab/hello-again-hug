import { createFileRoute } from "@tanstack/react-router";
import ImobfyMvpApp from "../components/ImobfyMvpApp";
export const Route = createFileRoute("/negocios")({ component: () => <ImobfyMvpApp module="negocios" /> });
