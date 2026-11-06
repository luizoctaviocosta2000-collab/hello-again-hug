import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { clearSession, restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import { supabase } from "../lib/supabase";

export default function ImobfySessionGate({ children }: { children: (user: ImobfyUser) => ReactNode }) {
  const navigate = useNavigate();
  // The server and the first browser render must show the same loading state.
  const [user, setUser] = useState<ImobfyUser | null>(null);

  useEffect(() => {
    let active = true;
    void restoreSession().then((session) => {
      if (!active) return;
      setUser(session);
      if (!session) void navigate({ to: "/login", replace: true });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!active || event !== "SIGNED_OUT") return;
      clearSession();
      setUser(null);
      void navigate({ to: "/login", replace: true });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (!user) return <div className="empty" role="status"><span>Carregando sessão...</span></div>;
  return children(user);
}
