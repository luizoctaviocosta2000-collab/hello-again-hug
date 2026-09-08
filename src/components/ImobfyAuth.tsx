import { FormEvent, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { clearDemoData, setSession } from "../lib/imobfy-session";

export default function ImobfyAuth({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password.trim() || (mode === "signup" && !name.trim())) return;
    clearDemoData();
    const displayName = mode === "signup" ? name.trim() : email.split("@")[0] || "Corretor";
    setSession({ id: crypto.randomUUID(), name: displayName, email: email.trim() });
    onAuthenticated();
  }

  return <main className="auth-page"><section className="auth-brand-panel"><div className="auth-brand"><div className="brand-symbol">I</div><div><strong>imobfy</strong><span>GESTÃO IMOBILIÁRIA</span></div></div><div className="auth-pitch"><span className="label">SEU NEGÓCIO. SEU CONTROLE.</span><h1>Venda mais.<br /><em>Gerencie melhor.</em></h1><p>Um espaço premium para organizar imóveis, clientes, negócios e o dinheiro que sua operação gera.</p><div className="auth-points"><span><Check size={15}/> Tudo em um só lugar</span><span><Check size={15}/> Feito para corretores</span><span><Check size={15}/> Seus dados, sua operação</span></div></div><small className="auth-legal">Imobfy · Gestão imobiliária inteligente</small></section><section className="auth-form-panel"><div className="auth-form-wrap"><div className="auth-mobile-brand"><div className="brand-symbol">I</div><strong>imobfy</strong></div><div className="auth-heading"><span className="label">{mode === "signup" ? "COMECE AGORA" : "BEM-VINDO DE VOLTA"}</span><h2>{mode === "signup" ? "Crie sua conta." : "Entre na sua conta."}</h2><p>{mode === "signup" ? "Vamos começar sua operação do jeito certo." : "Acesse seu painel e continue de onde parou."}</p></div><form onSubmit={submit}>{mode === "signup" && <label>Seu nome<input value={name} onChange={e=>setName(e.target.value)} placeholder="Como você quer ser chamado?" autoComplete="name" /></label>}<label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" /></label><label>Senha<div className="password-field"><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "signup" ? "new-password" : "current-password"}/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label="Mostrar senha">{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label><button className="auth-submit" type="submit">{mode === "signup" ? "Criar minha conta" : "Entrar no Imobfy"}<ArrowRight size={17}/></button></form><div className="auth-switch">{mode === "signup" ? <>Já tem uma conta? <button onClick={()=>setMode("login")}>Entrar</button></> : <>Ainda não tem conta? <button onClick={()=>setMode("signup")}>Criar conta</button></>}</div></div></section></main>;
}
