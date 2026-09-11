import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, CircleDollarSign, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { type ImobfyUser } from "../lib/imobfy-session";

type VgvEntry = { id: string; deal_id: string | null; reference_month: string; vgv: number; created_at?: string };
const money = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ImobfyVgvCore({ user }: { user: ImobfyUser }) {
  const [entries, setEntries] = useState<VgvEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("vgv_entries").select("id,deal_id,reference_month,vgv,created_at").eq("user_id", user.id).order("reference_month", { ascending: false });
    if (error) setNotice("Não consegui carregar seu histórico de VGV.");
    else setEntries((data || []) as VgvEntry[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [user.id]);

  const total = useMemo(() => entries.reduce((sum, entry) => sum + Number(entry.vgv || 0), 0), [entries]);
  const currentYear = new Date().getFullYear();
  const yearTotal = useMemo(() => entries.filter(e => new Date(e.reference_month + "T12:00:00").getFullYear() === currentYear).reduce((sum, e) => sum + Number(e.vgv || 0), 0), [entries, currentYear]);
  const monthly = useMemo(() => {
    const grouped = new Map<string, number>();
    entries.forEach(entry => {
      const key = entry.reference_month.slice(0, 7);
      grouped.set(key, (grouped.get(key) || 0) + Number(entry.vgv || 0));
    });
    return [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  }, [entries]);

  function reset() { setOpen(false); setMonth(""); setValue(""); setNotice(""); }

  async function addHistorical() {
    const numericValue = Number(value.replace(/\./g, "").replace(",", "."));
    if (!month || !Number.isFinite(numericValue) || numericValue <= 0) { setNotice("Informe o mês e um VGV válido."); return; }
    setSaving(true); setNotice("");
    const referenceMonth = `${month}-01`;
    const { error } = await supabase.from("vgv_entries").insert({ user_id: user.id, deal_id: null, reference_month: referenceMonth, vgv: numericValue });
    if (error) setNotice(error.message);
    else { reset(); setNotice("VGV histórico lançado com sucesso."); await load(); }
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
      <button className="clean-button primary" onClick={() => setOpen(true)}><Plus size={16} /> Lançar VGV antigo</button>
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
        {monthly.length ? monthly.map(([key, amount]) => { const [y, m] = key.split("-"); const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); const monthEntries = entries.filter(e => e.reference_month.slice(0, 7) === key); return <div className="table-row" key={key}><div><strong>{label.charAt(0).toUpperCase() + label.slice(1)}</strong><small>{monthEntries.length} lançamento(s) · {monthEntries.some(e => !e.deal_id) ? "inclui histórico manual" : "fechamento(s) do sistema"}</small></div><span><strong>{money(amount)}</strong></span><span><em>Realizado</em></span><span /></div>; }) : <div className="empty"><CircleDollarSign size={20} /><strong>Seu histórico começa aqui.</strong><span>Lance vendas antigas ou feche novos negócios para construir seu VGV.</span></div>}
      </div></article>
      <article className="clean-card"><span className="label">COMO FUNCIONA</span><h3>Seu histórico não fica para trás.</h3><p>Você pode cadastrar agora vendas realizadas antes de criar o IMOBFY. Elas entram no VGV do mês correto, sem criar uma comissão futura ou alterar seu pipeline atual.</p><div className="next-step-list"><div><CalendarDays size={17} /><span>Escolha o mês e ano em que a venda aconteceu.</span></div><div><CircleDollarSign size={17} /><span>Informe o valor da venda (VGV).</span></div><div><CheckCircle2 size={17} /><span>O lançamento aparece imediatamente no seu histórico e nos totais.</span></div></div></article>
    </div>
    {entries.some(e => !e.deal_id) && <article className="clean-card table-card" style={{ marginTop: 16 }}><div className="card-title"><div><span className="label">LANÇAMENTOS MANUAIS</span><h3>VGV antigo cadastrado</h3></div></div><div className="table">{entries.filter(e => !e.deal_id).map(entry => <div className="table-row" key={entry.id}><div><strong>{new Date(entry.reference_month + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong><small>Venda anterior ao IMOBFY</small></div><span><strong>{money(entry.vgv)}</strong></span><span><em>Histórico</em></span><button className="icon-button" title="Remover lançamento" onClick={() => void removeHistorical(entry)}><Trash2 size={15} /></button></div>)}</div></article>}
    {open && <div className="mvp-overlay"><div className="mvp-modal operation-modal"><button className="mvp-close" onClick={reset}>×</button><span className="label">HISTÓRICO</span><h2>Lançar VGV antigo</h2><p>Registre uma venda que aconteceu antes de você começar a usar o IMOBFY.</p><div className="form-grid"><label>Mês da venda<input autoFocus type="month" value={month} onChange={e => setMonth(e.target.value)} /></label><label>Valor da venda / VGV<input type="number" min="0" step="0.01" value={value} onChange={e => setValue(e.target.value)} placeholder="Ex.: 550000" /></label></div><div className="notice"><strong>Importante:</strong> esse lançamento serve para compor seu histórico de VGV. Ele não cria comissão a receber nem movimenta um negócio atual.</div><div className="mvp-actions"><button className="clean-button secondary" onClick={reset}>Cancelar</button><button className="clean-button primary" disabled={saving} onClick={() => void addHistorical()}>{saving ? "Salvando..." : "Lançar VGV"}</button></div></div></div>}
  </div>;
}
