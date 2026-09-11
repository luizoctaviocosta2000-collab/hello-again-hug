import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ImobfyVgvCore from "../components/ImobfyVgvCore";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";

export const Route = createFileRoute("/vgv")({
  component: VgvPage,
});

function VgvPage() {
  const [user, setUser] = useState<ImobfyUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void restoreSession().then((session) => {
      setUser(session);
      setReady(true);
    });
  }, []);

  if (!ready || !user) return null;
  return <ImobfyVgvCore user={user} />;
}
