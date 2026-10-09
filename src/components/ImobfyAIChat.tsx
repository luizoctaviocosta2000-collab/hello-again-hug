import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, BrainCircuit, CalendarPlus, Command, Mic, MicOff, Plus, Send, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { ImobfyUser } from "../lib/imobfy-session";
import ImobfyAITaskComposer from "./ImobfyAITaskComposer";
import "../imobfy-fixes.css";

type Props = { user: ImobfyUser };
type Message = { role: "user" | "assistant"; text: string };
type AIResponse = { answer?: string; error?: string; conversation_id?: string };
type SpeechRecognitionResultEvent = Event & {
  results: { [index: number]: { [index: number]: { transcript: string } } };
};
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
declare global { interface Window { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor; } }

const commands = [
  { label: "Minha prioridade", prompt: "O que merece minha atenção hoje?", detail: "Encontre o que pode gerar resultado agora." },
  { label: "Negócios parados", prompt: "Quais negócios estão parados?", detail: "Identifique oportunidades que precisam de ação." },
  { label: "Meu financeiro", prompt: "Quanto tenho para receber?", detail: "Veja o que está previsto para entrar." },
  { label: "Próximo contato", prompt: "Quais clientes devo contatar?", detail: "Escolha os contatos com maior potencial." },
];

