import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Check, ChevronRight, Home, Loader2, Plus, Send, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { type ImobfyUser } from "../lib/imobfy-session";
import "../imobfy-fixes.css";

type Client = { id: string; name: string; phone: string | null };
type Property = { id: string; title: string; neighborhood: string | null; city: string | null; sale_value: number | null; status: string };
type Deal = { id: string; client_id: string | null; title: string; stage: string; operation_value: number; expected_close_at: string | null; notes: string | null };
type DealProperty = { id: string; deal_id: string; property_id: string; visit_status: string; visited_at: string | null; proposal_made: boolean; sold: boolean };
type Proposal = { id: string; deal_id: string; property_id: string; amount: number; status: string; financing: boolean; down_payment: number | null; proposed_at: string };
type Visit = { id: string; deal_id: string; starts_at: string; ends_at: string | null; status: string; location: string | null };
const stages = [["novo", "Novo"], ["contato", "Contato"], ["visita", "Visita"], ["proposta", "Proposta"], ["negociacao", "Negociação"], ["fechado_ganho", "Fechado"]] as const;
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ImobfyNegociosCore({ user }: { user: ImobfyUser }) {
  const [deals, setDeals] = useState<Deal[]>([]), [clients, setClients] = useState<Client[]>([]), [properties, setProperties] = useState<Property[]>([]);
  const [selected, setSelected] = useState<Deal | null>(null), [dealProperties, setDealProperties] = useState<DealProperty[]>([]), [proposals, setProposals] = useState<Proposal[]>([]), [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [showNew, setShowNew] = useState(false), [showVisit, setShowVisit] = useState(false), [showProposal, setShowProposal] = useState(false), [showClose, setShowClose] = useState(false);
  const [newClient, setNewClient] = useState(""), [newTitle, setNewTitle] = useState("Novo atendimento"), [visitIds, setVisitIds] = useState<string[]>([]), [visitDate, setVisitDate] = useState(""), [visitTime, setVisitTime] = useState("10:00"), [proposalProperty, setProposalProperty] = useState(""), [proposalAmount, setProposalAmount] = useState(""), [saleProperty, setSaleProperty] = useState(""), [saleAmount, setSaleAmount] = useState("");
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const propertyMap = useMemo(() => new Map(properties.map(p => [p.id, p])), [properties]);

  async function load() {
    setLoading(true);
    const [d, c, p] = await Promise.all([
      supabase.from("deals").select("id,client_id,title,stage,operation_value,expected_close_at,notes").order("updated_at", { ascending: false }),
      supabase.from("clients").select("id,name,phone").order("name"),
      supabase.from("properties").select("id,title,neighborhood,city,sale_value,status").order("created_at", { ascending: false }),
    ]);
    if (d.error || c.error || p.error) setNotice("Não consegui carregar todos os dados do pipeline.");
    setDeals((d.data || []) as Deal[]); setClients((c.data || []) as Client[]); setProperties((p.data || []) as Property[]); setLoading(false);
  }
  async function loadJourney(deal: Deal) {
    setSelected(deal); setNotice("");
    const [dp, pr, vi] = await Promise.all([
      supabase.from("deal_properties").select("id,deal_id,property_id,visit_status,visited_at,proposal_made,sold").eq("deal_id", deal.id),
      supabase.from("proposals").select("id,deal_id,property_id,amount,status,financing,down_payment,proposed_at").eq("deal_id", deal.id).order("proposed_at", { ascending: false }),
      supabase.from("visits").select("id,deal_id,starts_at,ends_at,status,location").eq("deal_id", deal.id).order("starts_at", { ascending: false }),
    ]);
    setDealProperties((dp.data || []) as DealProperty[]); setProposals((pr.data || []) as Proposal[]); setVisits((vi.data || []) as Visit[]);
  }
  useEffect(() => { void load(); }, [user.id]);
  async function createDeal() {
    if (!newTitle.trim() || !newClient) return; setBusy(true);
    const { data, error } = await supabase.from("deals").insert({ user_id: user.id, client_id: newClient, title: newTitle.trim(), stage: "novo" }).select("id,client_id,title,stage,operation_value,expected_close_at,notes").single();
    if (error) setNotice(error.message); else { setShowNew(false); setNewTitle("Novo atendimento"); setNewClient(""); await load(); if (data) await loadJourney(data as Deal); } setBusy(false);
  }
  async function addProperties(ids = visitIds) {
    if (!selected || !ids.length) return true; setBusy(true);
    const rows = ids.map(property_id => ({ user_id: user.id, deal_id: selected.id, property_id, visit_status: "scheduled" }));
    const { error } = await supabase.from("deal_properties").upsert(rows, { onConflict: "deal_id,property_id" });
    if (error) { setNotice(error.message); setBusy(false); return false; } setBusy(false); return true;
  }
  async function scheduleVisit() {
    if (!selected || !visitDate || !visitIds.length) { setNotice("Selecione a data e pelo menos um imóvel."); return; }
    setBusy(true);
    const linked = await addProperties(visitIds); if (!linked) { setBusy(false); return; }
    const starts_at = new Date(`${visitDate}T${visitTime}:00`).toISOString();
    const { data: visit, error } = await supabase.from("visits").insert({ user_id: user.id, deal_id: selected.id, client_id: selected.client_id, starts_at, status: "scheduled" }).select("id").single();
    if (error) setNotice(error.message); else {
      const visitPropertyRows = visitIds.map(property_id => ({ user_id: user.id, visit_id: visit.id, property_id }));
      const { error: linkError } = await supabase.from("visit_properties").insert(visitPropertyRows);
      if (linkError) setNotice(linkError.message); else { setShowVisit(false); setVisitIds([]); setVisitDate(""); await loadJourney(selected); }
    }
    setBusy(false);
  }
  async function createProposal() {
    if (!selected || !proposalProperty || !proposalAmount || Number(proposalAmount) <= 0) return;
    setBusy(true); const amount = Number(proposalAmount);
    const { error } = await supabase.from("proposals").insert({ user_id: user.id, deal_id: selected.id, property_id: proposalProperty, amount, status: "sent" });
    if (error) setNotice(error.message); else { await supabase.from("deal_properties").update({ proposal_made: true, visit_status: "visited", visited_at: new Date().toISOString() }).eq("deal_id", selected.id).eq("property_id", proposalProperty); setShowProposal(false); setProposalAmount(""); setProposalProperty(""); await loadJourney(selected); await load(); } setBusy(false);
  }
  async function closeSale() {
    if (!selected || !saleProperty || !saleAmount || Number(saleAmount) <= 0) return;
    setBusy(true); const { data: sale, error } = await supabase.from("sales").insert({ user_id: user.id, deal_id: selected.id, property_id: saleProperty, sale_value: Number(saleAmount) }).select("id").single();
    if (error) setNotice(error.message); else { setShowClose(false); setSaleProperty(""); setSaleAmount(""); await load(); await loadJourney(selected); setNotice(sale ? "Venda registrada. Negócio, imóvel, VGV e comissão foram sincronizados." : "Venda registrada."); } setBusy(false);
  }
  async function moveStage(stage: string) { if (!selected) return; setBusy(true); const { error } = await supabase.from("deals").update({ stage }).eq("id", selected.id); if (error) setNotice(error.message); else { const next = { ...selected, stage }; setSelected(next); setDeals(ds => ds.map(d => d.id === next.id ? next : d)); } setBusy(false); }
  if (loading) return <div className="empty"><Loader2 className="spin"/> Carregando pipeline...</div>;
  return <div className="negocios-core">
    <div className="module-actions"><div><span className="label">PIPELINE COMERCIAL</span><h2>Do lead ao fechamento</h2><p className="muted">Cada cliente mantém seus imóveis visitados, propostas e venda no mesmo histórico.</p></div><button className="clean-button primary" onClick={() => setShowNew(true)}><Plus size={16}/> Novo negócio</button></div>
    {notice && <div className="notice"><strong>Imobfy:</strong> {notice}</div>}
    <div className="pipeline-grid">{stages.map(([key, label]) => <section className="pipeline-column" key={key}><div className="pipeline-column-head"><strong>{label}</strong><span>{deals.filter(d => d.stage === key).length}</span></div>{deals.filter(d => d.stage === key).map(deal => <button key={deal.id} className={`pipeline-card ${selected?.id === deal.id ? "selected" : ""}`} onClick={() => void loadJourney(deal)}><strong>{clientMap.get(deal.client_id || "")?.name || deal.title}</strong><span>{deal.title}</span>{deal.operation_value > 0 && <small>{money(deal.operation_value)}</small>}<ChevronRight size={15}/></button>)}{!deals.some(d => d.stage === key) && <div className="pipeline-empty">Sem negócios</div>}</section>)}</div>
    {selected && <div className="journey-panel"><div className="journey-header"><div><span className="label">JORNADA DO LEAD</span><h3>{clientMap.get(selected.client_id || "")?.name || selected.title}</h3><p>{selected.title} · {selected.client_id ? clientMap.get(selected.client_id)?.phone || "sem telefone" : "sem cliente"}</p></div><button className="icon-button" onClick={() => setSelected(null)}><X size={18}/></button></div>
      <div className="journey-actions"><button className="clean-button secondary" onClick={() => setShowVisit(true)}><CalendarDays size={15}/> Agendar visita</button><button className="clean-button secondary" onClick={() => setShowProposal(true)}><Send size={15}/> Registrar proposta</button><button className="clean-button primary" onClick={() => setShowClose(true)}><Check size={15}/> Fechar venda</button></div>
      <div className="journey-stage">{stages.map(([key,label]) => <button key={key} className={selected.stage===key?"current":""} onClick={() => void moveStage(key)}>{label}</button>)}</div>
      <div className="journey-sections"><article className="clean-card"><div className="card-title"><div><span className="label">IMÓVEIS DA JORNADA</span><h3>{dealProperties.length} imóveis</h3></div><Home size={17}/></div>{dealProperties.length ? dealProperties.map(dp => {const p=propertyMap.get(dp.property_id); return <div className="journey-row" key={dp.id}><div><strong>{p?.title || "Imóvel"}</strong><small>{p?.neighborhood || ""} {p?.sale_value ? `· ${money(p.sale_value)}` : ""}</small></div><em>{dp.sold?"Vendido":dp.proposal_made?"Com proposta":dp.visit_status==="visited"?"Visitado":"Agendado"}</em></div>}) : <div className="empty"><span>Nenhum imóvel vinculado ainda.</span><button className="text-link" onClick={() => setShowVisit(true)}>Adicionar imóveis</button></div>}</article>
      <article className="clean-card"><div className="card-title"><div><span className="label">PROPOSTAS</span><h3>{proposals.length} propostas</h3></div><Send size={17}/></div>{proposals.length ? proposals.map(pr => <div className="journey-row" key={pr.id}><div><strong>{propertyMap.get(pr.property_id)?.title || "Imóvel"}</strong><small>{money(pr.amount)} · {new Date(pr.proposed_at).toLocaleDateString("pt-BR")}</small></div><em>{pr.status}</em></div>) : <div className="empty"><span>As propostas aparecerão aqui.</span></div>}</article>
      <article className="clean-card"><div className="card-title"><div><span className="label">VISITAS</span><h3>{visits.length} visitas</h3></div><CalendarDays size={17}/></div>{visits.length ? visits.map(v => <div className="journey-row" key={v.id}><div><strong>{new Date(v.starts_at).toLocaleString("pt-BR")}</strong><small>{v.location || "Visita imobiliária"}</small></div><em>{v.status}</em></div>) : <div className="empty"><span>Nenhuma visita agendada.</span></div>}</article></div>
    </div>}
    {showNew && <Modal title="Novo negócio" close={() => setShowNew(false)}><label>Cliente<select value={newClient} onChange={e=>setNewClient(e.target.value)}><option value="">Selecione o cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Nome do atendimento<input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Ex.: Compra do primeiro imóvel"/></label><Actions close={()=>setShowNew(false)} save={createDeal} busy={busy}/></Modal>}
    {showVisit && <Modal title="Agendar visita" close={() => setShowVisit(false)}><label>Data<input type="date" value={visitDate} onChange={e=>setVisitDate(e.target.value)}/></label><label>Horário<input type="time" value={visitTime} onChange={e=>setVisitTime(e.target.value)}/></label><label>Imóveis desta visita<select multiple value={visitIds} onChange={e=>setVisitIds(Array.from(e.target.selectedOptions).map(o=>o.value))}>{properties.filter(p=>p.status!=="sold"&&p.status!=="vendido").map(p=><option key={p.id} value={p.id}>{p.title} · {p.neighborhood || ""}</option>)}</select><small>Selecione todos os imóveis que serão visitados com este cliente.</small></label><Actions close={()=>setShowVisit(false)} save={scheduleVisit} busy={busy}/></Modal>}
    {showProposal && <Modal title="Registrar proposta" close={() => setShowProposal(false)}><label>Imóvel<select value={proposalProperty} onChange={e=>setProposalProperty(e.target.value)}><option value="">Selecione o imóvel</option>{dealProperties.map(dp=><option key={dp.property_id} value={dp.property_id}>{propertyMap.get(dp.property_id)?.title || "Imóvel"}</option>)}</select></label><label>Valor da proposta<input type="number" min="1" value={proposalAmount} onChange={e=>setProposalAmount(e.target.value)} placeholder="0"/></label><Actions close={()=>setShowProposal(false)} save={createProposal} busy={busy}/></Modal>}
    {showClose && <Modal title="Fechar venda" close={() => setShowClose(false)}><label>Imóvel vendido<select value={saleProperty} onChange={e=>setSaleProperty(e.target.value)}><option value="">Selecione o imóvel</option>{proposals.filter(pr=>["sent","accepted","aceita","accepted_final"].includes(pr.status)).map(pr=><option key={pr.property_id} value={pr.property_id}>{propertyMap.get(pr.property_id)?.title || "Imóvel"} · {money(pr.amount)}</option>)}</select></label><label>Valor da venda<input type="number" min="1" value={saleAmount} onChange={e=>setSaleAmount(e.target.value)} placeholder="0"/></label><Actions close={()=>setShowClose(false)} save={closeSale} busy={busy}/></Modal>}
  </div>;
}
function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}) { return <div className="modal-backdrop"><div className="clean-modal"><div className="modal-head"><strong>{title}</strong><button className="icon-button" onClick={close}><X size={17}/></button></div>{children}</div></div>; }
function Actions({close,save,busy}:{close:()=>void;save:()=>void;busy:boolean}) { return <div className="modal-actions"><button className="clean-button secondary" onClick={close}>Cancelar</button><button className="clean-button primary" onClick={save} disabled={busy}>{busy?<Loader2 className="spin" size={15}/>:`Salvar`}</button></div>; }
