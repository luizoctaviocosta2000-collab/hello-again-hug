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
    return () => window.removeEventListener("imobfy-ai-open", handleOpen);
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  return (
    <div className="ai-page">
      <section className="ai-hero">
        <div>
          <span className="label">IMOBFY INTELLIGENCE</span>
          <h1>Seu assistente comercial.</h1>
          <p>Converse com uma IA que consulta clientes, imóveis, negócios, agenda, propostas, visitas, vendas, comissões e VGV da sua operação.</p>
          <small className="muted">Conectado à conta de {user.name}. Histórico da conversa salvo com segurança.</small>
        </div>
        <div className="ai-orb"><Sparkles size={25} /></div>
      </section>

      <section className="clean-card ai-chat-card ai-real-chat">
        <div className="card-title">
          <div>
            <span className="label">ASSISTENTE</span>
            <h3>Pergunte ao Imobfy</h3>
          </div>
          <span className="ai-live"><Bot size={13} /> IA conectada</span>
        </div>

        {!messages.length && (
          <div className="ai-empty">
            <Bot size={26} />
            <strong>O que você quer descobrir?</strong>
            <p>Faça uma pergunta sobre sua operação. A IA usa os dados protegidos da sua conta.</p>
            <div className="ai-suggestions">
              {suggestions.map((item) => (
                <button key={item} type="button" onClick={() => void ask(item)}>{item}</button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="ai-messages">
            {messages.map((message, index) => (
              <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}>
                <div className="ai-message-meta">
                  <span>{message.role === "assistant" ? "IMOBFY AI" : "VOCÊ"}</span>
                  {message.role === "assistant" && (
                    <button type="button" className="ai-voice-action" onClick={() => speak(message.text, index)} aria-label={speaking === index ? "Parar leitura" : "Ouvir resposta"}>
                      {speaking === index ? <VolumeX size={13} /> : <Volume2 size={13} />}
                    </button>
                  )}
                </div>
                <p>{message.text}</p>
              </div>
            ))}
            {loading && (
              <div className="ai-message assistant">
                <span>IMOBFY AI</span>
                <p><Loader2 className="spin" size={16} /> Analisando seus dados...</p>
              </div>
            )}
          </div>
        )}

        {error && <div className="notice"><strong>IA:</strong> {error}</div>}

        <form className={`ai-input ${listening ? "is-listening" : ""}`} onSubmit={submit}>
          <button className={`ai-mic-button ${listening ? "listening" : ""}`} type="button" onClick={toggleVoice} disabled={loading} aria-label={listening ? "Parar gravação" : "Falar com o Imobfy"} title={listening ? "Parar de ouvir" : "Falar com o Imobfy"}>
            {listening ? <MicOff size={17} /> : <Mic size={17} />}
          </button>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={listening ? "Estou ouvindo..." : "Digite ou fale com o Imobfy..."}
            disabled={loading}
          />
          <button className="clean-button primary" type="submit" disabled={loading || !question.trim()}>
            <Send size={16} /> Perguntar
          </button>
        </form>
      </section>
    </div>
  );
}
