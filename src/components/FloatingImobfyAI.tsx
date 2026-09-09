import { useEffect, useState } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getSession, restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-ai-float.css";

type Message = { role: "user" | "assistant"; text: string };

async function readableFunctionError(error: unknown) {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: Response }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json();
        if (payload?.error) return `${payload.error}${payload.detail ? ` (${payload.detail})` : ""}`;
      } catch {
        try {
          const text = await context.clone().text();
          if (text) return text;
        } catch {}
      }
    }
  }
  return error instanceof Error ? error.message : "Erro ao conectar com a IA.";
}

export default function FloatingImobfyAI() {
  const [user, setUser] = useState<ImobfyUser | null>(() => getSession());
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void restoreSession().then(setUser);
  }, []);

  async function ask(text = question) {
    const value = text.trim();
    if (!value || loading) return;
    if (!user) {
      setMessages(current => [...current, { role: "assistant", text: "Sua sessão não foi encontrada. Faça login novamente para usar o Imobfy AI." }]);
      setOpen(true);
      return;
    }
    setQuestion("");
    setMessages(current => [...current, { role: "user", text: value }]);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("imobfy-ai", { body: { question: value } });
      if (error) throw error;
      setMessages(current => [...current, { role: "assistant", text: data?.answer || "Não consegui gerar uma resposta agora." }]);
    } catch (error) {
      const message = await readableFunctionError(error);
      setMessages(current => [...current, { role: "assistant", text: `Não consegui falar com a IA. ${message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return <>
    {open && <section className="imobfy-ai-window" aria-label="Assistente Imobfy AI">
      <header className="imobfy-ai-header"><div className="imobfy-ai-brand"><div className="imobfy-ai-mini-logo"><Sparkles size={16}/></div><div><strong>Imobfy AI</strong><span>Seu assistente comercial</span></div></div><button className="imobfy-ai-close" onClick={() => setOpen(false)} aria-label="Fechar"><X size={18}/></button></header>
      <div className="imobfy-ai-messages">
        {!messages.length && <div className="imobfy-ai-welcome"><div className="imobfy-ai-welcome-icon"><Bot size={25}/></div><strong>{user ? `Fala, ${user.name.split(" ")[0]}.` : "Imobfy AI"}</strong><p>Eu consigo analisar seus clientes, imóveis, negócios, agenda, VGV e comissões.</p><div className="imobfy-ai-suggestions"><button onClick={() => void ask("Quais são as melhores oportunidades que tenho hoje?")}>Melhores oportunidades</button><button onClick={() => void ask("Quais negócios estão parados e merecem follow-up?")}>Negócios parados</button><button onClick={() => void ask("Como está meu VGV e minhas comissões?")}>Meu VGV e comissões</button></div></div>}
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`imobfy-ai-message ${message.role}`}><span>{message.text}</span></div>)}
        {loading && <div className="imobfy-ai-message assistant"><span className="imobfy-ai-typing">Analisando seus dados...</span></div>}
      </div>
      <form className="imobfy-ai-input" onSubmit={event => { event.preventDefault(); void ask(); }}><input value={question} onChange={event => setQuestion(event.target.value)} placeholder="Pergunte sobre sua operação..." disabled={loading}/><button type="submit" disabled={loading || !question.trim()} aria-label="Enviar"><Send size={17}/></button></form>
    </section>}
    <button className={`imobfy-ai-fab ${open ? "is-open" : ""}`} onClick={() => setOpen(value => !value)} aria-label="Abrir Imobfy AI" title="Imobfy AI"><Sparkles size={22}/><span>IA</span></button>
  </>;
}
