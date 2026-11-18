import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ImobfyAIChat from "../components/ImobfyAIChat";
import ImobfyAgentCenter from "../components/ImobfyAgentCenter";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-fixes.css";

export const Route = createFileRoute("/ia")({ component: IARoute });

function IARoute() {
  const [user, setUser] = useState<ImobfyUser | null>(null);
  const [view, setView] = useState<"agents" | "chat">("agents");

  useEffect(() => {
    let mounted = true;
    void restoreSession().then(session => { if (mounted) setUser(session); });
    return () => { mounted = false; };
  }, []);

  if (!user) return <div className="empty"><span>Carregando sessão...</span></div>;
  return (
    <div>
      <div className="imobfy-agent-switch" role="tablist" aria-label="Modo da inteligência do IMOBFY">
        <button type="button" role="tab" aria-selected={view==="agents"} onClick={()=>setView("agents")}>Equipe de especialistas</button>
        <button type="button" role="tab" aria-selected={view==="chat"} onClick={()=>setView("chat")}>Assistente geral</button>
      </div>
      {view==="agents" ? <ImobfyAgentCenter userId={user.id}/> : <div className="ai-page"><ImobfyAIChat user={user}/></div>}
    </div>
  );
}
