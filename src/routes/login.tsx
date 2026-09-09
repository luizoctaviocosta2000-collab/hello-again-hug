import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import ImobfyAuth from "../components/ImobfyAuth";
import { restoreSession } from "../lib/imobfy-session";

function LoginPage() {
  const navigate = useNavigate();
  useEffect(() => {
    void restoreSession().then((session) => {
      if (session) void navigate({ to: "/" });
    });
  }, [navigate]);
  return <ImobfyAuth onAuthenticated={() => void navigate({ to: "/" })} />;
}

export const Route = createFileRoute("/login")({ component: LoginPage });
