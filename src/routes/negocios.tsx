import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ImobfyNegociosCore from "../components/ImobfyNegociosCore";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-negocios-core.css";

export const Route = createFileRoute("/negocios")({
  component: NegociosRoute,
});

function NegociosRoute() {
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
  return <ImobfyNegociosCore user={user} />;
}

