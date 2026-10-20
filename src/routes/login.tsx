import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ImobfyAuth from "../components/ImobfyAuth";
import { restoreSession } from "../lib/imobfy-session";
import { supabase } from "../lib/supabase";

function LoginPage() {
  const navigate = useNavigate();
  const [checkingCallback, setCheckingCallback] = useState(true);
  const [callbackError, setCallbackError] = useState("");

  useEffect(() => {
    let active = true;

    async function handleAuthCallback() {
      if (!supabase || typeof window === "undefined") {
        if (active) setCheckingCallback(false);
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const hashType = hash.get("type");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          url.searchParams.delete("code");
          window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
        } else if (tokenHash && (type === "signup" || type === "email" || type === "magiclink")) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type === "signup" ? "signup" : type,
          });
          if (error) throw error;
          url.searchParams.delete("token_hash");
          url.searchParams.delete("type");
          window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
        } else if (hashType === "signup") {
          throw new Error("O link confirmou o e-mail, mas a sessão de acesso não foi criada. Tente abrir o link novamente em uma aba anônima.");
        }

        const session = await restoreSession();
        if (active && session) {
          await navigate({ to: "/", replace: true });
          return;
        }
      } catch (error) {
        if (active) setCallbackError(error instanceof Error ? error.message : "Não foi possível confirmar seu e-mail.");
      } finally {
        if (active) setCheckingCallback(false);
      }
    }

    void handleAuthCallback();
    return () => {
      active = false;
    };
  }, [navigate]);

  if (checkingCallback) {
    return <main className="auth-page"><section className="auth-form-panel"><div className="auth-form-wrap"><div className="auth-mobile-brand"><img src="/imobfy-icon.svg" alt="" /><strong>IMOBFY</strong></div><div className="auth-heading"><span className="label">IMOBFY</span><h2>Confirmando seu acesso...</h2><p>Estamos validando seu e-mail. Aguarde um instante.</p></div></div></section></main>;
  }

  return <ImobfyAuth onAuthenticated={() => void navigate({ to: "/", replace: true })} initialMessage={callbackError ? `Não foi possível confirmar automaticamente: ${callbackError}` : undefined} />;
}

export const Route = createFileRoute("/login")({ component: LoginPage });

