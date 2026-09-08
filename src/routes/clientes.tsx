import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Mail, Phone, Plus, Search, SlidersHorizontal, UserRound } from "lucide-react";

export const Route = createFileRoute("/clientes")({ component: Clientes });

type Client = { id: string; name: string; profile: string; neighborhood: string; budget: string; nextAction: string; status: "Quente" | "Em acompanhamento" | "Novo" };

const clients: Client[] = [
  { id: "1", name: "Cliente comprador", profile: "Comprador", neighborhood: "Pampulha", budget: "R$ 900 mil", nextAction: "Follow-up hoje", status: "Quente" },
  { id: "2", name: "Proprietário", profile: "Vendedor", neighborhood: "Santa Amélia", budget: "R$ 1,2 mi", nextAction: "Captação amanhã", status: "Em acompanhamento" },
  { id: "3", name: "Novo lead", profile: "Comprador", neighborhood: "Planalto", budget: "R$ 650 mil", nextAction: "Qualificar lead", status: "Novo" },
];

function Clientes() {
  return <div className="main" style={{ minHeight: "100vh" }}>
    <header className="page-head">
      <div><div className="eyebrow">IMOBFY · CRM</div><h1>Clientes</h1></div>
      <button className="primary"><Plus size={18} />Novo cliente</button>
    </header>

    <div className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="search-box" style={{ flex: 1, minWidth: 240 }}><Search size={17} /><input placeholder="Buscar cliente por nome, bairro ou telefone" /></div>
        <button className="ghost"><SlidersHorizontal size={16} />Filtros</button>
      </div>
    </div>

    <div className="card">
      <div className="card-head"><div><h3>Minha carteira</h3><span>Clientes e próximos passos comerciais</span></div><span>{clients.length} contatos</span></div>
      <div>
        {clients.map(client => <div className="list-row" key={client.id} style={{ padding: "17px 0" }}>
          <div className="avatar" style={{ flexShrink: 0 }}><UserRound size={17} /></div>
          <div style={{ flex: 1 }}><b>{client.name}</b><span style={{ display: "block", marginTop: 4 }}>{client.profile} · {client.neighborhood}</span></div>
          <div className="desktop-only" style={{ textAlign: "right" }}><b>{client.budget}</b><span style={{ display: "block", marginTop: 4 }}>{client.nextAction}</span></div>
          <span className="status-badge">{client.status}</span>
          <div style={{ display: "flex", gap: 4 }}><button className="icon-btn"><Phone size={15} /></button><button className="icon-btn"><Mail size={15} /></button><button className="icon-btn"><ChevronRight size={17} /></button></div>
        </div>)}
      </div>
    </div>

    <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 18 }}>
      <Insight title="Leads quentes" value="1" text="Precisam de contato hoje" />
      <Insight title="Sem follow-up" value="0" text="Nenhum cliente abandonado" />
      <Insight title="Perfil comprador" value="2" text="Com faixa de preço definida" />
    </div>
  </div>;
}

function Insight({ title, value, text }: { title: string; value: string; text: string }) {
  return <div className="card"><span>{title}</span><strong style={{ display: "block", fontSize: 28, marginTop: 8 }}>{value}</strong><small style={{ display: "block", marginTop: 5 }}>{text}</small></div>;
}
