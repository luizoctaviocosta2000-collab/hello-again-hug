import "../imobfy-phase2.css";
import { createFileRoute } from "@tanstack/react-router";
import ImobfyNegocios from "../components/ImobfyNegocios";
export const Route = createFileRoute("/negocios")({ component: ImobfyNegocios });
