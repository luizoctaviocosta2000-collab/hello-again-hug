import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowRight, BrainCircuit, Check, Clipboard, Home, PauseCircle, PlayCircle, RotateCcw, Send, ShieldCheck, UserRoundCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { readableFunctionError } from "../lib/function-error";
import { restoreSession } from "../lib/imobfy-session";
import type { AttendanceBrief, AttendanceTurn } from "../../supabase/functions/_shared/attendance-contract";
import "../imobfy-attendance.css";

type PropertyOption = {
  id: string; title: string; neighborhood: string | null; city: string | null;
  property_type: string | null; status: string | null; asking_price: number | null;
  sale_value: number | null;
};
type SimulationResult = {
  draft?: string;
  brief?: AttendanceBrief;
  error?: string;
  property_id?: string;
  mode?: "simulator_only";
};
type ConversationMessage = AttendanceTurn;

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const prompts = [
  "Esse apartamento ainda está disponível?",
  "Achei esse imóvel muito caro. Tem como negociar?",
  "Posso financiar? Como funciona a entrada?",
  "Tem como agendar uma visita no sábado?",
];

export default function ImobfyAttendanceSimulator() {
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [brief, setBrief] = useState<AttendanceBrief | null>(null);
  const [draft, setDraft] = useState("");
  const [input, setInput] = useState("");
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [sending, setSending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const property = useMemo(() => properties.find((item) => item.id === selectedId), [properties, selectedId]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const user = await restoreSession();
        if (!user) throw new Error("Sessão não encontrada. Entre novamente.");
        const { data, error: queryError } = await supabase
          .from("properties")
          .select("id,title,neighborhood,city,property_type,status,asking_price,sale_value")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (queryError) throw queryError;
        if (!active) return;
        const list = (data ?? []) as PropertyOption[];
        setProperties(list);
        setSelectedId(list[0]?.id ?? "");
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não consegui carregar seus imóveis.");
      } finally {
        if (active) setLoadingProperties(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  function clearConversation() {
    setMessages([]);
    setBrief(null);
    setDraft("");
    setInput("");
    setError("");
    setNotice("");
    setPaused(false);
  }

  async function ask(event?: FormEvent<HTMLFormElement>, prompt?: string) {
    event?.preventDefault();
    const text = (prompt ?? input).trim();
    if (!text || !selectedId || sending || paused) return;
    if (text.length > 1500) { setError("Envie no máximo 1.500 caracteres."); return; }
    const submittedId = selectedId;
    const history = messages.slice(-12);
    setSending(true); setError(""); setNotice("");
    try {
      const { data, error: functionError } = await supabase.functions.invoke<SimulationResult>("imobfy-attendance-simulate", {
        body: { property_id: submittedId, message: text, history },
        timeout: 45_000,
      });
      if (functionError) throw functionError;
      if (data?.mode !== "simulator_only" || data.property_id !== submittedId || !data.draft || !data.brief)
        throw new Error(data?.error || "O simulador não retornou um rascunho válido.");
      // Ao trocar o imóvel, o estado do chat é reiniciado; não misturar conversas.
      setMessages((prev) => [...prev, { role: "customer", text }, { role: "assistant", text: data.draft! }]);
      setDraft(data.draft);
      setBrief(data.brief);
      setInput("");
    } catch (cause) {
      setError(await readableFunctionError(cause));
    } finally { setSending(false); }
  }

  async function copyDraft() {
    if (!draft) return;
    try { await navigator.clipboard.writeText(draft); setNotice("Rascunho copiado para revisão. Nenhuma mensagem foi enviada."); }
    catch { setError("Não consegui copiar. Selecione o texto e copie manualmente."); }
  }

  return <div className="att-page">
    <section className="att-intro">
      <div>
        <div className="att-eyebrow"><BrainCircuit size={14} /> IMOBFY AI / ATENDIMENTO</div>
        <h2>Atendimento inteligente<span>.</span></h2>
        <p>Treine respostas comerciais com os imóveis da sua carteira, sem falar com clientes reais.</p>
      </div>
      <span className="att-stage"><ShieldCheck size={16} /> Simulador interno</span>
    </section>

    <div className="att-disclaimer" role="note"><ShieldCheck size={18} />
      <div><strong>Modo assistido, sem envios externos.</strong> Nenhuma mensagem vai ao WhatsApp ou Instagram. Os testes não são salvos no CRM, e nenhuma visita, proposta ou lead é criado automaticamente.</div>
    </div>

    <div className="att-layout">
      <aside className="att-side">
        <div className="att-panel">
          <div className="att-panel-heading"><Home size={17}/><h3>Imóvel em teste</h3></div>
          <label className="att-label" htmlFor="att-property">Escolha um imóvel cadastrado</label>
          <select id="att-property" value={selectedId} disabled={loadingProperties || sending || !properties.length} onChange={(event) => { setSelectedId(event.target.value); clearConversation(); }}>
            {properties.length === 0 && <option value="">{loadingProperties ? "Carregando..." : "Nenhum imóvel encontrado"}</option>}
            {properties.map((item) => <option value={item.id} key={item.id}>{item.title} — {item.neighborhood || item.city || "Sem bairro"}</option>)}
          </select>
          {property && <div className="att-property">
            <strong>{property.title}</strong>
            <span>{[property.property_type, property.neighborhood, property.city].filter(Boolean).join(" · ") || "Sem localização cadastrada"}</span>
            <b>{Number(property.asking_price) > 0 ? money(Number(property.asking_price)) : Number(property.sale_value) > 0 ? money(Number(property.sale_value)) : "Valor não cadastrado"}</b>
            <small>Status interno: {property.status || "não informado"}. Disponibilidade precisa de confirmação.</small>
          </div>}
          {!loadingProperties && !properties.length && !error && <p className="att-hint">Cadastre um imóvel em Imóveis para começar a simular.</p>}
        </div>

        <div className="att-panel">
          <div className="att-panel-heading"><UserRoundCheck size={17}/><h3>Leitura comercial</h3></div>
          {!brief ? <p className="att-hint">O resumo da IA aparecerá aqui depois da primeira resposta.</p> : <dl className="att-brief">
            <dt>Intenção</dt><dd>{brief.intent}</dd>
            <dt>Objeção</dt><dd>{brief.objection || "Não identificada"}</dd>
            <dt>Orçamento declarado</dt><dd>{brief.budget_brl ? money(brief.budget_brl) : "Não informado"}</dd>
            <dt>Bairro de preferência</dt><dd>{brief.preferred_neighborhood || "Não informado"}</dd>
            <dt>Próximo passo sugerido</dt><dd>{brief.next_step}</dd>
          </dl>}
          {brief?.handoff_required && <div className="att-handoff"><AlertTriangle size={17}/><div><strong>Encaminhar a um corretor</strong><p>{brief.handoff_reason || "Revisão humana recomendada."}</p></div></div>}
        </div>

        <div className="att-panel att-future">
          <span>PRÓXIMAS ETAPAS</span>
          <p><ArrowRight size={15}/> Caixa de entrada com histórico</p>
          <p><ArrowRight size={15}/> Conexão oficial WhatsApp e Instagram</p>
          <p><ArrowRight size={15}/> Qualificação e transferência no CRM</p>
          <small>Estas integrações ainda não estão ativas.</small>
        </div>
      </aside>

      <section className="att-panel att-chat">
        <header className="att-chat-head">
          <div><span className="att-small">LABORATÓRIO COMERCIAL</span><h3>Simular conversa com lead</h3><p>Você escreve como cliente. A IA devolve um rascunho para avaliação.</p></div>
          <button type="button" className="att-btn muted" onClick={clearConversation} disabled={sending} title="Limpar conversa"><RotateCcw size={15}/> Reiniciar</button>
        </header>
        <div className="att-thread" role="log" aria-live="polite" aria-label="Mensagens da simulação">
          {!messages.length && <div className="att-empty"><BrainCircuit size={30}/><h4>Vamos testar um atendimento?</h4><p>Selecione um imóvel e escolha uma pergunta comum dos interessados.</p><div className="att-examples">{prompts.map((prompt) => <button key={prompt} type="button" disabled={!selectedId || sending || paused} onClick={() => { void ask(undefined, prompt); }}>{prompt}<ArrowRight size={14}/></button>)}</div></div>}
          {messages.map((message, index) => <article key={index} className={message.role === "customer" ? "att-bubble customer" : "att-bubble assistant"}>
            <span>{message.role === "customer" ? "CLIENTE SIMULADO" : "RASCUNHO IMOBFY AI"}</span>
            <p>{message.text}</p>
          </article>)}
          {sending && <div className="att-processing" role="status">Analisando os dados do imóvel e preparando o rascunho...</div>}
        </div>
        {error && <div className="att-error" role="alert">{error}</div>}
        {notice && <div className="att-notice" role="status"><Check size={15}/>{notice}</div>}
        {draft && <div className="att-review"><div><strong>Último rascunho para revisão</strong><span>Nada foi enviado ao cliente.</span></div><button type="button" className="att-btn" onClick={() => void copyDraft()}><Clipboard size={15}/> Copiar resposta</button></div>}
        <form className="att-composer" onSubmit={(event) => void ask(event)}>
          <label className="att-label" htmlFor="att-message">Mensagem do cliente (simulação)</label>
          <textarea id="att-message" rows={3} value={input} maxLength={1500} onChange={(event) => setInput(event.target.value)} disabled={!selectedId || paused || sending} placeholder={paused ? "Simulador pausado" : "Ex.: Gostei do imóvel, mas achei o preço alto..."} />
          <div className="att-compose-actions"><button type="button" className="att-btn muted" onClick={() => setPaused((old) => !old)} disabled={sending} aria-pressed={paused}>{paused ? <PlayCircle size={16}/> : <PauseCircle size={16}/>} {paused ? "Retomar IA" : "Pausar IA"}</button>
            <button type="submit" className="att-btn primary" disabled={!selectedId || !input.trim() || paused || sending}><Send size={15}/>{sending ? "Analisando..." : "Gerar resposta"}</button></div>
        </form>
      </section>
    </div>
  </div>;
}
