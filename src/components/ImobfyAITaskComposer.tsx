import { useState } from "react";
import { CalendarPlus, Check, X } from "lucide-react";
import { supabase } from "../lib/supabase";

type Props = { userId: string; onCreated: (message: string) => void; onClose: () => void };

function localDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

function localDateInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function ImobfyAITaskComposer({ userId, onCreated, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createTask() {
    const starts = localDateTime(date, time);
    if (!title.trim() || !date || !time || Number.isNaN(starts.getTime())) {
      setError("Preencha o título, a data e o horário.");
      setConfirming(false);
      return;
    }
    if (starts.getTime() <= Date.now()) {
      setError("Escolha uma data e um horário futuros.");
      setConfirming(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const ends = new Date(starts.getTime() + 30 * 60 * 1000);
      const { error: insertError } = await supabase.from("appointments").insert({
        user_id: userId,
        title: title.trim(),
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        status: "scheduled",
        notes: notes.trim() || "Tarefa criada pela IMOBFY IA após confirmação do usuário.",
      });
      if (insertError) {
        setError("Não consegui criar a tarefa. Confira sua conexão e tente novamente.");
        return;
      }
      onCreated(`Tarefa criada na sua agenda: “${title.trim()}”, em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(starts)}.`);
    } catch {
      setError("Não consegui criar a tarefa por causa de uma falha de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return <section style={{ margin: "14px 0", padding: 18, border: "1px solid rgba(194,161,97,.42)", borderRadius: 16, background: "rgba(255,255,255,.94)", color: "#252720", boxShadow: "0 12px 34px rgba(20,24,18,.07)" }} aria-label="Criar tarefa na agenda">
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}><CalendarPlus size={18} /><strong style={{ fontSize: 13 }}>Nova tarefa na agenda</strong></div>
      <button type="button" onClick={onClose} aria-label="Fechar" style={{ border: 0, background: "transparent", cursor: "pointer", color: "#777" }}><X size={16} /></button>
    </div>
    <label style={{ display: "block", fontSize: 11, marginBottom: 10 }}>O que você precisa fazer?
      <input value={title} onChange={e => { setTitle(e.target.value); setConfirming(false); }} placeholder="Ex.: Ligar para o proprietário" style={fieldStyle} />
    </label>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <label style={{ display: "block", fontSize: 11 }}>Data
        <input type="date" value={date} min={localDateInputValue()} onChange={e => { setDate(e.target.value); setConfirming(false); }} style={fieldStyle} />
      </label>
      <label style={{ display: "block", fontSize: 11 }}>Horário
        <input type="time" value={time} onChange={e => { setTime(e.target.value); setConfirming(false); }} style={fieldStyle} />
      </label>
    </div>
    <label style={{ display: "block", fontSize: 11, marginTop: 10 }}>Observações (opcional)
      <textarea value={notes} onChange={e => { setNotes(e.target.value); setConfirming(false); }} placeholder="Contexto ou próximo passo..." rows={2} style={{ ...fieldStyle, height: "auto", minHeight: 58, padding: "10px 11px", resize: "vertical" }} />
    </label>
    {error && <p role="alert" style={{ color: "#a23e35", fontSize: 11, margin: "9px 0 0" }}>{error}</p>}
    {confirming && <p style={{ fontSize: 11, lineHeight: 1.5, padding: 10, borderRadius: 10, background: "#f5f1e8", margin: "12px 0 0" }}>Confirme: criar “{title.trim()}” para {date ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(`${date}T12:00:00`)) : "data não definida"} às {time}, com duração de 30 minutos?</p>}
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
      <button type="button" onClick={onClose} disabled={saving} style={secondaryButton}>Cancelar</button>
      {!confirming
        ? <button type="button" onClick={() => { if (!title.trim() || !date || !time) { setError("Preencha o título, a data e o horário."); return; } const starts = localDateTime(date, time); if (Number.isNaN(starts.getTime()) || starts.getTime() <= Date.now()) { setError("Escolha uma data e um horário futuros."); return; } setError(""); setConfirming(true); }} style={primaryButton}>Revisar tarefa</button>
        : <button type="button" onClick={() => void createTask()} disabled={saving} style={primaryButton}><Check size={14} /> {saving ? "Criando..." : "Confirmar e criar"}</button>}
    </div>
  </section>;
}

const fieldStyle: React.CSSProperties = { boxSizing: "border-box", display: "block", width: "100%", marginTop: 5, border: "1px solid #dedbd2", borderRadius: 9, padding: "0 11px", height: 38, background: "#fff", color: "#252720", fontSize: 12, outlineColor: "#b08b45" };
const primaryButton: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: 0, borderRadius: 9, padding: "10px 13px", background: "#242720", color: "#e6c780", fontSize: 11, fontWeight: 700, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { border: "1px solid #dedbd2", borderRadius: 9, padding: "10px 13px", background: "#fff", color: "#555", fontSize: 11, cursor: "pointer" };
