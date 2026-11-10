import { createFileRoute } from "@tanstack/react-router";
import ImobfyAttendanceSimulator from "../components/ImobfyAttendanceSimulator";

export const Route = createFileRoute("/atendimento")({ component: ImobfyAttendanceSimulator });
