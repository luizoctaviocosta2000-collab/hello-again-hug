import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ImobfyOperacao from "../components/ImobfyOperacao";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-clean.css";
import "../imobfy-fixes.css";

export const Route = createFileRoute("/clientes")({ component: ClientesRoute });

function ClientesRoute() {
  const [user, setUser] = useState<ImobfyUser | null>(null);
  useEffect(() => {
    void restoreSession().then(setUser);
  }, []);

  if (!user) return <div className="empty"><span>Carregando sessão...</span></div>;
  return <ImobfyOperacao module="clientes" userId={user.id} />;
}
