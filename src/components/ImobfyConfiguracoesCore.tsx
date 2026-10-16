import { useEffect, useState } from "react";
import { Save, ShieldCheck, Target, UserRound, WalletCards } from "lucide-react";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import { supabase } from "../lib/supabase";
import "../imobfy-settings.css";

const DEFAULTS = { brokerage: "6", tax: "9", participation: "20", vgvGoal: "0" };

function normalizePercentage(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
}

function normalizeMoney(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

export default function ImobfyConfiguracoesCore() {
  const [user, setUser] = useState<ImobfyUser | null>(null);
  const [name, setName] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [vgvGoal, setVgvGoal] = useState("");
  const [participation, setParticipation] = useState(DEFAULTS.participation);
  const [tax, setTax] = useState(DEFAULTS.tax);
  const [brokerage, setBrokerage] = useState(DEFAULTS.brokerage);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void restoreSession().then((session) => {
      setUser(session);
      setName(session?.name ?? "");
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    setError("");

    void supabase
      .from("profiles")
      .select("name, whatsapp_phone, default_commission_pct, tax_pct, participation_pct, vgv_goal")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error: profileError }) => {
        if (!active) return;
        if (profileError) {
          setError("Não foi possível carregar suas configurações. Os padrões foram mantidos.");
          setLoading(false);
          return;
        }
        if (data) {
          setName(data.name ?? user.name ?? "");
          setWhatsappPhone(data.whatsapp_phone ?? "");
          setBrokerage(String(data.default_commission_pct ?? DEFAULTS.brokerage));
          setTax(String(data.tax_pct ?? DEFAULTS.tax));
          setParticipation(String(data.participation_pct ?? DEFAULTS.participation));
          setVgvGoal(String(data.vgv_goal ?? 0));
        }
        setLoading(false);
      });

    return () => { active = false; };
  }, [user]);

  async function save() {
    if (!user || saving) return;
    setSaving(true);
    setError("");

    const cleanName = name.trim() || user.name || "Corretor";
    const cleanBrokerage = normalizePercentage(brokerage);
    const cleanTax = normalizePercentage(tax);
    const cleanParticipation = normalizePercentage(participation);
    const cleanVgvGoal = normalizeMoney(vgvGoal);

    const { error: saveError } = await supabase
      .from("profiles")
      .update({
        name: cleanName,
        whatsapp_phone: whatsappPhone.replace(/\D/g, "") || null,
        default_commission_pct: cleanBrokerage,
        tax_pct: cleanTax,
        participation_pct: cleanParticipation,
        vgv_goal: cleanVgvGoal,
      })
      .eq("id", user.id);

    setSaving(false);
    if (saveError) {
      setError("Não foi possível salvar. Verifique sua conexão e tente novamente.");
      return;
    }

    setName(cleanName);
    setBrokerage(String(cleanBrokerage));
    setTax(String(cleanTax));
    setParticipation(String(cleanParticipation));
    setVgvGoal(String(cleanVgvGoal));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  return <div className="settings-core">
    <section className="clean-card settings-hero"><span className="label">CONTA & OPERAÇÃO</span><h2>Deixe o IMOBFY trabalhar do seu jeito.</h2><p>Perfil, meta e regras comerciais em um único lugar.</p></section>
    <div className="clean-grid two settings-grid">
      <section className="clean-card settings-card"><div className="card-title"><div><span className="label">PERFIL</span><h3>Identidade profissional</h3></div><UserRound size={20}/></div><label>Seu nome<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" disabled={loading}/></label><p className="settings-help">Usado para personalizar saudações e sua operação.</p><label>WhatsApp profissional<input type="tel" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} placeholder="5531999999999" disabled={loading}/></label><p className="settings-help">Use código do país + DDD + número (ex.: 5531999999999). Esse número aparecerá nos links públicos dos seus imóveis.</p></section>
      <section className="clean-card settings-card"><div className="card-title"><div><span className="label">PERFORMANCE</span><h3>Meta de VGV</h3></div><Target size={20}/></div><label>Meta mensal<input type="number" min="0" value={vgvGoal} onChange={(e) => setVgvGoal(e.target.value)} placeholder="Ex.: 1500000" disabled={loading}/></label><p className="settings-help">A meta fica vinculada ao seu perfil e pode alimentar os indicadores de performance.</p></section>
      <section className="clean-card settings-card"><div className="card-title"><div><span className="label">COMISSIONAMENTO</span><h3>Regras padrão</h3></div><WalletCards size={20}/></div><div className="settings-form-grid"><label>Corretagem imobiliária (%)<input type="number" min="0" max="100" step="0.1" value={brokerage} onChange={(e) => setBrokerage(e.target.value)} disabled={loading}/></label><label>Imposto sobre corretagem (%)<input type="number" min="0" max="100" step="0.1" value={tax} onChange={(e) => setTax(e.target.value)} disabled={loading}/></label><label>Participação do corretor (%)<input type="number" min="0" max="100" step="0.1" value={participation} onChange={(e) => setParticipation(e.target.value)} disabled={loading}/></label></div><div className="settings-rule"><ShieldCheck size={16}/><span>Essas regras ficam salvas no seu perfil e são usadas no cálculo de novas vendas. Cada comissão guarda a regra aplicada no momento do fechamento.</span></div></section>
      <section className="clean-card settings-card settings-preview"><span className="label">COMO FICA</span><strong>{name || user?.name || "Seu nome"}</strong><span>Meta mensal: {vgvGoal && Number(vgvGoal) > 0 ? `R$ ${Number(vgvGoal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "não definida"}</span><span>Participação: {participation}%</span><span>Corretagem: {brokerage}% · Imposto: {tax}%</span></section>
    </div>
    <div className="settings-actions">{error && <span className="settings-saved">{error}</span>}{saved && <span className="settings-saved">Configurações salvas.</span>}<button className="clean-button primary" onClick={() => void save()} disabled={loading || saving}><Save size={16}/> {saving ? "Salvando..." : "Salvar configurações"}</button></div>
  </div>;
}