export default function ImobfyAIChat({ user }: Props) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const navigate = useNavigate();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const askRef = useRef<(text: string) => Promise<void>>(async () => {});
  const listeningRef = useRef(false);
  const mountedRef = useRef(true);

  async function ask(text: string) {
    const value = text.trim();
    if (!value || loading) return;
    setQuestion(""); setError(""); setLoading(true);
    setMessages((current) => [...current, { role: "user", text: value }]);
    try {
      const { data, error: functionError } = await supabase.functions.invoke<AIResponse>("imobfy-ai", {
        body: { question: value, conversation_id: conversationId },
      });
      if (functionError) throw functionError;
      if (!data?.answer) throw new Error(data?.error || "A IA não retornou uma resposta.");
      if (data.conversation_id) setConversationId(data.conversation_id);
      setMessages((current) => [...current, { role: "assistant", text: data.answer! }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível falar com a IA.");
    } finally { setLoading(false); }
  }

  askRef.current = ask;
  listeningRef.current = listening;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); void ask(question);
  }

  function stopVoice() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    listeningRef.current = false;
    setListening(false);
    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      try { recognition.stop(); } catch { /* recognition may already be stopped */ }
    }
  }

  function toggleVoice() {
    if (listeningRef.current) { stopVoice(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setError("Seu navegador não oferece reconhecimento de voz. Use Chrome ou Edge."); return; }
    setError("");
    const recognition = new Recognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() || "";
      if (transcript) void askRef.current(transcript);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        listeningRef.current = false;
        if (mountedRef.current) setListening(false);
      }
    };
    recognition.onerror = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        listeningRef.current = false;
        if (mountedRef.current) {
          setListening(false);
          setError("Não consegui ouvir sua voz. Verifique a permissão do microfone.");
        }
      }
    };
    recognitionRef.current = recognition;
    listeningRef.current = true;
    setListening(true);
    try { recognition.start(); }
    catch {
      recognitionRef.current = null;
      listeningRef.current = false;
      setListening(false);
      setError("Não consegui iniciar o microfone. Tente novamente.");
    }
  }

  function speak(text: string, index: number) {
    if (!("speechSynthesis" in window)) { setError("Seu navegador não oferece leitura de voz."); return; }
    if (speaking === index) { window.speechSynthesis.cancel(); setSpeaking(null); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR"; utterance.rate = 1.02; utterance.onend = () => setSpeaking(null);
    setSpeaking(index); window.speechSynthesis.speak(utterance);
  }

  function newConversation() {
    setMessages([]);
    setConversationId(null);
    setQuestion("");
    setError("");
    setSpeaking(null);
    stopVoice();
    window.speechSynthesis?.cancel();
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        recognition.onresult = null;
        recognition.onend = null;
        recognition.onerror = null;
        try { recognition.stop(); } catch { /* already stopped */ }
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (prompt) void ask(prompt);
    };
    window.addEventListener("imobfy-ai-open", handleOpen);
    return () => window.removeEventListener("imobfy-ai-open", handleOpen);
  }, [conversationId, loading]);

  const firstName = user.name.split(" ")[0];
  const sessions = [
    { label: "Visão geral", to: "/" }, { label: "Imóveis", to: "/imoveis" },
    { label: "Clientes", to: "/clientes" }, { label: "Negócios", to: "/negocios" },
    { label: "Agenda", to: "/agenda" }, { label: "Comissões", to: "/comissoes" },
    { label: "Meu VGV", to: "/vgv" },
  ];

  return (
    <div className={`imobfy-intelligence ${messages.length ? "has-conversation" : ""}`}>
      <header className="imobfy-intelligence-top">
        <div className="imobfy-intelligence-top-left">
          <button type="button" className={`intelligence-menu-trigger ${showSessions ? "is-open" : ""}`} onClick={() => setShowSessions((value) => !value)} aria-label="Abrir navegação" aria-expanded={showSessions}>
            <span /><span /><span />
          </button>
          {showSessions && <div className="intelligence-session-menu">
            <span className="session-menu-kicker">IR PARA</span>
            {sessions.map((session) => <button key={session.to} type="button" onClick={() => { setShowSessions(false); void navigate({ to: session.to }); }}>{session.label}<ArrowUpRight size={12} /></button>)}
          </div>}
        </div>
        <div className="imobfy-intelligence-brand">
          <div className="imobfy-intelligence-mark"><Sparkles size={14} /></div>
          <div><span>IMOBFY</span><strong>INTELLIGENCE</strong></div>
        </div>
        <div className="imobfy-intelligence-top-actions">
          <div className="imobfy-intelligence-live"><i /> SISTEMA ONLINE</div>
          {messages.length > 0 && (
            <button type="button" className="intelligence-new-top" onClick={newConversation}>
              <Plus size={13} /> Nova conversa
            </button>
          )}
        </div>
      </header>

      {!messages.length ? (
        <main className="imobfy-intelligence-stage">
          <div className="imobfy-intelligence-grid" aria-hidden="true" />
          <div className="imobfy-intelligence-noise" aria-hidden="true" />
          <div className="imobfy-intelligence-particles" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>
          <div className="imobfy-intelligence-copy">
            <span className="imobfy-intelligence-kicker"><Command size={11} /> CENTRAL DE INTELIGÊNCIA COMERCIAL</span>
            <h1>Seu negócio.<br /><em>Uma inteligência a mais.</em></h1>
            <p>Converse com seus dados, descubra prioridades e transforme informação em próxima ação.</p>
            <div className={`imobfy-intelligence-listen ${listening ? "is-listening" : ""}`}>
              <span className="listen-icon"><Mic size={17} /></span>
              <span className="listen-copy"><strong>{listening ? "Estou ouvindo..." : "Comando de voz"}</strong><small>{listening ? "Fale com o núcleo central" : "Clique no núcleo para falar com a IA"}</small></span>
            </div>
          </div>

          <div className="imobfy-intelligence-signal" aria-hidden="true">
            <div className="signal-hud">
              <span>AI CORE</span><i /> <small>READY</small>
            </div>
            <span className="signal-ring ring-a" /><span className="signal-ring ring-b" /><span className="signal-ring ring-c" />
            <span className="signal-scan" />
            <div className="signal-label signal-label-a">LIVE DATA</div>
            <div className="signal-label signal-label-b">CRM / REAL TIME</div>
            <button type="button" className={`signal-core ${listening ? "is-listening" : ""}`} onClick={toggleVoice} aria-label={listening ? "Parar comando de voz" : "Ativar comando de voz"}>
              <div className="signal-core-inner"><BrainCircuit size={29} /></div>
            </button>
            <span className="signal-orbit orbit-a" /><span className="signal-orbit orbit-b" />
          </div>

          <section className="imobfy-intelligence-commands">
            <div className="commands-heading">
              <div><span>COMANDOS RÁPIDOS</span><strong>Comece por uma pergunta</strong></div>
              <small>4 atalhos inteligentes</small>
            </div>
            <div className="command-deck">
              {commands.map((command, index) => (
                <button key={command.prompt} type="button" className="command-card" onClick={() => void ask(command.prompt)}>
                  <span className="command-index">0{index + 1}</span>
                  <span className="command-content"><strong>{command.label}</strong><small>{command.detail}</small></span>
                  <span className="command-go"><ArrowUpRight size={15} /></span>
                </button>
              ))}
            </div>
          </section>
        </main>
      ) : (
        <main className="imobfy-intelligence-conversation">
          <div className="conversation-header">
            <div className="conversation-title">
              <span><i /> CONVERSA ATIVA</span>
              <strong>Estou com você, {firstName}.</strong>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" className="conversation-new" onClick={() => setShowTaskComposer((value) => !value)}><CalendarPlus size={14} /> Nova tarefa</button><button type="button" className="conversation-new" onClick={newConversation}><Plus size={14} /> Nova conversa</button></div>
          </div>
          {showTaskComposer && <ImobfyAITaskComposer userId={user.id} onClose={() => setShowTaskComposer(false)} onCreated={(message) => { setMessages((current) => [...current, { role: "assistant", text: message }]); setShowTaskComposer(false); }} />}
          <div className="conversation-feed">
            {messages.map((message, index) => (
              <article className={`intelligence-message ${message.role}`} key={`${message.role}-${index}`}>
                <span>{message.role === "assistant" ? "IMOBFY AI" : "VOCÊ"}</span>
                <p>{message.text}</p>
                {message.role === "assistant" && (
                  <button type="button" onClick={() => speak(message.text, index)} className="message-speak" aria-label="Ouvir resposta">
                    {speaking === index ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  </button>
                )}
              </article>
            ))}
            {loading && <div className="intelligence-thinking"><i /><i /><i /> analisando sua operação</div>}
          </div>
          {error && <div className="intelligence-error">{error}</div>}
          <form className={`intelligence-composer ${listening ? "is-listening" : ""}`} onSubmit={submit}>
            <button type="button" onClick={toggleVoice} disabled={loading} aria-label="Comando de voz">
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <input value={question} onChange={(event) => setQuestion(event.target.value)} disabled={loading} placeholder={listening ? "Estou ouvindo..." : "Diga ou escreva um comando..."} />
            <button type="submit" disabled={loading || !question.trim()} aria-label="Enviar"><Send size={17} /></button>
          </form>
        </main>
      )}

      <div className="imobfy-intelligence-footer"><span>IA PRIVADA</span><i /> conectada aos dados da sua operação <b>•</b> você continua no controle</div>
    </div>
  );
}
