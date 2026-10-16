import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronRight, Home, Loader2, Plus, Send, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-fixes.css";

type Client = { id: string; name: string; phone: string | null };
type Property = { id: string; title: string; neighborhood: string | null; city: string | null; sale_value: number | null; status: string };
type Deal = { id: string; client_id: string | null; title: string; stage: string; operation_value: number; expected_close_at: string | null; notes: string | null };
type DealProperty = { id: string; deal_id: string; property_id: string; visit_status: string; visited_at: string | null; proposal_made: boolean; sold: boolean };
type Proposal = { id: string; deal_id: string; property_id: string; amount: number; status: string; financing: boolean; down_payment: number | null; proposed_at: string };
type Visit = { id: string; deal_id: string; starts_at: string; ends_at: string | null; status: string; location: string | null };

const stages = [["novo", "Novo"], ["contato", "Contato"], ["visita", "Visita"], ["proposta", "Proposta"], ["negociacao", "Negociação"], ["fechado_ganho", "Fechado"]] as const;
const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const validProposal = (status: string) => ["accepted", "aceita", "accepted_final"].includes(status);

export default function ImobfyNegociosCore({ user }: { user: ImobfyUser }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selected, setSelected] = useState<Deal | null>(null);
  const [dealProperties, setDealProperties] = useState<DealProperty[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"new" | "visit" | "proposal" | "sale" | null>(null);
  const [newClient, setNewClient] = useState("");
  const [newTitle, setNewTitle] = useState("Novo atendimento");
  const [visitIds, setVisitIds] = useState<string[]>([]);
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("10:00");
  const [proposalProperty, setProposalProperty] = useState("");
  const [proposalAmount, setProposalAmount] = useState("");
  const [saleProperty, setSaleProperty] = useState("");
  const [saleAmount, setSaleAmount] = useState("");

  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const propertyMap = useMemo(() => new Map(properties.map((property) => [property.id, property])), [properties]);
  const visitedProperties = useMemo(() => dealProperties.filter((item) => item.visit_status === "visited" || item.proposal_made || item.sold), [dealProperties]);
  const proposedProperties = useMemo(() => proposals.filter((proposal) => validProposal(proposal.status)), [proposals]);

  async function load() {
    setLoading(true);
    try {
      const [dealResult, clientResult, propertyResult] = await Promise.all([
        supabase.from("deals").select("id,client_id,title,stage,operation_value,expected_close_at,notes").eq("user_id", user.id).order("updated_at", { ascending: false }),
        supabase.from("clients").select("id,name,phone").eq("user_id", user.id).order("name"),
        supabase.from("properties").select("id,title,neighborhood,city,sale_value,status").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (dealResult.error || clientResult.error || propertyResult.error) setNotice("Não consegui carregar todos os dados do pipeline.");
      setDeals((dealResult.data ?? []) as Deal[]);
      setClients((clientResult.data ?? []) as Client[]);
      setProperties((propertyResult.data ?? []) as Property[]);
    } catch {
      setNotice("Ocorreu um erro inesperado ao carregar o pipeline. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function loadJourney(deal: Deal) {
    setSelected(deal);
    setNotice("");
    const [dp, pr, vi] = await Promise.all([
      supabase.from("deal_properties").select("id,deal_id,property_id,visit_status,visited_at,proposal_made,sold").eq("user_id", user.id).eq("deal_id", deal.id),
      supabase.from("proposals").select("id,deal_id,property_id,amount,status,financing,down_payment,proposed_at").eq("user_id", user.id).eq("deal_id", deal.id).order("proposed_at", { ascending: false }),
      supabase.from("visits").select("id,deal_id,starts_at,ends_at,status,location").eq("user_id", user.id).eq("deal_id", deal.id).order("starts_at", { ascending: false }),
    ]);
    if (dp.error || pr.error || vi.error) setNotice("Não consegui carregar toda a jornada deste negócio.");
    setDealProperties((dp.data ?? []) as DealProperty[]);
    setProposals((pr.data ?? []) as Proposal[]);
    setVisits((vi.data ?? []) as Visit[]);
  }

  useEffect(() => { void load(); }, [user.id]);

  async function createDeal() {
    if (!newClient || !newTitle.trim()) { setNotice("Selecione um cliente e informe o atendimento."); return; }
    setBusy(true);
    const { data, error } = await supabase.from("deals").insert({ user_id: user.id, client_id: newClient, title: newTitle.trim(), stage: "novo", operation_value: 0 }).select("id,client_id,title,stage,operation_value,expected_close_at,notes").single();
    if (error) setNotice(error.message);
    else { setModal(null); setNewClient(""); setNewTitle("Novo atendimento"); await load(); if (data) await loadJourney(data as Deal); }
    setBusy(false);
  }

  async function scheduleVisit() {
    if (!selected || !visitDate || !visitIds.length) { setNotice("Selecione a data e pelo menos um imóvel."); return; }
    setBusy(true);
    const rows = visitIds.map((propertyId) => ({ user_id: user.id, deal_id: selected.id, property_id: propertyId, visit_status: "scheduled" }));
    const { error: linkError } = await supabase.from("deal_properties").upsert(rows, { onConflict: "deal_id,property_id" });
    if (linkError) { setNotice(linkError.message); setBusy(false); return; }
    const starts = new Date(`${visitDate}T${visitTime}:00`);
    const { data: visit, error } = await supabase.from("visits").insert({ user_id: user.id, deal_id: selected.id, client_id: selected.client_id, starts_at: starts.toISOString(), ends_at: new Date(starts.getTime() + 3600000).toISOString(), status: "scheduled" }).select("id").single();
    if (error) setNotice(error.message);
    else {
      const { error: visitLinkError } = await supabase.from("visit_properties").insert(visitIds.map((propertyId, index) => ({ user_id: user.id, visit_id: visit.id, property_id: propertyId, sequence: index + 1, visited: false, notes: null })));
      if (visitLinkError) setNotice(visitLinkError.message);
      else { setModal(null); setVisitIds([]); setVisitDate(""); await loadJourney(selected); }
    }
    setBusy(false);
  }

  async function createProposal() {
    const amount = Number(proposalAmount);
    if (!selected || !proposalProperty || amount <= 0) { setNotice("Selecione um imóvel visitado e informe o valor da proposta."); return; }
    if (!visitedProperties.some((item) => item.property_id === proposalProperty)) { setNotice("Uma proposta só pode ser registrada para um imóvel visitado."); return; }
    setBusy(true);
    const { error } = await supabase.from("proposals").insert({ user_id: user.id, deal_id: selected.id, property_id: proposalProperty, amount, status: "sent", financing: false });
    if (error) setNotice(error.message);
    else { await supabase.from("deal_properties").update({ proposal_made: true, visit_status: "visited", visited_at: new Date().toISOString() }).eq("user_id", user.id).eq("deal_id", selected.id).eq("property_id", proposalProperty); setModal(null); setProposalProperty(""); setProposalAmount(""); await loadJourney(selected); }
    setBusy(false);
  }

  async function acceptProposal(proposalId: string) {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase
      .from("proposals")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", proposalId)
      .eq("deal_id", selected.id)
      .eq("user_id", user.id);
    if (error) setNotice(error.message);
    else {
      setNotice("Proposta aceita. Agora ela pode ser vinculada ao fechamento.");
      await loadJourney(selected);
    }
    setBusy(false);
  }

  async function closeSale() {
    const amount = Number(saleAmount);
    const proposal = proposedProperties.find((item) => item.property_id === saleProperty);
    if (!selected || !proposal || amount <= 0) { setNotice("Selecione uma proposta válida e informe o valor final da venda."); return; }
    setBusy(true);
    const { error } = await supabase.from("sales").insert({ user_id: user.id, deal_id: selected.id, property_id: saleProperty, proposal_id: proposal.id, sale_value: amount });
    if (error) setNotice(error.message);
    else { setModal(null); setSaleProperty(""); setSaleAmount(""); await load(); await loadJourney(selected); setNotice("Venda registrada. O banco sincronizará fechamento, VGV e comissão."); }
    setBusy(false);
  }

  async function moveStage(stage: string) {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase.from("deals").update({ stage }).eq("user_id", user.id).eq("id", selected.id);
    if (error) setNotice(error.message);
    else { const next = { ...selected, stage }; setSelected(next); setDeals((items) => items.map((item) => item.id === next.id ? next : item)); }
    setBusy(false);
  }

  if (loading) return <div className="empty"><Loader2 className="spin"/> Carregando pipeline...</div>;

  return (
    <div className="negocios-core">
      <div className="module-actions"><div><span className="label">PIPELINE COMERCIAL</span><h2>Do lead ao fechamento</h2><p className="muted">Cliente, imóveis visitados, propostas e venda no mesmo histórico.</p></div><button className="clean-button primary" onClick={() => setModal("new")}><Plus size={16}/> Novo negócio</button></div>
      {notice && <div className="notice"><strong>Imobfy:</strong> {notice}</div>}
      <div className="pipeline-grid">{stages.map(([key, label]) => <section className="pipeline-column" key={key}><div className="pipeline-column-head"><strong>{label}</strong><span>{deals.filter((deal) => deal.stage === key).length}</span></div>{deals.filter((deal) => deal.stage === key).map((deal) => <button key={deal.id} className={`pipeline-card ${selected?.id === deal.id ? "selected" : ""}`} onClick={() => void loadJourney(deal)}><strong>{clientMap.get(deal.client_id ?? "")?.name ?? deal.title}</strong><span>{deal.title}</span>{deal.operation_value > 0 && <small>{money(deal.operation_value)}</small>}<ChevronRight size={15}/></button>)}{!deals.some((deal) => deal.stage === key) && <div className="pipeline-empty">Sem negócios</div>}</section>)}</div>
      {selected && <div className="journey-panel"><div className="journey-header"><div><span className="label">JORNADA DO LEAD</span><h3>{clientMap.get(selected.client_id ?? "")?.name ?? selected.title}</h3><p>{selected.title} · {selected.client_id ? clientMap.get(selected.client_id)?.phone ?? "sem telefone" : "sem cliente"}</p></div><button className="icon-button" onClick={() => setSelected(null)}><X size={18}/></button></div>
        <div className="journey-actions"><button className="clean-button secondary" onClick={() => setModal("visit")}><CalendarDays size={15}/> Agendar visita</button><button className="clean-button secondary" onClick={() => visitedProperties.length ? setModal("proposal") : setNotice("Registre uma visita antes de criar uma proposta.")}><Send size={15}/> Registrar proposta</button><button className="clean-button primary" onClick={() => proposedProperties.length ? setModal("sale") : setNotice("Registre uma proposta antes de fechar a venda.")}><Check size={15}/> Fechar venda</button></div>
        <div className="journey-stage">{stages.map(([key, label]) => <button key={key} className={selected.stage === key ? "current" : ""} onClick={() => void moveStage(key)}>{label}</button>)}</div>
        <div className="journey-sections"><article className="clean-card"><div className="card-title"><div><span className="label">IMÓVEIS DA JORNADA</span><h3>{dealProperties.length} imóveis</h3></div><Home size={17}/></div>{dealProperties.length ? dealProperties.map((item) => { const property = propertyMap.get(item.property_id); return <div className="journey-row" key={item.id}><div><strong>{property?.title ?? "Imóvel"}</strong><small>{property?.neighborhood ?? ""}{property?.sale_value ? ` · ${money(property.sale_value)}` : ""}</small></div><em>{item.sold ? "Vendido" : item.proposal_made ? "Com proposta" : item.visit_status === "visited" ? "Visitado" : "Agendado"}</em></div>; }) : <div className="empty"><span>Nenhum imóvel vinculado.</span></div>}</article>
          <article className="clean-card"><div className="card-title"><div><span className="label">PROPOSTAS</span><h3>{proposals.length} propostas</h3></div><Send size={17}/></div>{proposals.length ? proposals.map((proposal) => <div className="journey-row" key={proposal.id}><div><strong>{propertyMap.get(proposal.property_id)?.title ?? "Imóvel"}</strong><small>{money(proposal.amount)} · {new Date(proposal.proposed_at).toLocaleDateString("pt-BR")}</small></div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><em>{proposal.status}</em>{["sent", "enviada", "pending"].includes(proposal.status) && <button className="clean-button secondary" disabled={busy} onClick={() => void acceptProposal(proposal.id)}>Aceitar proposta</button>}</div></div>) : <div className="empty"><span>As propostas aparecerão aqui.</span></div>}</article>
          <article className="clean-card"><div className="card-title"><div><span className="label">VISITAS</span><h3>{visits.length} visitas</h3></div><CalendarDays size={17}/></div>{visits.length ? visits.map((visit) => <div className="journey-row" key={visit.id}><div><strong>{new Date(visit.starts_at).toLocaleString("pt-BR")}</strong><small>{visit.location ?? "Visita imobiliária"}</small></div><em>{visit.status}</em></div>) : <div className="empty"><span>Nenhuma visita registrada.</span></div>}</article></div>
      </div>}

      {modal && <div className="mvp-overlay"><div className="mvp-modal"><button className="mvp-close" onClick={() => setModal(null)}><X size={18}/></button>{modal === "new" && <><span className="label">NOVO NEGÓCIO</span><h2>Criar atendimento</h2><label>Cliente<select value={newClient} onChange={(e) => setNewClient(e.target.value)}><option value="">Selecione o cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Nome do atendimento<input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex.: Compra do primeiro imóvel"/></label><div className="mvp-actions"><button className="clean-button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="clean-button primary" disabled={busy} onClick={() => void createDeal()}>{busy ? "Salvando..." : "Criar negócio"}</button></div></>}
        {modal === "visit" && <><span className="label">NOVA VISITA</span><h2>Agendar visita</h2><div className="form-grid"><label>Data<input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)}/></label><label>Hora<input type="time" value={visitTime} onChange={(e) => setVisitTime(e.target.value)}/></label></div><label>Imóveis da visita<div style={{ display: "grid", gap: 7, maxHeight: 190, overflowY: "auto" }}>{properties.filter((property) => !["sold", "vendido"].includes(property.status)).map((property) => <button key={property.id} type="button" onClick={() => setVisitIds((ids) => ids.includes(property.id) ? ids.filter((id) => id !== property.id) : [...ids, property.id])} style={{ textAlign: "left", padding: "10px 12px", border: "1px solid var(--border,#e7e2d8)", borderRadius: 10, background: visitIds.includes(property.id) ? "#f5f0e5" : "#fff" }}><strong>{visitIds.includes(property.id) ? "✓ " : ""}{property.title}</strong><small style={{ display: "block" }}>{property.neighborhood ?? ""}</small></button>)}</div></label><div className="mvp-actions"><button className="clean-button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="clean-button primary" disabled={busy} onClick={() => void scheduleVisit()}>{busy ? "Agendando..." : "Agendar visita"}</button></div></>}
        {modal === "proposal" && <><span className="label">NOVA PROPOSTA</span><h2>Registrar proposta</h2><label>Imóvel visitado<select value={proposalProperty} onChange={(e) => { const id = e.target.value; setProposalProperty(id); const property = propertyMap.get(id); if (property?.sale_value) setProposalAmount(String(property.sale_value)); }}><option value="">Selecione o imóvel</option>{visitedProperties.map((item) => <option key={item.property_id} value={item.property_id}>{propertyMap.get(item.property_id)?.title ?? "Imóvel"}</option>)}</select></label><label>Valor da proposta<input type="number" min="1" value={proposalAmount} onChange={(e) => setProposalAmount(e.target.value)} placeholder="0"/></label><div className="mvp-actions"><button className="clean-button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="clean-button primary" disabled={busy} onClick={() => void createProposal()}>{busy ? "Salvando..." : "Registrar proposta"}</button></div></>}
        {modal === "sale" && <><span className="label">FECHAMENTO</span><h2>Registrar venda</h2><label>Imóvel com proposta<select value={saleProperty} onChange={(e) => { const id = e.target.value; setSaleProperty(id); const proposal = proposedProperties.find((item) => item.property_id === id); if (proposal) setSaleAmount(String(proposal.amount)); }}><option value="">Selecione o imóvel</option>{proposedProperties.map((item) => <option key={item.property_id} value={item.property_id}>{propertyMap.get(item.property_id)?.title ?? "Imóvel"} · {money(item.amount)}</option>)}</select></label><label>Valor final da venda<input type="number" min="1" value={saleAmount} onChange={(e) => setSaleAmount(e.target.value)} placeholder="0"/></label><div className="mvp-actions"><button className="clean-button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="clean-button primary" disabled={busy} onClick={() => void closeSale()}>{busy ? "Fechando..." : "Registrar venda"}</button></div></>}
      </div></div>}
    </div>
  );
}
