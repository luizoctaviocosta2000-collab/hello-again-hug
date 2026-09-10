import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRing, CalendarClock, CircleDollarSign, Clock3, MessageCircle, Target } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { ImobfyUser } from "../lib/imobfy-session";

type Props = { user: ImobfyUser };
type Insight = { kind: "urgent" | "warning" | "opportunity" | "finance"; title: string; text: string; prompt: string };

type Deal = { id: string; title: string | null; stage: string | null; client_id: string | null; updated_at: string | null; sale_value: number | null; operation_value: number | null };
type Client = { id: string; name: string; phone: string | null; status: string | null };
type Visit = { id: string; client_id: string | null; deal_id: string | null; starts_at: string; status: string | null };
type Proposal = { id: string; deal_id: string; property_id: string; amount: number; status: string; proposed_at: string };
type Commission = { user_amount: number | null; status: string | null; due_date: string | null; due_at: string | null };

const closedStages = new Set(["fechado_ganho", "fechado", "closed", "won"]);
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const daysSince = (value: string | null) => value ? Math.floor((Date.now() - new Date(value).getTime()) / 86400000) : 999;

export default function ImobfyAIProactive({ user }: Props) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const [d, c, v, p, cm] = await Promise.all([
        supabase.from("deals").select("id,title,stage,client_id,updated_at,sale_value,operation_value").order("updated_at", { ascending: false }).limit(200),
        supabase.from("clients").select("id,name,phone,status").order("created_at", { ascending: false }).limit(200),
        supabase.from("visits").select("id,client_id,deal_id,starts_at,status").gte("starts_at", new Date().toISOString()).order("starts_at").limit(50),
        supabase.from("proposals").select("id,deal_id,property_id,amount,status,proposed_at").order("proposed_at", { ascending: false }).limit(100),
        supabase.from("commissions").select("user_amount,status,due_date,due_at").order("created_at", { ascending: false }).limit(100),
      ]);
      if (!active) return;
      if (d.error || c.error || v.error || p.error || cm.error) {
        setDeals([]); setClients([]); setVisits([]); setProposals([]); setCommissions([]);
      } else {
        setDeals((d.data || []) as Deal[]); setClients((c.data || []) as Client[]); setVisits((v.data || []) as Visit[]); setProposals((p.data || []) as Proposal[]); setCommissions((cm.data || []) as Commission[]);
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [user.id]);

  const insights = useMemo<Insight[]>(() => {
    const result: Insight[] = [];
    const now = Date.now();
    const stalled = deals.filter(d => !closedStages.has(String(d.stage || "").toLowerCase()) && daysSince(d.updated_at) >= 5).sort((a,b) => daysSince(b.updated_at) - daysSince(a.updated_at));
    const nextVisit = visits.find(v => new Date(v.starts_at).getTime() <= now + 48 * 3600000);
    const waitingProposals = proposals.filter(p => ["sent", "pending", "enviada", "pendente"].includes(String(p.status).toLowerCase()) && daysSince(p.proposed_at) >= 2);
    const receivable = commissions.filter(c => ["a_receber", "prevista", "pending", "receivable"].includes(String(c.status || "").toLowerCase()));
    const receivableTotal = receivable.reduce((sum, c) => sum + Number(c.user_amount || 0), 0);
    const clientName = (id: string | null) => clients.find(c => c.id === id)?.name || "cliente sem nome";

    if (stalled[0]) {
      const d = stalled[0];
      result.push({ kind: "urgent", title: `${clientName(d.client_id)} está esfriando`, text: `${daysSince(d.updated_at)} dias sem movimentação no negócio${d.title ? ` “${d.title}”` : ""}. Vale fazer um follow-up agora.`, prompt: `Analise o negócio de ${clientName(d.client_id)} e me diga a melhor próxima ação para recuperar esse cliente.` });
    }
    if (waitingProposals[0]) {
      const p = waitingProposals[0];
      result.push({ kind: "warning", title: "Proposta aguardando retorno", text: `${money(Number(p.amount || 0))} está sem resposta há ${daysSince(p.proposed_at)} dias.`, prompt: "Quais propostas estão aguardando retorno e qual follow-up devo fazer primeiro?" });
    }
    if (nextVisit) {
      result.push({ kind: "opportunity", title: "Você tem visita próxima", text: `Há uma visita agendada para ${new Date(nextVisit.starts_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}. Prepare o atendimento e os imóveis da jornada.`, prompt: `Prepare um checklist comercial para a próxima visita${nextVisit.client_id ? ` do cliente ${clientName(nextVisit.client_id)}` : ""}.` });
    }
    if (receivableTotal > 0) {
      result.push({ kind: "finance", title: `${money(receivableTotal)} para receber`, text: "Existem comissões previstas ou a receber. Posso detalhar origem, negócio e prioridade de cobrança.", prompt: "Detalhe minhas comissões a receber, por negócio, e diga quais devo acompanhar primeiro." });
    }
    if (!result.length && deals.length && clients.length) {
      result.push({ kind: "opportunity", title: "Operação sem alerta crítico", text: "Não encontrei negócios ou propostas claramente parados. Posso procurar oportunidades escondidas entre clientes e imóveis.", prompt: "Encontre oportunidades escondidas na minha carteira cruzando clientes, imóveis e negócios." });
    }
    return result.slice(0, 4);
  }, [clients, commissions, deals, proposals, visits]);

  function askAI(prompt: string) {
    window.dispatchEvent(new CustomEvent("imobfy-ai-open", { detail: { prompt } }));
  }

  const icon = (kind: Insight["kind"]) => kind === "urgent" ? Clock3 : kind === "warning" ? BellRing : kind === "finance" ? CircleDollarSign : Target;

  return (
    <section className="clean-card" style={{ marginBottom: 18 }}>
      <div className="card-title">
        <div><span className="label">IMOBFY INTELLIGENCE</span><h3>O que merece sua atenção agora</h3></div>
        <span className="ai-live"><MessageCircle size={13} /> IA proativa</span>
      </div>
      {loading ? <div className="empty"><span>Analisando sua operação...</span></div> : (
        <div style={{ display: "grid", gap: 10 }}>
          {insights.map((item, index) => { const Icon = icon(item.kind); return (
            <button key={`${item.title}-${index}`} type="button" onClick={() => askAI(item.prompt)} style={{ display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", width: "100%", textAlign: "left", padding: 13, border: "1px solid var(--border, #e7e2d8)", borderRadius: 14, background: "var(--surface, #fff)", cursor: "pointer" }}>
              <span style={{ width: 36, height: 36, borderRadius: 11, display: "grid", placeItems: "center", background: item.kind === "urgent" ? "#fff0ed" : item.kind === "finance" ? "#edf8f0" : "#f5f0e5" }}><Icon size={17} /></span>
              <span><strong style={{ display: "block", fontSize: 13 }}>{item.title}</strong><small style={{ display: "block", marginTop: 4, color: "#77756f", lineHeight: 1.45 }}>{item.text}</small></span>
              <ArrowRight size={15} />
            </button>
          ); })}
        </div>
      )}
    </section>
  );
}
