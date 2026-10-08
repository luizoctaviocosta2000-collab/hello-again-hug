import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ImobfyAIChat from "../components/ImobfyAIChat";
import { supabase } from "../lib/supabase";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-fixes.css";

export const Route = createFileRoute("/ia")({ component: IARoute });

type Props = { user: ImobfyUser };

function IARoute() {
  const [user, setUser] = useState<ImobfyUser | null>(null);

  useEffect(() => { void restoreSession().then(setUser); }, []);

  if (!user) return <div className="empty"><span>Carregando sessão...</span></div>;
  return (
    <div className="ai-page">
      <ImobfyAIChat user={user} />
    </div>
  );
}
