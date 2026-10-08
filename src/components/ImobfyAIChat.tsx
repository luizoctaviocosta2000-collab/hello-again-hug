import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Mic, MicOff, Send, Sparkles, Volume2, VolumeX } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-fixes.css";

type Props = { user: ImobfyUser };
type Message = { role: "user" | "assistant"; text: string };
type AIResponse = { answer?: string; error?: string; conversation_id?: string };
type SpeechRecognitionResultEvent = Event & { results: { [index: number]: { [index: number]: { transcript: string } } } };
type SpeechRecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((event: SpeechRecognitionResultEvent) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
declare global { interface Window { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor; } }

const suggestions = [
  "Quais clientes devo contatar hoje?",
  "Quais negócios estão parados?",
  "Qual é meu maior VGV no pipeline?",
  "Quanto tenho para receber de comissão?",
];

export default function ImobfyAIChat({ user }: Props) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  async function ask(text: string) {
    const value = text.trim();
    if (!value || loading) return;

    setQuestion("");
    setError("");
    setMessages((current) => [...current, { role: "user", text: value }]);
    setLoading(true);

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
    } finally {
      setLoading(false);
    }
  }

  function toggleVoice() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Seu navegador não oferece reconhecimento de voz. Tente usar o Chrome ou Edge.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    setError("");
    const recognition = new Recognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() || "";
      if (transcript) void ask(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError("Não consegui ouvir sua voz. Verifique a permissão do microfone e tente novamente.");
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function speak(text: string, index: number) {
    if (!("speechSynthesis" in window)) {
      setError("Seu navegador não oferece leitura de voz.");
      return;
    }
    if (speaking === index) {
      window.speechSynthesis.cancel();
      setSpeaking(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1.02;
    utterance.onend = () => setSpeaking(null);
    setSpeaking(index);
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (prompt) void ask(prompt);
    };
    window.addEventListener("imobfy-ai-open", handleOpen);
    return (
    <div className="imobfy-ai-shell">
      <section className="imobfy-ai-hero">
        <div className="imobfy-ai-hero-copy">
          <div className="imobfy-ai-status"><span className="imobfy-ai-pulse" /> IMOBFY INTELLIGENCE <span>AO VIVO</span></div>
          <h1>Seu copiloto<br /><em>comercial.</em></h1>
          <p>Fale com o IMOBFY. Ele lê sua operação, encontra oportunidades e transforma comandos em próximas ações.</p>
          <div className="imobfy-ai-hero-actions">
            <button type="button" className="imobfy-ai-talk-button" onClick={() => { setShowChat(true); setTimeout(toggleVoice, 80); }}><span className="imobfy-ai-talk-icon"><Mic size={19} /></span><span><strong>Falar com o IMOBFY</strong><small>Toque e diga o que precisa</small></span></button>
            <button type="button" className="imobfy-ai-text-button" onClick={() => setShowChat(true)}><Sparkles size={15} /> Abrir assistente</button>
          </div>
        </div>
        <div className="imobfy-ai-orbit" aria-hidden="true"><div className="imobfy-ai-orbit-ring ring-one" /><div className="imobfy-ai-orbit-ring ring-two" /><div className="imobfy-ai-core"><Sparkles size={30} /><span>AI</span></div><div className="imobfy-ai-orbit-dot dot-one" /><div className="imobfy-ai-orbit-dot dot-two" /></div>
      </section>
      <section className="imobfy-ai-command">
        <div className="imobfy-ai-command-head"><div><span className="label">CENTRAL DE COMANDO</span><h2>O IMOBFY está olhando sua operação.</h2></div><span className="imobfy-ai-connected"><span /> Dados sincronizados</span></div>
        <div className="imobfy-ai-command-grid">
          <div className="imobfy-ai-command-card"><span className="imobfy-ai-command-number">01</span><div><strong>Entenda</strong><small>Pergunte sobre clientes, VGV, negócios e comissões.</small></div><button type="button" onClick={() => { setQuestion("Faça um diagnóstico da minha operação."); setShowChat(true); }}>Explorar <Send size={12} /></button></div>
          <div className="imobfy-ai-command-card"><span className="imobfy-ai-command-number">02</span><div><strong>Decida</strong><small>Descubra o que merece sua atenção agora.</small></div><button type="button" onClick={() => { setQuestion("O que merece minha atenção hoje?"); setShowChat(true); }}>Analisar <Send size={12} /></button></div>
          <div className="imobfy-ai-command-card"><span className="imobfy-ai-command-number">03</span><div><strong>Execute</strong><small>Use sua voz para registrar e organizar tarefas.</small></div><button type="button" onClick={() => { setShowChat(true); setTimeout(toggleVoice, 80); }}>Comandar <Mic size={12} /></button></div>
        </div>
      </section>
      {showChat && <section className="imobfy-ai-workspace clean-card">
        <div className="imobfy-ai-workspace-head"><div><span className="label">ASSISTENTE ATIVO</span><h2>O que posso fazer por você, {user.name.split(" ")[0]}?</h2></div><button type="button" className="imobfy-ai-close" onClick={() => setShowChat(false)}>Fechar</button></div>
        {!messages.length && <div className="ai-empty"><div className="imobfy-ai-suggestion-title"><Sparkles size={15} /> Sugestões para começar</div><div className="ai-suggestions">{suggestions.map((item) => <button key={item} type="button" onClick={() => void ask(item)}>{item}</button>)}</div></div>}
        {messages.length > 0 && <div className="ai-messages">{messages.map((message,index) => <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}><div className="ai-message-meta"><span>{message.role === "assistant" ? "IMOBFY AI" : "VOCÊ"}</span>{message.role === "assistant" && <button type="button" className="ai-voice-action" onClick={() => speak(message.text,index)}>{speaking === index ? <VolumeX size={13}/> : <Volume2 size={13}/>}</button>}</div><p>{message.text}</p></div>)}</div>}
        {loading && <div className="imobfy-ai-thinking"><span /><span /><span /> Analisando sua operação...</div>}
        {error && <div className="notice"><strong>IA:</strong> {error}</div>}
        <form className={`ai-input ${listening ? "is-listening" : ""}`} onSubmit={submit}><button className={`ai-mic-button ${listening ? "listening" : ""}`} type="button" onClick={toggleVoice} disabled={loading}>{listening ? <MicOff size={17}/> : <Mic size={17}/>}</button><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={listening ? "Estou ouvindo..." : "Digite ou fale com o Imobfy..."} disabled={loading}/><button className="clean-button primary" type="submit" disabled={loading || !question.trim()}><Send size={16}/> Perguntar</button></form>
      </section>}
      <div className="imobfy-ai-disclaimer"><Sparkles size={12}/> Inteligência aplicada aos dados da sua própria operação. Você continua no controle.</div>
    </div>
  );}
