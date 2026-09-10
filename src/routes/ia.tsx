import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import ImobfyAIChat from "../components/ImobfyAIChat";
import ImobfyAIProactive from "../components/ImobfyAIProactive";
import ImobfyAIPriorities from "../components/ImobfyAIPriorities";
import { supabase } from "../lib/supabase";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-fixes.css";

export const Route = createFileRoute("/ia")({ component: IARoute });

type Priority = { kind: string; score: number; title: string; reason: string; suggested_action: string; entity_id?: string };
type Deal = { id: string; stage: string | null; created_at: string; updated_at: string | null; expected_close_at: string | null; sale_value: number | null };
type Proposal = { id: string; deal_id: string; status: string | null; proposed_at: string };
type Visit = { id: string; deal_id: string | null; starts_at: string; status: string | null };
type Client = { id: string; updated_at: string | null; created_at: string };
type Commission = { id: string; status: string | null; user_amount: number | null };

const daysSince = (value: string | null) => value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000)) : 999;
const closed = new Set(["fechado_ganho", "fechado", "closed", "won"]);

function buildPriorities(deals: Deal[], proposals: Proposal[], visits: Visit[], clients: Client[], commissions: Commission[]): Priority[] {
  const result: Priority[] = [];
  for (const deal of deals) {
    if (closed.has(String(deal.stage || "").toLowerCase())) continue;
    const age = daysSince(deal.updated_at || deal.created_at);
    if (age >= 5) result.push({ kind: "stalled_deal", score: Math.min(98, 55 + age * 2 + (Number(deal.sale_value || 0) > 0 ? 10 : 0)), title: "Negócio parado", reason: `${age} dias sem movimentação em um negócio ativo.`, suggested_action: "Fazer follow-up e registrar a próxima ação.", entity_id: deal.id });
  }
  for (const proposal of proposals) {
    const status = String(proposal.status || "").toLowerCase();
    const age = daysSince(proposal.proposed_at);
    if (["sent", "pending", "enviada", "pendente"].includes(status) && age >= 2) result.push({ kind: "proposal_followup", score: Math.min(100, 78 + age), title: "Proposta sem retorno", reason: `Proposta aguardando resposta há ${age} dias.`, suggested_action: "Entrar em contato e atualizar o status.", entity_id: proposal.deal_id });
  }
  const now = Date.now();
  for (const visit of visits) {
    const starts = new Date(visit.starts_at).getTime();
    const hours = (starts - now) / 3600000;
    if (hours >= 0 && hours <= 48 && !["cancelled", "canceled", "cancelada", "concluida", "completed"].includes(String(visit.status || "").toLowerCase())) result.push({ kind: "upcoming_visit", score: Math.min(97, 70 + Math.max(0, 48 - hours)), title: "Visita nas próximas 48h", reason: "Existe uma visita próxima que merece preparação.", suggested_action: "Revisar os imóveis e confirmar o atendimento.", entity_id: visit.deal_id || visit.id });
  }
  for (const client of clients) {
    const age = daysSince(client.updated_at || client.created_at);
    if (age >= 7) result.push({ kind: "lead_followup", score: Math.min(92, 60 + age), title: "Cliente sem acompanhamento", reason: `${age} dias desde a última atualização do cadastro.`, suggested_action: "Retomar o contato e registrar a interação.", entity_id: client.id });
  }
  const pending = commissions.filter(c => ["a_receber", "receivable", "prevista", "pending", "partially_received"].includes(String(c.status || "").toLowerCase()));
  const firstPending = pending[0];
  if (firstPending) result.push({ kind: "commission", score: 58, title: "Comissões pendentes", reason: `${pending.length} comissão(ões) ainda não foram recebidas integralmente.`, suggested_action: "Acompanhar o recebimento e os respectivos negócios.", entity_id: firstPending.id });
  return result.sort((a, b) => b.score - a.score).slice(0, 8);
}

function IARoute() {
  const [user, setUser] = useState<ImobfyUser | null>(null);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [loadingPriorities, setLoadingPriorities] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { void restoreSession().then(setUser); }, []);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const load = async () => {
      setLoadingPriorities(true);
      const [d, p, v, c, cm] = await Promise.all([
        supabase.from("deals").select("id,stage,created_at,updated_at,expected_close_at,sale_value").order("updated_at", { ascending: false }).limit(200),
        supabase.from("proposals").select("id,deal_id,status,proposed_at").order("proposed_at", { ascending: false }).limit(200),
        supabase.from("visits").select("id,deal_id,starts_at,status").gte("starts_at", new Date().toISOString()).order("starts_at").limit(100),
        supabase.from("clients").select("id,updated_at,created_at").order("updated_at", { ascending: false }).limit(200),
        supabase.from("commissions").select("id,status,user_amount").limit(200),
      ]);
      if (!active) return;
      if (d.error || p.error || v.error || c.error || cm.error) setPriorities([]);
      else setPriorities(buildPriorities((d.data || []) as Deal[], (p.data || []) as Proposal[], (v.data || []) as Visit[], (c.data || []) as Client[], (cm.data || []) as Commission[]));
      setLoadingPriorities(false);
    };
    void load();
    return () => { active = false; };
  }, [user?.id]);

  const ask = (text: string) => window.dispatchEvent(new CustomEvent("imobfy-ai-open", { detail: { prompt: text } }));
  const priorityHint = useMemo(() => priorities.length ? `Tenho ${priorities.length} prioridades comerciais. Mostre a mais importante e a ação recomendada.` : "Faça uma análise geral da minha operação e procure oportunidades.", [priorities.length]);

  if (!user) return <div className="empty"><span>Carregando sessão...</span></div>;
  return (
    <div className="ai-page">
      <ImobfyAIPriorities priorities={priorities} loading={loadingPriorities} onAsk={ask} />
      <div style={{ marginBottom: 18 }}>
        <button type="button" className="btn btn-primary" onClick={() => ask(priorityHint)}>Perguntar à IA sobre minhas prioridades</button>
      </div>
      <ImobfyAIProactive user={user} />
      <ImobfyAIChat user={user} />
    </div>
  );
}
