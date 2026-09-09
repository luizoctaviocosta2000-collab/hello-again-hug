import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getSession } from "../lib/imobfy-session";

const LEGACY_KEYS = ["imobfy:imoveis", "imobfy:clientes", "imobfy:negocios", "imobfy:agenda", "imobfy:comissoes", "imobfy:vgv", "imobfy:configuracoes"];

export default function ImobfyCleanData({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      setReady(true);
      void navigate({ to: "/login" });
      return;
    }

    // Never carry demo/legacy records into the real user's workspace.
    LEGACY_KEYS.forEach((key) => window.localStorage.removeItem(key));
    setReady(true);
  }, [navigate]);

  if (!ready) return null;
  return <>{children}</>;
}
