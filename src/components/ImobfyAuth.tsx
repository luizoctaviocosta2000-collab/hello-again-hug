import { FormEvent, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { clearDemoData, setSession } from "../lib/imobfy-session";
import { supabase, supabaseConfigured } from "../lib/supabase";

const APP_URL = "https://imobfyy.lovable.app";

type ImobfyAuthProps = {
  onAuthenticated: () => void;
  initialMessage?: string;
};

export default function ImobfyAuth({ onAuthenticated, initialMessage }: ImobfyAuthProps) {
  const confirmed = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("confirmed") === "1";
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(initialMessage || (confirmed ? "E-mail confirmado. Agora entre com seu e-mail e senha para acessar o Imobfy." : ""));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!email.trim() || password.length < 6 || (mode === "signup" && !name.trim())) {
      setError(mode === "signup" ? "Preencha seu nome e use uma senha com pelo menos 6 caracteres." : "Informe seu e-mail e uma senha com pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      if (supabaseConfigured && supabase) {
        if (mode === "signup") {
          const { data, error: authError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: { full_name: name.trim() },
              emailRedirectTo: `${APP_URL}/login?confirmed=1`,
            },
          });
          if (authError) throw authError;
          if (!data.user) throw new Error("Não foi possível criar sua conta.");
          if (!data.session) {
            setMessage("Conta criada. Confira seu e-mail para confirmar o acesso. Depois, entre com seu e-mail e senha.");
            setMode("login");
            return;
          }
          setSession({ id: data.user.id, name: name.trim(), email: data.user.email ?? email.trim() });
        } else {
          const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (authError) throw authError;
          if (!data.user) throw new Error("Não foi possível iniciar sua sessão.");
          const displayName = (data.user.user_metadata?.["full_name"] as string | undefined) || data.user.email?.split("@")[0] || "Corretor";
          setSession({ id: data.user.id, name: displayName, email: data.user.email ?? email.trim() });
        }
      } else {
        clearDemoData();
        const displayName = mode === "signup" ? name.trim() : email.split("@")[0] || "Corretor";
        setSession({ id: crypto.randomUUID(), name: displayName, email: email.trim() });
      }
      onAuthenticated();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Não foi possível concluir o acesso.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-page"><section className="auth-brand-panel"><div className="auth-brand"><img src="/imobfy-logo.svg" alt="IMOBFY — Gestão inteligente para grandes conquistas" /></div><div className="auth-pitch"><span className="label">SEU NEGÓCIO. SEU CONTROLE.</span><h1>Venda mais.<br /><em>Gerencie melhor.</em></h1><p>Um espaço premium para organizar imóveis, clientes, negócios e o dinheiro que sua operação gera.</p><div className="auth-points"><span><Check size={15}/> Tudo em um só lugar</span><span><Check size={15}/> Feito para corretores</span><span><Check size={15}/> Seus dados, sua operação</span></div></div><small className="auth-legal">Imobfy · Gestão imobiliária inteligente</small></section><section className="auth-form-panel"><div className="auth-form-wrap"><div className="auth-mobile-brand"><img src="/imobfy-icon.svg" alt="" /><div><strong>IMOBFY</strong><span>GESTÃO INTELIGENTE PARA GRANDES CONQUISTAS</span></div></div><div className="auth-heading"><span className="label">{mode === "signup" ? "COMECE AGORA" : "BEM-VINDO DE VOLTA"}</span><h2>{mode === "signup" ? "Crie sua conta." : "Entre na sua conta."}</h2><p>{mode === "signup" ? "Vamos começar sua operação do jeito certo." : "Acesse seu painel e continue de onde parou."}</p></div>{error && <div className="auth-feedback error">{error}</div>}{message && <div className="auth-feedback success">{message}</div>}<form onSubmit={submit}>{mode === "signup" && <label>Seu nome<input value={name} onChange={e=>setName(e.target.value)} placeholder="Como você quer ser chamado?" autoComplete="name" /></label>}<label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" /></label><label>Senha<div className="password-field"><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "signup" ? "new-password" : "current-password"}/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label="Mostrar senha">{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label><button className="auth-submit" type="submit" disabled={loading}>{loading ? "Processando..." : mode === "signup" ? "Criar minha conta" : "Entrar no Imobfy"}{!loading && <ArrowRight size={17}/>}</button></form><div className="auth-switch">{mode === "signup" ? <>Já tem uma conta? <button type="button" onClick={()=>{setMode("login");setError("");setMessage("")}}>Entrar</button></> : <>Ainda não tem conta? <button type="button" onClick={()=>{setMode("signup");setError("");setMessage("")}}>Criar conta</button></>}</div></div></section></main>;
}
