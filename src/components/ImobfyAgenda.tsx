import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Home, Pencil, Plus, UserRound, X } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import { supabase } from "../lib/supabase";
import "../imobfy-clean.css";
import { localDateKey } from "../lib/financial-summary";

type Client = { id: string; name: string; phone: string | null };
type Property = { id: string; title: string; neighborhood: string | null; status: string };
type Deal = { id: string; client_id: string | null; property_id: string | null; title?: string | null };
type Visit = { id: string; client_id: string | null; deal_id: string | null; starts_at: string; ends_at: string | null; status: string; location: string | null; notes: string | null };
type VisitProperty = { id: string; visit_id: string; property_id: string; sequence: number | null; visited: boolean; notes: string | null };

const todayKey = () => localDateKey();
const moneyDate = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const activeStatus = (status: string) => !["done", "completed", "cancelled", "canceled"].includes(status);

export default function ImobfyAgenda() {
  const navigate = useNavigate();
  const [user, setUser] = useState<ImobfyUser | null>(null);
  const [ready, setReady] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitProperties, setVisitProperties] = useState<VisitProperty[]>([]);
  const [filter, setFilter] = useState<"today" | "upcoming" | "done">("today");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Visit | null>(null);
  const [error, setError] = useState("");
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState("10:00");
  const [clientId, setClientId] = useState("");
  const [dealId, setDealId] = useState("");
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState<Visit | null>(null);
  const [visitedIds, setVisitedIds] = useState<string[]>([]);

  async function load(uid: string) {
    const [v, c, p, d, vp] = await Promise.all([
      supabase.from("visits").select("id,client_id,deal_id,starts_at,ends_at,status,location,notes").eq("user_id", uid).order("starts_at"),
      supabase.from("clients").select("id,name,phone").eq("user_id", uid).eq("status", "active").order("name"),
      supabase.from("properties").select("id,title,neighborhood,status").eq("user_id", uid).order("title"),
      supabase.from("deals").select("id,client_id,property_id,title").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("visit_properties").select("id,visit_id,property_id,sequence,visited,notes").eq("user_id", uid).order("sequence"),
    ]);
    if (v.error) throw v.error;
    if (c.error) throw c.error;
    if (p.error) throw p.error;
    if (d.error) throw d.error;
    if (vp.error) throw vp.error;
    setVisits((v.data ?? []) as Visit[]);
    setClients((c.data ?? []) as Client[]);
    setProperties((p.data ?? []) as Property[]);
    setDeals((d.data ?? []) as Deal[]);
    setVisitProperties((vp.data ?? []) as VisitProperty[]);
  }

  useEffect(() => {
    let mounted = true;
    void restoreSession().then(async (session) => {
      if (!mounted) return;
      if (!session) {
        void navigate({ to: "/login" });
        return;
      }
      setUser(session);
      try {
        await load(session.id);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Não foi possível carregar a agenda.");
      } finally {
        if (mounted) setReady(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const visible = useMemo(() => {
    const now = new Date();
    const today = todayKey();
    if (filter === "done") return visits.filter((v) => ["done", "completed"].includes(v.status));
    if (filter === "today") return visits.filter((v) => localDateKey(v.starts_at) === today && activeStatus(v.status));
    return visits.filter((v) => new Date(v.starts_at) >= now && activeStatus(v.status));
  }, [filter, visits]);

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "Sem cliente";
  const propertyMap = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const propsFor = (visitId: string) => visitProperties.filter((x) => x.visit_id === visitId).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)).map((x) => propertyMap.get(x.property_id)).filter((p): p is Property => Boolean(p));

  function reset() {
    setEditing(null);
    setDate(todayKey());
    setTime("10:00");
    setClientId("");
    setDealId("");
    setPropertyIds([]);
    setLocation("");
    setNotes("");
  }

  function openNew() {
    setError("");
    reset();
    setOpen(true);
  }

  function openEdit(visit: Visit) {
    const start = new Date(visit.starts_at);
    setError("");
    setEditing(visit);
    setDate(localDateKey(start));
    setTime(start.toTimeString().slice(0, 5));
    setClientId(visit.client_id ?? "");
    setDealId(visit.deal_id ?? "");
    setPropertyIds(visitProperties.filter((x) => x.visit_id === visit.id).map((x) => x.property_id));
    setLocation(visit.location ?? "");
    setNotes(visit.notes ?? "");
    setOpen(true);
  }

  async function save() {
    if (!user || busy || !date || !time) return;
    setError(""); setBusy(true);
    try {
      const starts = new Date(`${date}T${time}:00`);
      if (!Number.isFinite(starts.getTime())) { setError("Informe uma data e hora válidas."); return; }
      const { error: saveError } = await supabase.rpc("save_visit_journey", {
        p_visit_id: editing?.id ?? null, p_client_id: clientId || null, p_deal_id: dealId || null,
        p_starts_at: starts.toISOString(), p_ends_at: new Date(starts.getTime() + 3600000).toISOString(),
        p_property_ids: propertyIds, p_location: location, p_notes: notes,
      });
      if (saveError) { setError(saveError.message); return; }
      setOpen(false); reset(); await load(user.id);
    } catch { setError("Não foi possível salvar ou atualizar a agenda. Recarregue para conferir."); }
    finally { setBusy(false); }
  }

  async function setStatus(id: string, status: "done" | "cancelled", visited: string[] = []) {
    if (!user || busy) return;
    setError(""); setBusy(true);
    try {
      const { error: updateError } = await supabase.rpc("finish_visit_journey", {
        p_visit_id: id, p_status: status, p_visited_property_ids: visited,
      });
      if (updateError) setError(updateError.message);
      else { setFinishing(null); setVisitedIds([]); await load(user.id); }
    } catch { setError("Não foi possível concluir a operação. Recarregue a agenda para conferir."); }
    finally { setBusy(false); }
  }

  if (!ready || !user) return null;
  return (
    <div className="clean-app">
      <aside className="clean-sidebar">
        <div className="clean-brand"><div className="brand-symbol">I</div><div><strong>imobfy</strong><span>GESTÃO IMOBILIÁRIA</span></div></div>
        <nav><span className="nav-section">OPERAÇÃO</span><Link to="/"><CalendarDays size={17}/><span>Visão geral</span></Link><Link to="/imoveis"><Home size={17}/><span>Imóveis</span></Link><Link to="/clientes"><UserRound size={17}/><span>Clientes</span></Link><Link to="/negocios"><Home size={17}/><span>Negócios</span></Link><Link to="/agenda" className="active"><CalendarDays size={17}/><span>Agenda</span></Link></nav>
      </aside>
      <main className="clean-main">
        <header className="clean-header"><div><span className="header-kicker">ROTINA COMERCIAL</span><h1>Agenda</h1><p>Visitas conectadas aos clientes, negócios e imóveis.</p></div><button className="clean-button primary" onClick={openNew}><Plus size={16}/> Nova visita</button></header>
        <div className="content">
          <div className="clean-toolbar"><div className="period-tabs"><button className={filter === "today" ? "selected" : ""} onClick={() => setFilter("today")}>Hoje</button><button className={filter === "upcoming" ? "selected" : ""} onClick={() => setFilter("upcoming")}>Próximos</button><button className={filter === "done" ? "selected" : ""} onClick={() => setFilter("done")}>Concluídos</button></div><span className="muted">{visible.length} visita(s)</span></div>
          {error && <div className="notice"><strong>Ops.</strong> {error}</div>}
          <section className="clean-card table-card"><div className="card-title"><div><span className="label">VISITAS</span><h3>{filter === "today" ? "Sua agenda de hoje" : filter === "upcoming" ? "Próximas visitas" : "Histórico"}</h3></div></div>
            <div className="table">{visible.length ? visible.map((visit) => { const ps = propsFor(visit.id); return <div className="table-row" key={visit.id}><div><strong>{clientName(visit.client_id)}</strong><small>{moneyDate(visit.starts_at)}{visit.location ? ` · ${visit.location}` : ""}</small></div><span>{ps.length ? `${ps.length} imóvel(is)` : "Sem imóvel"}</span><span>{ps.map((p) => p.title).join(" · ") || "Sem imóvel vinculado"}</span><span>{visit.status === "done" || visit.status === "completed" ? "Concluído" : visit.status === "cancelled" || visit.status === "canceled" ? "Cancelado" : "Agendado"}</span><div className="row-actions">{activeStatus(visit.status) && <><button className="icon-button" disabled={busy} title="Editar" onClick={() => openEdit(visit)}><Pencil size={15}/></button><button className="icon-button" disabled={busy} title="Concluir" onClick={() => { setError(""); setFinishing(visit); setVisitedIds([]); }}><Check size={15}/></button><button className="icon-button" disabled={busy} title="Cancelar" onClick={() => void setStatus(visit.id, "cancelled")}><X size={15}/></button></>}</div></div>; }) : <div className="empty"><strong>Nenhuma visita aqui.</strong><span>Agende uma visita e selecione os imóveis que serão apresentados.</span></div>}</div>
          </section>
        </div>
      </main>
      {finishing && <Dialog.Root open onOpenChange={open => { if (!open && !busy) setFinishing(null); }}><Dialog.Portal><Dialog.Overlay className="mvp-overlay"><Dialog.Content className="mvp-modal">
        <Dialog.Title>Quais imóveis foram visitados?</Dialog.Title><Dialog.Description>Somente os imóveis selecionados serão liberados para proposta neste negócio.</Dialog.Description>
        {propsFor(finishing.id).map(property => <label key={property.id}><input type="checkbox" checked={visitedIds.includes(property.id)} onChange={e => setVisitedIds(ids => e.target.checked ? [...ids, property.id] : ids.filter(id => id !== property.id))}/>{property.title}</label>)}
        {!propsFor(finishing.id).length && <p>Esta visita não possui imóveis vinculados.</p>}
        {error && <p role="alert">{error}</p>}
        <div className="mvp-actions"><button className="clean-button secondary" disabled={busy} onClick={() => setFinishing(null)}>Voltar</button><button className="clean-button primary" disabled={busy || (propsFor(finishing.id).length > 0 && !visitedIds.length)} onClick={() => void setStatus(finishing.id, "done", visitedIds)}>{busy ? "Concluindo..." : "Confirmar visita"}</button></div>
      </Dialog.Content></Dialog.Overlay></Dialog.Portal></Dialog.Root>}
      {open && <div className="mvp-overlay"><div className="mvp-modal"><button className="mvp-close" onClick={() => { setOpen(false); reset(); }}><X size={18}/></button><span className="label">{editing ? "EDITAR VISITA" : "NOVA VISITA"}</span><h2>{editing ? "Editar visita" : "Agendar visita"}</h2><div className="form-grid"><label>Data<input type="date" value={date} onChange={(e) => setDate(e.target.value)}/></label><label>Hora<input type="time" value={time} onChange={(e) => setTime(e.target.value)}/></label></div><label>Cliente<select value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Selecione o cliente</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Negócio<select value={dealId} onChange={(e) => { setDealId(e.target.value); const deal = deals.find(d => d.id === e.target.value); if (deal) setClientId(deal.client_id ?? ""); }}><option value="">Sem negócio</option>{deals.map((d) => <option key={d.id} value={d.id}>{d.title || "Negócio"}</option>)}</select></label><label>Imóveis da visita<div style={{ display: "grid", gap: 7, maxHeight: 190, overflowY: "auto", marginTop: 6 }}>{properties.filter((p) => activeStatus(p.status)).map((p) => <button key={p.id} type="button" onClick={() => setPropertyIds((ids) => ids.includes(p.id) ? ids.filter((id) => id !== p.id) : [...ids, p.id])} style={{ textAlign: "left", padding: "10px 12px", border: "1px solid var(--border,#e7e2d8)", borderRadius: 10, background: propertyIds.includes(p.id) ? "#f5f0e5" : "#fff", cursor: "pointer" }}><strong>{propertyIds.includes(p.id) ? "✓ " : ""}{p.title}</strong>{p.neighborhood && <small style={{ display: "block", marginTop: 2 }}>{p.neighborhood}</small>}</button>)}</div></label><label>Local<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Endereço ou ponto de encontro"/></label><label>Observações<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Objetivo e próximos passos..."/></label><div className="mvp-actions"><button className="clean-button secondary" onClick={() => { setOpen(false); reset(); }}>Cancelar</button><button className="clean-button primary" disabled={busy} onClick={() => void save()}>{busy ? "Salvando..." : editing ? "Salvar alterações" : "Agendar visita"}</button></div></div></div>}
    </div>
  );
}

