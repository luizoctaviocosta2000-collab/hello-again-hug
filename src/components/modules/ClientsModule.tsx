import { useMemo, useState } from "react";
import { Mail, Pencil, Phone, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import {
  CLIENT_PROFILE_LABELS,
  CLIENT_STATUS_LABELS,
  createClientId,
  type Client,
  type ClientProfile,
  type ClientStatus,
} from "../../lib/imobfy-crm";
import { IMOBFY_STORAGE_KEYS, loadImobfyList, saveImobfyList } from "../../lib/imobfy-storage";

type FormState = {
  name: string;
  phone: string;
  email: string;
  profile: ClientProfile;
  status: ClientStatus;
  neighborhoods: string;
  propertyTypes: string;
  maxPrice: string;
  bedrooms: string;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  phone: "",
  email: "",
  profile: "buyer",
  status: "lead",
  neighborhoods: "",
  propertyTypes: "",
  maxPrice: "",
  bedrooms: "",
  notes: "",
};

const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

const onlyDigits = (value: string) => Number(value.replace(/[^0-9]/g, "")) || 0;

function toForm(client: Client): FormState {
  return {
    name: client.name,
    phone: client.phone ?? "",
    email: client.email ?? "",
    profile: client.profile,
    status: client.status,
    neighborhoods: (client.neighborhoods ?? []).join(", "),
    propertyTypes: (client.propertyTypes ?? []).join(", "),
    maxPrice: client.maxPrice ? String(client.maxPrice) : "",
    bedrooms: client.bedrooms ? String(client.bedrooms) : "",
    notes: client.notes ?? "",
  };
}

function sanitize(list: unknown): Client[] {
  if (!Array.isArray(list)) return [];
  return list.filter((item): item is Client => Boolean(item && typeof item === "object" && typeof (item as Client).name === "string"));
}

export default function ClientsModule() {
  const [clients, setClients] = useState<Client[]>(() => sanitize(loadImobfyList<Client>(IMOBFY_STORAGE_KEYS.clients)));
  const [query, setQuery] = useState("");
  const [profileFilter, setProfileFilter] = useState<ClientProfile | "">("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "">("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter(client => {
      const haystack = [client.name, client.phone, client.email, ...(client.neighborhoods ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (profileFilter && client.profile !== profileFilter) return false;
      if (statusFilter && client.status !== statusFilter) return false;
      return true;
    });
  }, [clients, query, profileFilter, statusFilter]);

  const persist = (next: Client[]) => {
    setClients(next);
    saveImobfyList(IMOBFY_STORAGE_KEYS.clients, next);
  };

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const startEdit = (client: Client) => {
    setEditingId(client.id);
    setForm(toForm(client));
    setOpen(true);
  };

  const splitList = (value: string) =>
    value
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);

  const save = () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    const now = new Date().toISOString();
    const base = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      profile: form.profile,
      status: form.status,
      neighborhoods: splitList(form.neighborhoods),
      propertyTypes: splitList(form.propertyTypes),
      maxPrice: onlyDigits(form.maxPrice),
      bedrooms: onlyDigits(form.bedrooms),
      notes: form.notes.trim(),
      updatedAt: now,
    };
    if (editingId) {
      persist(clients.map(client => (client.id === editingId ? { ...client, ...base } : client)));
      toast.success("Cliente atualizado.");
    } else {
      persist([{ id: createClientId(), createdAt: now, ...base }, ...clients]);
      toast.success("Cliente adicionado à carteira.");
    }
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const remove = (client: Client) => {
    if (!window.confirm(`Excluir ${client.name}?`)) return;
    persist(clients.filter(item => item.id !== client.id));
    toast.success("Cliente removido.");
  };

  const counts = {
    lead: clients.filter(client => client.status === "lead").length,
    active: clients.filter(client => client.status === "qualified" || client.status === "active").length,
    converted: clients.filter(client => client.status === "converted").length,
  };

  return (
    <section className="module">
      <div className="toolbar">
        <div>
          <div className="overline">CRM</div>
          <h2 className="module-title">Clientes</h2>
          <span className="module-sub">Centralize relacionamento, perfil de compra e próximos passos.</span>
        </div>
        <button className="primary" onClick={startNew}>
          <Plus size={18} />
          Novo cliente
        </button>
      </div>

      <div className="metrics three">
        <div className="metric">
          <div className="metric-top"><span>Leads</span></div>
          <strong>{counts.lead}</strong>
        </div>
        <div className="metric">
          <div className="metric-top"><span>Em atendimento</span></div>
          <strong>{counts.active}</strong>
        </div>
        <div className="metric accent">
          <div className="metric-top"><span>Convertidos</span></div>
          <strong>{counts.converted}</strong>
        </div>
      </div>

      <div className="card filter-bar">
        <div className="search">
          <Search size={16} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Buscar por nome, bairro, telefone ou e-mail"
            aria-label="Buscar cliente"
          />
        </div>
        <select value={profileFilter} onChange={event => setProfileFilter(event.target.value as ClientProfile | "")} aria-label="Filtrar por perfil">
          <option value="">Todos os perfis</option>
          {Object.entries(CLIENT_PROFILE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as ClientStatus | "")} aria-label="Filtrar por status">
          <option value="">Todos os status</option>
          {Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <b>Minha carteira</b>
            <span>{filtered.length} {filtered.length === 1 ? "contato" : "contatos"}</span>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><UserRound size={17} /></div>
            <b>{clients.length ? "Nenhum cliente para esse filtro" : "Nenhum cliente ainda"}</b>
            <span>{clients.length ? "Ajuste a busca ou os filtros." : "Comece sua carteira e conecte clientes aos seus negócios."}</span>
          </div>
        ) : (
          <div className="client-list">
            {filtered.map(client => (
              <div className="client-row" key={client.id}>
                <div className="client-avatar"><UserRound size={17} /></div>
                <div className="client-main">
                  <b>{client.name}</b>
                  <span>
                    {CLIENT_PROFILE_LABELS[client.profile]}
                    {client.neighborhoods?.length ? ` · ${client.neighborhoods.join(", ")}` : ""}
                  </span>
                </div>
                <div className="client-meta">
                  <b>{client.maxPrice ? `Até ${brl(client.maxPrice)}` : "Faixa não definida"}</b>
                  <span className="badge">{CLIENT_STATUS_LABELS[client.status]}</span>
                </div>
                <div className="client-actions">
                  {client.phone && (
                    <a className="icon-btn" href={`tel:${client.phone}`} aria-label={`Ligar para ${client.name}`}><Phone size={15} /></a>
                  )}
                  {client.email && (
                    <a className="icon-btn" href={`mailto:${client.email}`} aria-label={`Enviar e-mail para ${client.name}`}><Mail size={15} /></a>
                  )}
                  <button className="icon-btn" onClick={() => startEdit(client)} aria-label={`Editar ${client.name}`}><Pencil size={15} /></button>
                  <button className="danger-icon" onClick={() => remove(client)} aria-label={`Excluir ${client.name}`}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="overlay" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={editingId ? "Editar cliente" : "Novo cliente"}>
            <div className="modal-head">
              <div>
                <span className="overline">IMOBFY · CRM</span>
                <h2>{editingId ? "Editar cliente" : "Novo cliente"}</h2>
              </div>
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Nome</span>
                <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Nome completo" autoFocus />
              </label>
              <label className="field">
                <span>Telefone</span>
                <input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="(31) 99999-9999" />
              </label>
              <label className="field">
                <span>E-mail</span>
                <input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="cliente@email.com" />
              </label>
              <label className="field">
                <span>Perfil</span>
                <select value={form.profile} onChange={event => setForm({ ...form, profile: event.target.value as ClientProfile })}>
                  {Object.entries(CLIENT_PROFILE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as ClientStatus })}>
                  {Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Quartos desejados</span>
                <input inputMode="numeric" value={form.bedrooms} onChange={event => setForm({ ...form, bedrooms: event.target.value })} placeholder="Ex.: 3" />
              </label>
              <label className="field">
                <span>Bairros de interesse</span>
                <input value={form.neighborhoods} onChange={event => setForm({ ...form, neighborhoods: event.target.value })} placeholder="Ex.: Savassi, Lourdes" />
              </label>
              <label className="field">
                <span>Tipos de imóvel</span>
                <input value={form.propertyTypes} onChange={event => setForm({ ...form, propertyTypes: event.target.value })} placeholder="Ex.: Apartamento, Cobertura" />
              </label>
              <label className="field">
                <span>Faixa de preço (máximo)</span>
                <input inputMode="numeric" value={form.maxPrice} onChange={event => setForm({ ...form, maxPrice: event.target.value })} placeholder="Ex.: 900000" />
              </label>
              <label className="field wide">
                <span>Observações</span>
                <input value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Perfil, preferências e contexto..." />
              </label>
            </div>
            <div className="modal-actions">
              <button className="outline" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="primary" onClick={save}>{editingId ? "Salvar alterações" : "Salvar cliente"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
