import { createFileRoute } from "@tanstack/react-router";
import ImobfyAgenda from "../components/ImobfyAgenda";

export const Route = createFileRoute("/agenda")({ component: ImobfyAgenda });
