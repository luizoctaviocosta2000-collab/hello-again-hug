import { useEffect, useRef, useState } from "react";
import { Bot, CalendarPlus, Check, Send, Sparkles, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getSession, restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-ai-float.css";

type Message = { role: "user" | "assistant"; text: string };
type AIAction = { type: "create_followup"; label: string; client_id: string; property_id?: string | null; deal_id?: string | null; starts_at: string; ends_at: string; notes?: string };

async function readableFunctionError(error: unknown) {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: Response }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json();
        if (payload?.error) return `${payload.error}${payload.detail ? ` (${payload.detail})` : ""}`;
      } catch {
        try { const text = await context.clone().text(); if (text) return text; } catch {}
      }
    }
  }
  return error instanceof Error ? error.message : "Erro ao conectar com a IA.";
}

function formatActionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data não definida";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function FloatingImobfyAI() {
  const [user, setUser] = useState<ImobfyUser | null>(() => getSession());
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<AIAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<number | null>(null);
  const askRef = useRef<(text: string) => void>(() => undefined);

  async function ask(text = question) {
    const value = text.trim(); if (!value || loading) return;
    if (!user) { setMessages(current => [...current, { role: "assistant", text: "Sua sessão não foi encontrada. Faça login novamente para usar o Imobfy AI." }]); setOpen(true); return; }
    setQuestion(""); setMessages(current => [...current, { role: "user", text: value }]); setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("imobfy-ai", { body: { question: value } });
      if (error) throw error;
      if (!data || typeof data !== "object") throw new Error("A IA retornou uma resposta vazia.");
      if (data.error) throw new Error(`${data.error}${data.detail ? ` (${data.detail})` : ""}`);
      const answer = typeof data.answer === "string" ? data.answer.trim() : "";
      if (!answer) {
        const diagnostic = data.provider_status ? `Status do provedor: ${data.provider_status}.` : "O servidor da IA não retornou o campo de resposta.";
        throw new Error(diagnostic);
      }
      setMessages(current => [...current, { role: "assistant", text: answer }]);
      if (Array.isArray(data.actions)) setActions(data.actions as AIAction[]);
    } catch (error) {
      const message = await readableFunctionError(error);
      setMessages(current => [...current, { role: "assistant", text: `Não consegui falar com a IA. ${message}` }]);
    } finally { setLoading(false); }
  }
  askRef.current = (text: string) => { void ask(text); };

  useEffect(() => {
    void restoreSession().then(setUser);
    const handleOpen = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt?.trim();
      setOpen(true);
      if (prompt) askRef.current(prompt);
    };
    window.addEventListener("imobfy-ai-open", handleOpen);
    return () => window.removeEventListener("imobfy-ai-open", handleOpen);
  }, []);

  async function executeAction(action: AIAction, index: number) {
    if (!user || executing !== null) return;
    const starts = new Date(action.starts_at), ends = new Date(action.ends_at);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
      setMessages(current => [...current, { role: "assistant", text: "Não executei esse follow-up porque a data ou horário sugerido pela IA é inválido." }]);
      return;
    }
    setExecuting(index);
    const { error } = await supabase.from("appointments").insert({ user_id: user.id, client_id: action.client_id, property_id: action.property_id || null, deal_id: action.deal_id || null, title: action.label || "Follow-up comercial", starts_at: starts.toISOString(), ends_at: ends.toISOString(), status: "scheduled", notes: action.notes || "Follow-up criado pelo Imobfy AI após confirmação do corretor." });
    if (error) setMessages(current => [...current, { role: "assistant", text: `Não consegui criar o follow-up: ${error.message}` }]);
    else { setActions(current => current.filter((_, i) => i !== index)); setMessages(current => [...current, { role: "assistant", text: `Pronto. Follow-up criado na sua agenda para ${formatActionDate(action.starts_at)}.` }]); }
    setExecuting(null);
  }

  return <>
    {open && <section className="imobfy-ai-window" aria-label="Assistente Imobfy AI">
      <header className="imobfy-ai-header"><div className="imobfy-ai-brand"><div className="imobfy-ai-mini-logo"><Sparkles size={16}/></div><div><strong>Imobfy AI</strong><span>Seu assistente comercial · com ações</span></div></div><button className="imobfy-ai-close" onClick={() => setOpen(false)} aria-label="Fechar"><X size={18}/></button></header>
      <div className="imobfy-ai-messages">
        {!messages.length && <div className="imobfy-ai-welcome"><div className="imobfy-ai-welcome-icon"><Bot size={25}/></div><strong>{user ? `Fala, ${user.name.split(" ")[0]}.` : "Imobfy AI"}</strong><p>Eu analiso seu CRM e, quando fizer sentido, preparo ações para você confirmar.</p><div className="imobfy-ai-suggestions"><button onClick={() => void ask("Quais são as melhores oportunidades que tenho hoje?")}>Melhores oportunidades</button><button onClick={() => void ask("Quais negócios estão parados e merecem follow-up? Crie os follow-ups mais importantes para eu confirmar.")}>Follow-ups prioritários</button><button onClick={() => void ask("Como está meu VGV e minhas comissões?")}>Meu VGV e comissões</button></div></div>}
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`imobfy-ai-message ${message.role}`}><span>{message.text}</span></div>)}
        {actions.map((action, index) => <div key={`${action.type}-${index}`} style={{ margin: "10px 0", padding: 13, border: "1px solid #dfd7c6", borderRadius: 15, background: "#fffdf8" }}><div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}><div style={{ width: 32, height: 32, borderRadius: 10, background: "#eee7d8", color: "#8b6a2d", display: "grid", placeItems: "center", flexShrink: 0 }}><CalendarPlus size={16}/></div><div style={{ flex: 1 }}><strong style={{ display: "block", color: "#292a27", fontSize: 12 }}>Ação sugerida</strong><div style={{ color: "#55544e", fontSize: 12, marginTop: 4 }}>{action.label}</div><div style={{ color: "#8a8982", fontSize: 11, marginTop: 4 }}>{formatActionDate(action.starts_at)} · 30 min</div>{action.notes && <div style={{ color: "#77756f", fontSize: 11, lineHeight: 1.45, marginTop: 6 }}>{action.notes}</div>}<button onClick={() => void executeAction(action, index)} disabled={executing !== null} style={{ marginTop: 9, border: 0, borderRadius: 10, padding: "8px 11px", background: "#222421", color: "#e4c27a", fontWeight: 800, fontSize: 11, cursor: executing === null ? "pointer" : "wait", display: "inline-flex", alignItems: "center", gap: 6 }}><Check size={14}/>{executing === index ? "Criando..." : "Confirmar e criar na agenda"}</button></div></div></div>)}
        {loading && <div className="imobfy-ai-message assistant"><span className="imobfy-ai-typing">Analisando seus dados...</span></div>}
      </div>
      <form className="imobfy-ai-input" onSubmit={event => { event.preventDefault(); void ask(); }}><input value={question} onChange={event => setQuestion(event.target.value)} placeholder="Pergunte ou peça para eu agir..." disabled={loading}/><button type="submit" disabled={loading || !question.trim()} aria-label="Enviar"><Send size={17}/></button></form>
    </section>}
    <button className={`imobfy-ai-fab ${open ? "is-open" : ""}`} onClick={() => setOpen(value => !value)} aria-label="Abrir Imobfy AI" title="Imobfy AI"><Sparkles size={22}/><span>IA</span></button>
  </>;
}
