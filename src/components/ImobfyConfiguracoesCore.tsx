import { useEffect, useState } from "react";
import { Save, ShieldCheck, Target, UserRound, WalletCards } from "lucide-react";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";

export default function ImobfyConfiguracoesCore() {
  const [user, setUser] = useState<ImobfyUser | null>(null);
  const [name, setName] = useState("");
  const [vgvGoal, setVgvGoal] = useState("");
  const [participation, setParticipation] = useState("20");
  const [tax, setTax] = useState("9");
  const [brokerage, setBrokerage] = useState("6");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void restoreSession().then((session) => {
      setUser(session);
      setName(session?.name ?? "");
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const key = `imobfy-settings-${user.id}`;
    const stored = localStorage.getItem(key);
    if (!stored) return;
    try {
      const settings = JSON.parse(stored) as Record<string, string>;
      setName(settings.name ?? user.name ?? "");
      setVgvGoal(settings.vgvGoal ?? "");
      setParticipation(settings.participation ?? "20");
      setTax(settings.tax ?? "9");
      setBrokerage(settings.brokerage ?? "6");
    } catch {
      // Ignore malformed local preferences and keep safe defaults.
    }
  }, [user]);

  function save() {
    if (!user) return;
    localStorage.setItem(
      `imobfy-settings-${user.id}`,
      JSON.stringify({ name: name.trim(), vgvGoal, participation, tax, brokerage }),
    );
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div className="settings-core">
      <section className="clean-card settings-hero">
        <span className="label">CONTA & OPERAÇÃO</span>
        <h2>Deixe o IMOBFY trabalhar do seu jeito.</h2>
        <p>Perfil, meta e regras comerciais em um único lugar.</p>
      </section>

      <div className="clean-grid two settings-grid">
        <section className="clean-card settings-card">
          <div className="card-title"><div><span className="label">PERFIL</span><h3>Identidade profissional</h3></div><UserRound size={20} /></div>
          <label>Seu nome<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" /></label>
          <p className="settings-help">Usado para personalizar saudações e sua operação.</p>
        </section>

        <section className="clean-card settings-card">
          <div className="card-title"><div><span className="label">PERFORMANCE</span><h3>Meta de VGV</h3></div><Target size={20} /></div>
          <label>Meta mensal<input type="number" min="0" value={vgvGoal} onChange={(e) => setVgvGoal(e.target.value)} placeholder="Ex.: 1500000" /></label>
          <p className="settings-help">A meta será usada pelos indicadores de performance do IMOBFY.</p>
        </section>

        <section className="clean-card settings-card">
          <div className="card-title"><div><span className="label">COMISSIONAMENTO</span><h3>Regras padrão</h3></div><WalletCards size={20} /></div>
          <div className="settings-form-grid">
            <label>Corretagem imobiliária (%)<input type="number" min="0" step="0.1" value={brokerage} onChange={(e) => setBrokerage(e.target.value)} /></label>
            <label>Imposto sobre corretagem (%)<input type="number" min="0" step="0.1" value={tax} onChange={(e) => setTax(e.target.value)} /></label>
            <label>Participação do corretor (%)<input type="number" min="0" step="0.1" value={participation} onChange={(e) => setParticipation(e.target.value)} /></label>
          </div>
          <div className="settings-rule"><ShieldCheck size={16} /><span>O padrão atual do IMOBFY é 6% de corretagem, 9% de imposto e 20% de participação.</span></div>
        </section>

        <section className="clean-card settings-card settings-preview">
          <span className="label">COMO FICA</span>
          <strong>{name || user?.name || "Seu nome"}</strong>
          <span>Meta mensal: {vgvGoal ? `R$ ${Number(vgvGoal).toLocaleString("pt-BR")}` : "não definida"}</span>
          <span>Participação: {participation}%</span>
          <span>Corretagem: {brokerage}% · Imposto: {tax}%</span>
        </section>
      </div>

      <div className="settings-actions">
        {saved && <span className="settings-saved">Configurações salvas.</span>}
        <button className="clean-button primary" onClick={save}><Save size={16} /> Salvar configurações</button>
      </div>
    </div>
  );
}
