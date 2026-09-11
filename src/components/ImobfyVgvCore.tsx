import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, CircleDollarSign, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { type ImobfyUser } from "../lib/imobfy-session";

type VgvEntry = { id: string; deal_id: string | null; reference_month: string; vgv: number; created_at?: string };
type Property = { id: string; title: string; address: string | null; neighborhood: string | null; sale_value: number };
const money = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ImobfyVgvCore({ user }: { user: ImobfyUser }) {
  const [entries, setEntries] = useState<VgvEntry[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<"historical" | "sale" | null>(null);
  const [month, setMonth] = useState("");
  const [value, setValue] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [soldAt, setSoldAt] = useState(new Date().toISOString().slice(0, 10));
  const [commissionType, setCommissionType] = useState<"captacao" | "venda" | "ambos">("captacao");
  const [split, setSplit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    const [vgvResult, propertiesResult] = await Promise.all([
      supabase.from("vgv_entries").select("id,deal_id,reference_month,vgv,created_at").eq("user_id", user.id).order("reference_month", { ascending: false }),
      supabase.from("properties").select("id,title,address,neighborhood,sale_value").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (vgvResult.error) setNotice("Não consegui carregar seu histórico de VGV.");
    else setEntries((vgvResult.data || []) as VgvEntry[]);
    if (!propertiesResult.error) setProperties((propertiesResult.data || []) as Property[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [user.id]);

  const total = useMemo(() => entries.reduce((sum, entry) => sum + Number(entry.vgv || 0), 0), [entries]);
  const currentYear = new Date().getFullYear();
  const yearTotal = useMemo(() => entries.filter(e => new Date(e.reference_month + "T12:00:00").getFullYear() === currentYear).reduce((sum, e) => sum + Number(e.vgv || 0), 0), [entries, currentYear]);
  const monthly = useMemo(() => {
    const grouped = new Map<string, number>();
    entries.forEach(entry => { const key = entry.reference_month.slice(0, 7); grouped.set(key, (grouped.get(key) || 0) + Number(entry.vgv || 0)); });
    return [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  }, [entries]);

  function reset() {
    setOpen(null); setMonth(""); setValue(""); setPropertyId(""); setSoldAt(new Date().toISOString().slice(0, 10)); setCommissionType("captacao"); setSplit(false); setNotice("");
  }

  async function addHistorical() {
    const numericValue = Number(value.replace(/\./g, "").replace(",", "."));
    if (!month || !Number.isFinite(numericValue) || numericValue <= 0) { setNotice("Informe o mês e um VGV válido."); return; }
    setSaving(true); setNotice("");
    const { error } = await supabase.rpc("register_manual_vgv", {
      p_user_id: user.id,
      p_reference_month: `${month}-01`,
      p_vgv: numericValue,
      p_commission_type: commissionType,
      p_split: split,
    });
    if (error) setNotice(error.message);
    else { reset(); setNotice("VGV histórico e comissão lançados com sucesso."); await load(); }
    setSaving(false);
  }

  async function addDirectSale() {
    const numericValue = Number(value.replace(/\./g, "").replace(",", "."));
    if (!propertyId) { setNotice("Selecione o imóvel vendido."); return; }
    if (!Number.isFinite(numericValue) || numericValue <= 0) { setNotice("Informe um valor de venda válido."); return; }
    if (!soldAt) { setNotice("Informe a data da venda."); return; }
    setSaving(true); setNotice("");
    const sides = commissionType === "captacao" ? [split ? "capture_split" : "capture"] : commissionType === "venda" ? [split ? "sale_split" : "sale"] : [split ? "capture_split" : "capture", split ? "sale_split" : "sale"];
    const { error } = await supabase.rpc("register_direct_sale", {
      p_user_id: user.id,
      p_property_id: propertyId,
      p_sale_value: numericValue,
      p_sold_at: `${soldAt}T12:00:00`,
      p_commission_sides: sides,
      p_notes: "Venda lançada diretamente, fora do funil de negócios.",
    });
    if (error) setNotice(error.message);
    else { reset(); setNotice("Venda lançada. VGV e comissão foram calculados automaticamente."); await load(); }
    setSaving(false);
  }

  async function removeHistorical(entry: VgvEntry) {
    if (entry.deal_id) return;
    setNotice("");
    const { error } = await supabase.from("vgv_entries").delete().eq("id", entry.id).eq("user_id", user.id).is("deal_id", null);
    if (error) setNotice(error.message); else { setEntries(current => current.filter(item => item.id !== entry.id)); setNotice("Lançamento histórico removido."); }
  }

  if (loading) return <div className="empty"><Loader2 className="spin" /> Carregando seu VGV...</div>;

  return <div className="negocios-core finance-core">
    <div className="module-actions">
      <div><span className="label">PERFORMANCE</span><h2>Meu VGV</h2><p className="muted">Sua produção histórica e atual, organizada por mês.</p></div>
      <div className="module-actions" style={{ gap: 8 }}>
        <button className="clean-button secondary" onClick={() => setOpen("historical")}><Plus size={16} /> VGV antigo</button>
        <button className="clean-button primary" onClick={() => setOpen("sale")}><Plus size={16} /> Lançar venda</button>
      </div>
    </div>
    {notice && <div className="notice"><strong>Imobfy:</strong> {notice}</div>}
    <section className="metrics-grid">
      <article className="metric-card"><span>VGV total</span><strong>{money(total)}</strong><small className="neutral">Toda sua produção registrada</small></article>
      <article className="metric-card"><span>VGV em {currentYear}</span><strong>{money(yearTotal)}</strong><small className="neutral">Ano atual</small></article>
      <article className="metric-card"><span>Lançamentos</span><strong>{entries.length}</strong><small className="neutral">Vendas + histórico manual</small></article>
      <article className="metric-card"><span>Último mês</span><strong>{monthly[0] ? money(monthly[0][1]) : money(0)}</strong><small className="neutral">Produção registrada</small></article>
    </section>
    <div className="clean-grid two">
      <article className="clean-card table-card"><div className="card-title"><div><span className="label">HISTÓRICO</span><h3>Produção por mês</h3></div><span className="muted">{monthly.length} meses</span></div><div className="table">
        {monthly.length ? monthly.map(([key, amount]) => { const [y, m] = key.split("-"); const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); const monthEntries = entries.filter(e => e.reference_month.slice(0, 7) === key); return <div className="table-row" key={key}><div><strong>{label.charAt(0).toUpperCase() + label.slice(1)}</strong><small>{monthEntries.length} lançamento(s) · {monthEntries.some(e => !e.deal_id) ? "inclui histórico/manual" : "fechamento(s) do sistema"}</small></div><span><strong>{money(amount)}</strong></span><span><em>Realizado</em></span><span /></div>; }) : <div className="empty"><CircleDollarSign size={20} /><strong>Seu histórico começa aqui.</strong><span>Lance vendas antigas ou novas vendas diretas para construir seu VGV.</span></div>}
      </div></article>
      <article className="clean-card"><span className="label">NOVO FLUXO</span><h3>Venda sem passar pelo funil.</h3><p>Se você vendeu um imóvel captado por você, mas não teve cliente, visita ou negócio dentro do IMOBFY, não precisa criar registros artificiais. Lance a venda diretamente aqui.</p><div className="next-step-list"><div><CheckCircle2 size={17} /><span>Escolha o imóvel vendido e o valor real da venda.</span></div><div><CircleDollarSign size={17} /><span>Defina se sua atuação foi captação, venda ou ambas.</span></div><div><CalendarDays size={17} /><span>O sistema cria o VGV e a comissão no mês correto.</span></div></div></article>
    </div>
    {entries.some(e => !e.deal_id) && <article className="clean-card table-card" style={{ marginTop: 16 }}><div className="card-title"><div><span className="label">LANÇAMENTOS MANUAIS</span><h3>VGV antigo cadastrado</h3></div></div><div className="table">{entries.filter(e => !e.deal_id).map(entry => <div className="table-row" key={entry.id}><div><strong>{new Date(entry.reference_month + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong><small>VGV manual / venda fora do funil</small></div><span><strong>{money(entry.vgv)}</strong></span><span><em>Histórico</em></span><button className="icon-button" title="Remover lançamento" onClick={() => void removeHistorical(entry)}><Trash2 size={15} /></button></div>)}</div></article>}

    {open && <div className="mvp-overlay"><div className="mvp-modal operation-modal"><button className="mvp-close" onClick={reset}>×</button>
      <span className="label">{open === "sale" ? "VENDA DIRETA" : "HISTÓRICO"}</span>
      <h2>{open === "sale" ? "Lançar venda atual" : "Lançar VGV antigo"}</h2>
      <p>{open === "sale" ? "Registre uma venda que aconteceu sem cliente, negócio ou proposta no IMOBFY." : "Registre uma venda antiga e já gere a comissão correspondente."}</p>
      {open === "sale" ? <>
        <div className="form-grid"><label>Imóvel vendido<select value={propertyId} onChange={e => { setPropertyId(e.target.value); const p = properties.find(item => item.id === e.target.value); if (p?.sale_value) setValue(String(p.sale_value)); }}><option value="">Selecione o imóvel...</option>{properties.map(p => <option key={p.id} value={p.id}>{p.title}{p.neighborhood ? ` · ${p.neighborhood}` : ""}</option>)}</select></label><label>Data da venda<input type="date" value={soldAt} onChange={e => setSoldAt(e.target.value)} /></label></div>
        <div className="form-grid"><label>Valor da venda<input autoFocus type="number" min="0" step="0.01" value={value} onChange={e => setValue(e.target.value)} placeholder="Ex.: 550000" /></label><label>Sua atuação<select value={commissionType} onChange={e => setCommissionType(e.target.value as typeof commissionType)}><option value="captacao">Somente captação</option><option value="venda">Somente venda</option><option value="ambos">Captação + venda</option></select></label></div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}><input type="checkbox" checked={split} onChange={e => setSplit(e.target.checked)} /> Minha participação foi meiada</label>
        <div className="notice"><strong>Automático:</strong> o IMOBFY calcula corretagem, imposto, sua participação, comissão e VGV. Não cria cliente nem negócio.</div>
      </> : <>
        <div className="form-grid"><label>Mês da venda<input autoFocus type="month" value={month} onChange={e => setMonth(e.target.value)} /></label><label>Valor da venda / VGV<input type="number" min="0" step="0.01" value={value} onChange={e => setValue(e.target.value)} placeholder="Ex.: 550000" /></label></div>
        <div className="form-grid"><label>Atuação na venda<select value={commissionType} onChange={e => setCommissionType(e.target.value as typeof commissionType)}><option value="captacao">Captação</option><option value="venda">Venda</option><option value="ambos">Captação + venda</option></select></label><label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 28 }}><input type="checkbox" checked={split} onChange={e => setSplit(e.target.checked)} /> Comissão meiada</label></div>
        <div className="notice"><strong>Agora sim:</strong> esse VGV também gera a comissão a receber, usando suas configurações atuais de corretagem, imposto e participação. Nenhum imóvel é necessário para este lançamento.</div>
      </>}
      <div className="mvp-actions"><button className="clean-button secondary" onClick={reset}>Cancelar</button><button className="clean-button primary" disabled={saving} onClick={() => void (open === "sale" ? addDirectSale() : addHistorical())}>{saving ? "Calculando..." : open === "sale" ? "Lançar venda" : "Lançar VGV + comissão"}</button></div>
    </div></div>}
  </div>;
}
