import { createFileRoute } from "@tanstack/react-router";
import ImobfyNegociosCore from "../components/ImobfyNegociosCore";
import { restoreSession } from "../lib/imobfy-session";
import { useEffect, useState } from "react";
import type { ImobfyUser } from "../lib/imobfy-session";

export const Route = createFileRoute("/negocios")({
  component: NegociosRoute,
});

function NegociosRoute() {
  const [user, setUser] = useState<ImobfyUser | null>(null);
  useEffect(() => { void restoreSession().then(setUser); }, []);
  if (!user) return null;
  return <ImobfyNegociosCore user={user} />;
}
