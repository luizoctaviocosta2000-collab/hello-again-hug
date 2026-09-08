import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Clock3, MapPin, Phone, Plus, Users, Video, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/agenda")({ component: Agenda });

type EventKind = "Visita" | "Reunião" | "Ligação" | "Follow-up" | "Captação";

type AgendaEvent = {
  id: string;
  title: string;
  kind: EventKind;
  time: string;
  person?: string;
  property?: string;
  location?: string;
};

const events: AgendaEvent[] = [
  { id: "1", title: "Visita ao apartamento", kind: "Visita", time: "09:30", person: "Cliente interessado", property: "Apartamento 3 quartos", location: "Santa Amélia" },
  { id: "2", title: "Follow-up da proposta", kind: "Follow-up", time: "11:00", person: "Cliente comprador" },
  { id: "3", title: "Reunião de captação", kind: "Captação", time: "14:30", person: "Proprietário", property: "Casa com piscina", location: "Pampulha" },
  { id: "4", title: "Ligação de negociação", kind: "Ligação", time: "17:00", person: "Cliente comprador" },
];

const kindIcon = (kind: EventKind) => kind === "Visita" ? MapPin : kind === "Ligação" ? Phone : kind === "Reunião" ? Video : kind === "Captação" ? Plus : Clock3;

function Agenda() {
  return (
    <div className="main" style={{ minHeight: "100vh" }}>
      <header className="page-head">
        <div>
          <div className="eyebrow">IMOBFY · ROTINA COMERCIAL</div>
          <h1>Agenda</h1>
        </div>
        <button className="primary"><Plus size={18} />Novo compromisso</button>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 18 }}>
        <div className="card">
          <div className="card-head">
            <div><h3>Hoje</h3><span>Terça-feira, 8 de setembro</span></div>
            <button className="ghost">Semana <ChevronRight size={15} /></button>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {events.map(event => {
              const Icon = kindIcon(event.kind);
              return <div key={event.id} className="list-row" style={{ alignItems: "flex-start", padding: "16px 0" }}>
                <div style={{ width: 58, fontWeight: 800, fontSize: 13 }}>{event.time}</div>
                <div className="activity-icon"><Icon size={17} /></div>
                <div style={{ flex: 1 }}>
                  <b>{event.title}</b>
                  <span style={{ display: "block", marginTop: 4 }}>{event.kind}{event.person ? ` · ${event.person}` : ""}</span>
                  {(event.property || event.location) && <small style={{ display: "block", marginTop: 7 }}>{event.property}{event.property && event.location ? " · " : ""}{event.location}</small>}
                </div>
                <button className="icon-btn" aria-label="Abrir compromisso"><ChevronRight size={17} /></button>
              </div>;
            })}
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <div className="card">
            <div className="card-head"><div><h3>Resumo</h3><span>Sua operação hoje</span></div></div>
            <div style={{ display: "grid", gap: 14 }}>
              <Metric label="Compromissos" value="4" />
              <Metric label="Visitas" value="1" />
              <Metric label="Follow-ups" value="1" />
              <Metric label="Captações" value="1" />
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div><h3>Próximo passo</h3><span>Não deixe negócio esfriar</span></div></div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div className="activity-icon"><Users size={17} /></div>
              <div><b>Follow-up da proposta</b><span style={{ display: "block", marginTop: 4 }}>11:00 · Cliente comprador</span><small style={{ display: "block", marginTop: 8 }}>O Imobfy deve transformar cada compromisso em uma ação ligada ao cliente, imóvel e negócio.</small></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{label}</span><strong style={{ fontSize: 20 }}>{value}</strong></div>;
}
