import { createFileRoute } from "@tanstack/react-router";
import ImobfyAttendanceWorkspace from "../components/ImobfyAttendanceWorkspace";

export const Route = createFileRoute("/atendimento")({ component: ImobfyAttendanceWorkspace });
