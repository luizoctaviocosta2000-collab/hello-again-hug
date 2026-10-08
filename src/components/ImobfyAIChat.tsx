import { FormEvent, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { ImobfyUser } from "../lib/imobfy-session";
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
  "O que merece minha atenção hoje?",
  "Quais negócios estão parados?",
  "Quanto tenho para receber?",
  "Quais clientes devo contatar?",
];

export default function ImobfyAIChat({ user }: Props) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); void ask(question);
  }

  function toggleVoice() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setError("Seu navegador não oferece reconhecimento de voz. Use Chrome ou Edge."); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    setError("");
    const recognition = new Recognition();
    recognition.lang = "pt-BR"; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event) => { const transcript = event.results[0]?.[0]?.transcript?.trim() || ""; if (transcript) void ask(transcript); };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setError("Não consegui ouvir sua voz. Verifique a permissão do microfone."); };
    recognitionRef.current = recognition; setListening(true); recognition.start();
  }

  function speak(text: string, index: number) {
    if (!("speechSynthesis" in window)) { setError("Seu navegador não oferece leitura de voz."); return; }
    if (speaking === index) { window.speechSynthesis.cancel(); setSpeaking(null); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR"; utterance.rate = 1.02; utterance.onend = () => setSpeaking(null);
    setSpeaking(index); window.speechSynthesis.speak(utterance);
  }

  useEffect(() => () => { recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); }, []);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (prompt) void ask(prompt);
    };
    window.addEventListener("imobfy-ai-open", handleOpen);
    return () => window.removeEventListener("imobfy-ai-open", handleOpen);
  }, [conversationId, loading]);

  const firstName = user.name.split(" ")[0];

  return (
    <div className={`imobfy-intelligence ${messages.length ? "has-conversation" : ""}`}>
      <div className="imobfy-intelligence-top">
        <div className="imobfy-intelligence-brand">
          <div className="imobfy-intelligence-mark"><Sparkles size={14} /></div>
          <div><span>IMOBFY</span><strong>INTELLIGENCE</strong></div>
        </div>
        <div className="imobfy-intelligence-live"><i /> SISTEMA ONLINE</div>
      </div>

      {!messages.length ? (
        <main className="imobfy-intelligence-stage">
          <div className="imobfy-intelligence-grid" aria-hidden="true" />
          <div className="imobfy-intelligence-signal">
            <span className="signal-ring ring-a" /><span className="signal-ring ring-b" /><span className="signal-ring ring-c" />
            <div className={`signal-core ${listening ? "is-listening" : ""}`}>
              <div className="signal-core-inner"><Sparkles size={28} /></div>
            </div>
            <span className="signal-orbit orbit-a" /><span className="signal-orbit orbit-b" />
          </div>

          <div className="imobfy-intelligence-copy">
            <span className="imobfy-intelligence-kicker">CENTRAL DE INTELIGÊNCIA COMERCIAL</span>
            <h1>Fale. <em>Eu cuido do resto.</em></h1>
            <p>Seu pipeline, seus clientes, seu VGV e suas comissões em uma conversa.</p>
            <button type="button" className={`imobfy-intelligence-listen ${listening ? "is-listening" : ""}`} onClick={toggleVoice}>
              {listening ? <MicOff size={19} /> : <Mic size={19} />}
              <span>{listening ? "Estou ouvindo..." : "Falar com o IMOBFY"}</span>
              <small>{listening ? "Diga o que precisa" : "Toque para comandar por voz"}</small>
            </button>
          </div>

          <div className="imobfy-intelligence-commands">
            <span>OU COMANDE POR TEXTO</span>
            <div>{commands.map((command) => (
              <button key={command} type="button" onClick={() => void ask(command)}>
                {command}<span>↗</span>
              </button>
            ))}</div>
          </div>
        </main>
      ) : (
        <main className="imobfy-intelligence-conversation">
          <div className="conversation-header">
            <div><span>CONVERSA ATIVA</span><strong>Estou com você, {firstName}.</strong></div>
            <button type="button" onClick={() => setMessages([])} aria-label="Nova conversa"><X size={16} /></button>
          </div>
          <div className="conversation-feed">
            {messages.map((message, index) => (
              <article className={`intelligence-message ${message.role}`} key={`${message.role}-${index}`}>
                <span>{message.role === "assistant" ? "IMOBFY AI" : "VOCÊ"}</span>
                <p>{message.text}</p>
                {message.role === "assistant" && (
                  <button type="button" onClick={() => speak(message.text, index)} className="message-speak">
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
