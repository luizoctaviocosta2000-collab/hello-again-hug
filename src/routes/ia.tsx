import { createFileRoute, redirect } from "@tanstack/react-router";
import ImobfyAI from "../components/ImobfyAI";
import { restoreSession } from "../lib/imobfy-session";

export const Route = createFileRoute("/ia")({
  beforeLoad: async () => {
    const user = await restoreSession();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  component: IA,
});

function IA() {
  const { user } = Route.useRouteContext();
  return <ImobfyAI user={user} />;
}
