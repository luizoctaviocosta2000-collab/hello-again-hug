import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ImobfyOperacao from "../components/ImobfyOperacao";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-clean.css";
import "../imobfy-fixes.css";

export const Route = createFileRoute("/clientes")({ component: ClientesRoute });

function ClientesRoute() {
  const navigate = useNavigate();
  const [user, setUser] = useState<ImobfyUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    void restoreSession().then((session) => {
      if (!active) return;
      if (!session) {
        void navigate({ to: "/login", replace: true });
        return;
      }
      setUser(session);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  if (checking) return <div className="empty" role="status" aria-live="polite"><span>Verificando sua sessão...</span></div>;
  if (!user) return null;
  return <ImobfyOperacao module="clientes" userId={user.id} />;
}

