import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, Home, Pencil, Plus, UserRound, X } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import { supabase } from "../lib/supabase";
import "../imobfy-clean.css";

type Client={id:string;name:string;phone:string|null};
type Property={id:string;title:string;neighborhood:string|null};
type Deal={id:string;client_id:string|null;property_id:string|null;status:string};
type Appointment={id:string;client_id:string|null;property_id:string|null;deal_id:string|null;title:string;starts_at:string;ends_at:string|null;status:string;notes:string|null};
const todayKey=()=>new Date().toISOString().slice(0,10);
const moneyDate=(iso:string)=>new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
const statusLabel=(s:string)=>s==="done"?"Concluído":s==="cancelled"?"Cancelado":"Agendado";

export default function ImobfyAgenda(){
 const navigate=useNavigate();const[user,setUser]=useState<ImobfyUser|null>(null);const[ready,setReady]=useState(false);
 const[clients,setClients]=useState<Client[]>([]),[properties,setProperties]=useState<Property[]>([]),[deals,setDeals]=useState<Deal[]>([]),[appointments,setAppointments]=useState<Appointment[]>([]);
 const[open,setOpen]=useState(false),[editing,setEditing]=useState<Appointment|null>(null),[error,setError]=useState("");
 const[title,setTitle]=useState(""),[date,setDate]=useState(todayKey()),[time,setTime]=useState("10:00"),[clientId,setClientId]=useState(""),[propertyId,setPropertyId]=useState(""),[dealId,setDealId]=useState(""),[notes,setNotes]=useState("");
 const[filter,setFilter]=useState<"today"|"upcoming"|"done">("today");
 async function load(uid:string){
  const[a,c,p,d]=await Promise.all([
   supabase.from("appointments").select("id,client_id,property_id,deal_id,title,starts_at,ends_at,status,notes").eq("user_id",uid).order("starts_at"),
   supabase.from("clients").select("id,name,phone").eq("user_id",uid).eq("status","active").order("name"),
   supabase.from("properties").select("id,title,neighborhood").eq("user_id",uid).eq("status","active").order("title"),
   supabase.from("deals").select("id,client_id,property_id,status").eq("user_id",uid).order("created_at",{ascending:false})
  ]);
  if(a.error)throw a.error;if(c.error)throw c.error;if(p.error)throw p.error;if(d.error)throw d.error;
  setAppointments((a.data??[]) as Appointment[]);setClients((c.data??[]) as Client[]);setProperties((p.data??[]) as Property[]);setDeals((d.data??[]) as Deal[]);
 }
 useEffect(()=>{let active=true;void restoreSession().then(async s=>{if(!active)return;if(!s){void navigate({to:"/login"});return}setUser(s);try{await load(s.id)}catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar a agenda.")}finally{if(active)setReady(true)}});return()=>{active=false}},[navigate]);
 const visible=useMemo(()=>{const now=new Date(),key=todayKey();return appointments.filter(a=>filter==="done"?a.status==="done":filter==="today"?a.starts_at.slice(0,10)===key&&a.status!=="done":new Date(a.starts_at)>=now&&a.status!=="done")},[appointments,filter]);
 function resetForm(){setTitle("");setDate(todayKey());setTime("10:00");setClientId("");setPropertyId("");setDealId("");setNotes("");setEditing(null)}
 function openNew(){setError("");resetForm();setOpen(true)}
 function openEdit(a:Appointment){setError("");setEditing(a);setTitle(a.title);const d=new Date(a.starts_at);setDate(d.toISOString().slice(0,10));setTime(d.toTimeString().slice(0,5));setClientId(a.client_id||"");setPropertyId(a.property_id||"");setDealId(a.deal_id||"");setNotes(a.notes||"");setOpen(true)}
 async function save(){
  if(!user||!title.trim()||!date||!time)return;setError("");const starts=new Date(`${date}T${time}:00`);const ends=new Date(starts.getTime()+60*60*1000);
  const payload={title:title.trim(),starts_at:starts.toISOString(),ends_at:ends.toISOString(),client_id:clientId||null,property_id:propertyId||null,deal_id:dealId||null,notes:notes.trim()||null};
  const result=editing?await supabase.from("appointments").update(payload).eq("id",editing.id).eq("user_id",user.id):await supabase.from("appointments").insert({...payload,user_id:user.id,status:"scheduled"});
  if(result.error){setError(result.error.message);return}await load(user.id);setOpen(false);resetForm();
 }
 async function setStatus(id:string,status:"done"|"cancelled"){
  if(!user)return;setError("");const{error:e}=await supabase.from("appointments").update({status}).eq("id",id).eq("user_id",user.id);if(e)setError(e.message);else await load(user.id)
 }
 if(!ready||!user)return null;
 const initials=user.name.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase();
 return <div className="clean-app">
  <aside className="clean-sidebar"><div className="clean-brand"><div className="brand-symbol">I</div><div><strong>imobfy</strong><span>GESTÃO IMOBILIÁRIA</span></div></div><nav><span className="nav-section">OPERAÇÃO</span><Link to="/"><CalendarDays size={17}/><span>Visão geral</span></Link><Link to="/imoveis"><Home size={17}/><span>Imóveis</span></Link><Link to="/clientes"><UserRound size={17}/><span>Clientes</span></Link><Link to="/negocios"><Clock3 size={17}/><span>Negócios</span></Link><Link to="/agenda" className="active"><CalendarDays size={17}/><span>Agenda</span></Link><Link to="/comissoes"><Clock3 size={17}/><span>Comissões</span></Link><Link to="/vgv"><Clock3 size={17}/><span>Meu VGV</span></Link></nav><div className="sidebar-footer"><div className="profile-avatar">{initials}</div><div><strong>{user.name}</strong><span>Perfil profissional</span></div></div></aside>
  <main className="clean-main"><header className="clean-header"><div><span className="header-kicker">ROTINA COMERCIAL</span><h1>Agenda</h1><p>Visitas, reuniões e próximos passos conectados aos seus negócios.</p></div><div className="header-actions"><button className="clean-button primary" onClick={openNew}><Plus size={16}/> Novo compromisso</button></div></header>
   <div className="content"><div className="clean-toolbar"><div className="period-tabs">{[["today","Hoje"],["upcoming","Próximos"],["done","Concluídos"]].map(([k,l])=><button key={k} className={filter===k?"selected":""} onClick={()=>setFilter(k as typeof filter)}>{l}</button>)}</div><span className="muted">{visible.length} compromisso(s)</span></div>
    {error&&<div className="notice"><strong>Ops.</strong> {error}</div>}
    <section className="clean-card table-card"><div className="card-title"><div><span className="label">COMPROMISSOS</span><h3>{filter==="today"?"Sua agenda de hoje":filter==="upcoming"?"Próximos compromissos":"Histórico"}</h3></div></div>
     <div className="table">{visible.length?visible.map(a=>{const c=clients.find(x=>x.id===a.client_id),p=properties.find(x=>x.id===a.property_id);return <div className="table-row" key={a.id}><div><strong>{a.title}</strong><small>{moneyDate(a.starts_at)}{a.notes?` · ${a.notes}`:""}</small></div><span>{c?.name??"Sem cliente"}</span><span>{p?.title??"Sem imóvel"}</span><span>{statusLabel(a.status)}</span><div className="row-actions">{a.status!=="done"&&a.status!=="cancelled"&&<><button className="icon-button" title="Editar" onClick={()=>openEdit(a)}><Pencil size={15}/></button><button className="icon-button" title="Concluir" onClick={()=>void setStatus(a.id,"done")}><Check size={16}/></button><button className="icon-button" title="Cancelar" onClick={()=>void setStatus(a.id,"cancelled")}><X size={16}/></button></>}</div></div>}) : <div className="empty"><strong>Nenhum compromisso aqui.</strong><span>Crie uma visita ou reunião e conecte cliente, imóvel e negócio.</span></div>}</div>
    </section></div></main>
  {open&&<div className="mvp-overlay"><div className="mvp-modal"><button className="mvp-close" onClick={()=>{setOpen(false);resetForm()}}><X size={18}/></button><span className="label">{editing?"EDITAR AÇÃO":"NOVA AÇÃO"}</span><h2>{editing?"Editar compromisso":"Adicionar compromisso"}</h2><p>Deixe o próximo passo registrado e conectado à operação.</p><label>Título<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Visita ao apartamento"/></label><div className="form-grid"><label>Data<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Hora<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label></div><label>Cliente<select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Sem cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Imóvel<select value={propertyId} onChange={e=>setPropertyId(e.target.value)}><option value="">Sem imóvel</option>{properties.map(p=><option key={p.id} value={p.id}>{p.title}{p.neighborhood?` · ${p.neighborhood}`:""}</option>)}</select></label><label>Negócio<select value={dealId} onChange={e=>setDealId(e.target.value)}><option value="">Sem negócio</option>{deals.map(d=><option key={d.id} value={d.id}>{clients.find(c=>c.id===d.client_id)?.name??"Negócio"} · {properties.find(p=>p.id===d.property_id)?.title??"Imóvel"}</option>)}</select></label><label>Observações<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Local, próximo passo, lembrete..."/></label><div className="mvp-actions"><button className="clean-button secondary" onClick={()=>{setOpen(false);resetForm()}}>Cancelar</button><button className="clean-button primary" onClick={()=>void save()}>{editing?"Salvar alterações":"Salvar compromisso"}</button></div></div></div>}
 </div>
}