import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ImobfyImoveisCore from "../components/ImobfyImoveisCore";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-negocios-core.css";

export const Route = createFileRoute("/imoveis")({
  component: ImoveisRoute,
});

function ImoveisRoute() {
  const [user, setUser] = useState<ImobfyUser | null>(null);
  useEffect(() => { void restoreSession().then(setUser); }, []);
  if (!user) return <div className="empty"><span>Carregando sessão...</span></div>;
  return <ImobfyImoveisCore user={user} />;
}
