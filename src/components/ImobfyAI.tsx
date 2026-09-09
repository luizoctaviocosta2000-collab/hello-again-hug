import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bot, CheckCircle2, CircleAlert, Clock3, Home, Sparkles, Target, Users } from "lucide-react";
import { loadRemoteRows, type DataRow } from "../lib/imobfy-data";
import type { ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-fixes.css";

type Props = { user: ImobfyUser };

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function ImobfyAI({ user }: Props) {
  const [properties, setProperties] = useState<DataRow[]>([]);
  const [clients, setClients] = useState<DataRow[]>([]);
  const [deals, setDeals] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([
      loadRemoteRows(user.id, "imoveis"),
      loadRemoteRows(user.id, "clientes"),
      loadRemoteRows(user.id, "negocios"),
    ]).then(([p, c, d]) => {
      if (!active) return;
      setProperties(p);
      setClients(c);
      setDeals(d);
    }).catch(() => {
      if (active) {
        setProperties([]);
        setClients([]);
        setDeals([]);
      }
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user.id]);

  const insights = useMemo(() => {
    const pipeline = deals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
    const closed = deals.filter((deal) => ["closed", "fechado", "ganho"].includes(deal.status.toLowerCase())).length;
    const stalled = deals.filter((deal) => ["new", "qualified", "proposal", "negotiation"].includes(deal.status.toLowerCase())).length;
    const opportunities = Math.min(clients.length, properties.length);
    return { pipeline, closed, stalled, opportunities };
  }, [clients, properties, deals]);

  const actions = useMemo(() => {
    const result: { icon: typeof CircleAlert; tone: string; title: string; text: string }[] = [];
    if (!clients.length) result.push({ icon: Users, tone: "neutral", title: "Cadastre seus primeiros clientes", text: "Com clientes no CRM, o Imobfy AI consegue começar a cruzar demanda e estoque." });
    if (!properties.length) result.push({ icon: Home, tone: "neutral", title: "Sua carteira ainda está vazia", text: "Cadastre imóveis para ativar o motor de oportunidades." });
    if (stalled > 0) result.push({ icon: Clock3, tone: "warning", title: `${stalled} negócio${stalled > 1 ? "s" : ""} merece${stalled > 1 ? "m" : ""} atenção`, text: "Existem negócios no pipeline que ainda não chegaram ao fechamento. Revise a próxima ação." });
    if (clients.length && properties.length) result.push({ icon: Target, tone: "gold", title: `${insights.opportunities} oportunidade${insights.opportunities > 1 ? "s" : ""} em potencial`, text: "Há clientes e imóveis suficientes para começar o cruzamento inteligente da sua operação." });
    if (!result.length) result.push({ icon: CheckCircle2, tone: "success", title: "Operação em ordem", text: "Não encontrei nenhum alerta básico. Continue movimentando clientes e negócios." });
    return result.slice(0, 4);
  }, [clients.length, properties.length, stalled, insights.opportunities]);

  return <div className="ai-page">
    <section className="ai-hero">
      <div>
        <span className="label">IMOBFY INTELLIGENCE</span>
        <h1>Seu assistente comercial.</h1>
        <p>O Imobfy AI lê os dados da sua operação e transforma cadastros em próximas ações.</p>
      </div>
      <div className="ai-orb"><Sparkles size={25}/></div>
    </section>

    <section className="ai-metrics">
      <article><span><Users size={15}/> Clientes</span><strong>{loading ? "—" : clients.length}</strong></article>
      <article><span><Home size={15}/> Imóveis</span><strong>{loading ? "—" : properties.length}</strong></article>
      <article><span><Target size={15}/> Pipeline</span><strong>{loading ? "—" : money(insights.pipeline)}</strong></article>
      <article><span><CheckCircle2 size={15}/> Fechados</span><strong>{loading ? "—" : insights.closed}</strong></article>
    </section>

    <div className="ai-grid">
      <article className="clean-card ai-main-card">
        <div className="card-title"><div><span className="label">ANÁLISE DA OPERAÇÃO</span><h3>O que merece sua atenção</h3></div><span className="ai-live"><Bot size={13}/> IA ativa</span></div>
        <div className="ai-actions">
          {actions.map((action) => { const Icon = action.icon; return <div className={`ai-action ${action.tone}`} key={action.title}><div className="ai-action-icon"><Icon size={17}/></div><div><strong>{action.title}</strong><p>{action.text}</p></div><ArrowRight size={15}/></div>; })}
        </div>
      </article>

      <article className="clean-card ai-chat-card">
        <span className="label">CONSULTA RÁPIDA</span>
        <h3>Pergunte ao Imobfy</h3>
        <p className="muted">A próxima camada será conversacional, usando seus dados reais.</p>
        <div className="ai-suggestions"><span>“Quais clientes devo contatar?”</span><span>“Onde está meu maior VGV?”</span><span>“Quais negócios estão parados?”</span></div>
        <div className="ai-coming"><Bot size={18}/><div><strong>Motor conversacional</strong><small>Preparado para a integração com o modelo de IA na próxima etapa.</small></div></div>
      </article>
    </div>
  </div>;
}
