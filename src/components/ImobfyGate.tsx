import { useEffect, useState } from "react";
import ImobfyAuth from "./ImobfyAuth";
import ImobfyMvpApp, { type MvpModule } from "./ImobfyMvpApp";
import { getSession } from "../lib/imobfy-session";

export default function ImobfyGate({ module }: { module: MvpModule }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setAuthenticated(Boolean(getSession()));
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!authenticated) return <ImobfyAuth onAuthenticated={() => setAuthenticated(true)} />;
  return <ImobfyMvpApp module={module} />;
}
