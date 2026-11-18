import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight, BarChart3, Bot, CheckCheck, Clipboard, Headset,
  Handshake, RefreshCw, ShieldCheck, WalletCards,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { readableFunctionError } from "../lib/function-error";
import type { AgentReport, SpecialistKind } from "../../supabase/functions/_shared/specialist-agents";
import "../imobfy-agents.css";

const agents = [
  { id:"ads", name:"Especialista em Ads", subtitle:"Campanhas e qualidade dos leads", icon:BarChart3, page:"/ads",
    goal:"Encontrar desperdício e oportunidades com base em gastos e leads realmente vinculados.",
    limitation:"Os dados da Meta só serão automáticos após conectar a API oficial." },
  { id:"atendimento", name:"Especialista em Atendimento", subtitle:"Relacionamento e objeções", icon:Headset, page:"/atendimento",
    goal:"Priorizar atendimentos, rascunhos e transferência para você quando necessário.",
    limitation:"As conversas são internas; WhatsApp e Instagram ainda exigem integração autorizada." },
  { id:"comercial", name:"Especialista Comercial", subtitle:"Pipeline, visitas e retomadas", icon:Handshake, page:"/negocios",
    goal:"Identificar negócios esquecidos e próximos passos para aumentar conversões.",
    limitation:"Não confirma visitas, valores ou propostas em nome de ninguém." },
  { id:"financeiro", name:"Especialista Financeiro", subtitle:"VGV, comissões e recebimentos", icon:WalletCards, page:"/comissoes",
    goal:"Organizar o acompanhamento dos recebimentos e destacar pendências na carteira.",
    limitation:"Não faz lançamentos financeiros; totais oficiais devem ser conferidos no módulo Financeiro." },
] as const;

const priorities: Record<string,string> = { alta:"Prioridade alta", media:"Para avaliar" };

export default function ImobfyAgentCenter() {
  const [selected,setSelected] = useState<SpecialistKind>("ads");
  const [reports,setReports] = useState<Partial<Record<SpecialistKind,AgentReport>>>({});
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const current = agents.find(a => a.id === selected)!;
  const report = reports[selected];

  async function analyze() {
    if(loading) return;
    setLoading(true);setError("");setNotice("");
    try {
      const { data, error:invokeError } = await supabase.functions.invoke<AgentReport>(
        "imobfy-specialist-agents",
        { body: { agent:selected } },
      );
      if(invokeError) throw invokeError;
      if(!data || data.agent !== selected || !Array.isArray(data.metrics) ||
         !Array.isArray(data.recommendations) || !Array.isArray(data.sources) ||
         !["regras","gemini"].includes(data.mode)) {
        throw new Error("O agente não retornou uma análise válida.");
      }
      setReports(previous => ({...previous,[selected]:data}));
    } catch(cause) {
      setError(await readableFunctionError(cause));
    } finally {setLoading(false);}
  }

  async function copyPlan() {
    if(!report) return;
    const text = [
      "IMOBFY — "+current.name,
      "Gerado em: "+new Date(report.generatedAt).toLocaleString("pt-BR"),
      ...report.metrics.map(m => m.label+": "+m.value),
      ...report.recommendations.map(r => r.title+" — "+r.reason),
      report.briefing || "",
      report.notice,
    ].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text);setNotice("Análise copiada para sua revisão."); }
    catch {setError("Não consegui copiar. Selecione o texto manualmente.");}
  }

  return <div className="imobfy-agents-page">
    <div className="agent-hero">
      <div><span className="agent-overline"><Bot size={17}/> CENTRAL DE ESPECIALISTAS</span>
        <h2>Seu time de inteligência<span>.</span></h2>
        <p>Quatro áreas, quatro análises especializadas. O que vem do banco é separado do que é sugestão da IA — você continua no comando.</p>
      </div>
      <div className="agent-readonly"><ShieldCheck size={18}/> Modo consultivo · Sem ações automáticas</div>
    </div>
    <div className="agent-grid" aria-label="Selecione um agente especialista">
      {agents.map(a => {
        const Icon = a.icon;
        return <button type="button" key={a.id} aria-pressed={selected===a.id}
          className={selected===a.id?"agent-tile is-selected":"agent-tile"}
          onClick={()=>{setSelected(a.id);setError("");setNotice("");}}>
          <span className="agent-icon"><Icon size={22}/></span>
          <strong>{a.name}</strong>
          <small>{a.subtitle}</small>
          {reports[a.id]&&<span className="agent-checked"><CheckCheck size={14}/> Analisado nesta sessão</span>}
        </button>;
      })}
    </div>
    <div className="agent-content">
      <section className="agent-detail">
        <div className="agent-detail-head">
          <div><span className="agent-overline">SEU ESPECIALISTA</span><h3>{current.name}</h3><p>{current.goal}</p></div>
          <button type="button" onClick={()=>void analyze()} disabled={loading} className="agent-run">
            <RefreshCw size={16} className={loading?"agent-spin":""}/>
            {loading?"Analisando dados...":report?"Atualizar análise":"Analisar meus dados"}
          </button>
        </div>
        <div className="agent-context"><ShieldCheck size={17}/><span>{current.limitation} Não existe permissão para enviar mensagens, gastar verba nem modificar seus registros.</span></div>
        {error&&<p className="agent-error" role="alert">{error}
          <span> Se o recurso não estiver implantado no Supabase, será necessário liberá-lo primeiro no ambiente correto.</span></p>}
        {notice&&<p className="agent-success" role="status">{notice}</p>}
        {!report&&!loading&&<div className="agent-empty"><Bot size={34}/><strong>Pronto para estudar sua operação.</strong><p>O agente só usa dados que estão registrados no IMOBFY. Clique em analisar para receber um diagnóstico, sem mexer em nada.</p></div>}
        {report&&<div className="agent-result" aria-live="polite">
          <div className="agent-results-title"><div><span className="agent-overline">RELATÓRIO DO AGENTE</span><strong>{report.mode==="gemini"?"IA + indicadores verificados":"Análise por regras verificáveis"}</strong>
            <small>Atualizado em {new Date(report.generatedAt).toLocaleString("pt-BR")}</small></div>
            <button type="button" onClick={()=>void copyPlan()} className="agent-copy"><Clipboard size={15}/> Copiar análise</button>
          </div>
          {report.coverage==="amostra"&&<p className="agent-warning">A base atingiu o limite de registros. Os indicadores abaixo podem estar incompletos.</p>}
          {report.coverage==="sem_dados"&&<p className="agent-warning">Ainda não há informações suficientes nessa área para medir desempenho. Nenhum resultado foi inventado.</p>}
          <div className="agent-metrics">{report.metrics.map(metric=><article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></article>)}</div>
          {report.briefing&&<div className="agent-brief"><span className="agent-overline"><Bot size={14}/> LEITURA ESTRATÉGICA DA IA</span><p>{report.briefing}</p><small>Opinião consultiva da IA; revise antes de agir.</small></div>}
          <h4>Recomendações para sua aprovação</h4>
          <div className="agent-recs">{report.recommendations.map((recommendation,index)=><article key={index}><span className="agent-priority">{priorities[recommendation.priority]||"Para avaliar"}</span><strong>{recommendation.title}</strong><p>{recommendation.reason}</p><small>Requer decisão humana · Nenhuma ação executada</small></article>)}</div>
          <p className="agent-provenance">Fontes: {report.sources.join(" · ")}. {report.notice}</p>
        </div>}
        <Link className="agent-domain-link" to={current.page}><ArrowRight size={16}/> Abrir módulo {current.name}</Link>
      </section>
      <aside className="agent-coordinator">
        <span className="agent-overline"><Bot size={15}/> COORDENAÇÃO</span>
        <h3>Uma operação conectada.</h3>
        <p>Os especialistas analisam as partes da mesma operação. Os próximos passos são revisados por você — não existe uma IA controlando os outros agentes ou os seus anúncios.</p>
        <div className="agent-flow">
          <span>Ads <ArrowRight size={14}/> Origem dos leads</span>
          <span>Atendimento <ArrowRight size={14}/> Qualificação</span>
          <span>Comercial <ArrowRight size={14}/> Visita e venda</span>
          <span>Financeiro <ArrowRight size={14}/> Recebimentos</span>
        </div>
        <small>WhatsApp, Instagram, Meta Ads Insights e CAPI ainda dependem de conexão oficial, permissões e homologação. Esta versão não sincroniza esses canais.</small>
      </aside>
    </div>
  </div>;
}
