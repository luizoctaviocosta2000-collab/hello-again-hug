import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, Home, Pencil, Plus, UserRound, X } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { restoreSession, type ImobfyUser } from "../lib/imobfy-session";
import { supabase } from "../lib/supabase";
import "../imobfy-clean.css";

type Client={id:string;name:string;phone:string|null};
type Property={id:string;title:string;neighborhood:string|null};
type Deal={id:string;client_id:string|null;property_id:string|null;status:string;stage?:string|null};
type Visit={id:string;client_id:string|null;deal_id:string|null;starts_at:string;ends_at:string|null;status:string;location:string|null;notes:string|null};
type VisitProperty={id:string;visit_id:string;property_id:string;sequence:number|null;visited:boolean;notes:string|null};
const todayKey=()=>new Date().toISOString().slice(0,10);
const dateLabel=(iso:string)=>new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
const statusLabel=(s:string)=>s==="done"||s==="completed"?"Concluído":s==="cancelled"||s==="canceled"?"Cancelado":"Agendado";

export default function ImobfyAgenda(){
 const navigate=useNavigate();const[user,setUser]=useState<ImobfyUser|null>(null);const[ready,setReady]=useState(false);
 const[clients,setClients]=useState<Client[]>([]),[properties,setProperties]=useState<Property[]>([]),[deals,setDeals]=useState<Deal[]>([]),[visits,setVisits]=useState<Visit[]>([]),[visitProperties,setVisitProperties]=useState<VisitProperty[]>([]);
 const[open,setOpen]=useState(false),[editing,setEditing]=useState<Visit|null>(null),[error,setError]=useState("");
 const[date,setDate]=useState(todayKey()),[time,setTime]=useState("10:00"),[clientId,setClientId]=useState(""),[dealId,setDealId]=useState(""),[propertyIds,setPropertyIds]=useState<string[]>([]),[location,setLocation]=useState(""),[notes,setNotes]=useState("");
 const[filter,setFilter]=useState<"today"|"upcoming"|"done">("today");
 async function load(uid:string){
  const[v,c,p,d,vp]=await Promise.all([
   supabase.from("visits").select("id,client_id,deal_id,starts_at,ends_at,status,location,notes").eq("user_id",uid).order("starts_at"),
   supabase.from("clients").select("id,name,phone").eq("user_id",uid).eq("status","active").order("name"),
   supabase.from("properties").select("id,title,neighborhood").eq("user_id",uid).eq("status","active").order("title"),
   supabase.from("deals").select("id,client_id,property_id,status,stage").eq("user_id",uid).order("created_at",{ascending:false}),
   supabase.from("visit_properties").select("id,visit_id,property_id,sequence,visited,notes").eq("user_id",uid).order("sequence")
  ]);
  if(v.error)throw v.error;if(c.error)throw c.error;if(p.error)throw p.error;if(d.error)throw d.error;if(vp.error)throw vp.error;
  setVisits((v.data??[]) as Visit[]);setClients((c.data??[]) as Client[]);setProperties((p.data??[]) as Property[]);setDeals((d.data??[]) as Deal[]);setVisitProperties((vp.data??[]) as VisitProperty[]);
 }
 useEffect(()=>{let active=true;void restoreSession().then(async s=>{if(!active)return;if(!s){void navigate({to:"/login"});return}setUser(s);try{await load(s.id)}catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar a agenda.")}finally{if(active)setReady(true)}});return()=>{active=false}},[navigate]);
 const visible=useMemo(()=>{const now=new Date(),key=todayKey();return visits.filter(v=>filter==="done"?["done","completed"].includes(v.status):filter==="today"&&v.starts_at.slice(0,10)===key&&!['done','completed','cancelled','canceled'].includes(v.status):filter==="upcoming"&&new Date(v.starts_at)>=now&&!['done','completed','cancelled','canceled'].includes(v.status))},[visits,filter]);
 const clientName=(id:string|null)=>clients.find(c=>c.id===id)?.name??"Sem cliente";
 const dealLabel=(id:string|null)=>{const d=deals.find(x=>x.id===id);if(!d)return "Sem negócio";return `${clientName(d.client_id)} · ${properties.find(p=>p.id===d.property_id)?.title??"Imóvel"}`};
 const propsFor=(visitId:string)=>visitProperties.filter(x=>x.visit_id===visitId).sort((a,b)=>(a.sequence??0)-(b.sequence??0)).map(x=>properties.find(p=>p.id===x.property_id)).filter(Boolean) as Property[];
 function resetForm(){setDate(todayKey());setTime("10:00");setClientId("");setDealId("");setPropertyIds([]);setLocation("");setNotes("");setEditing(null)}
 function openNew(){setError("");resetForm();setOpen(true)}
 function openEdit(v:Visit){setError("");setEditing(v);const d=new Date(v.starts_at);setDate(d.toISOString().slice(0,10));setTime(d.toTimeString().slice(0,5));setClientId(v.client_id||"");setDealId(v.deal_id||"");setPropertyIds(visitProperties.filter(x=>x.visit_id===v.id).sort((a,b)=>(a.sequence??0)-(b.sequence??0)).map(x=>x.property_id));setLocation(v.location||"");setNotes(v.notes||"");setOpen(true)}
 function toggleProperty(id:string){setPropertyIds(x=>x.includes(id)?x.filter(v=>v!==id):[...x,id])}
 async function save(){
  if(!user||!date||!time)return;setError("");const starts=new Date(`${date}T${time}:00`);const ends=new Date(starts.getTime()+60*60*1000);
  const payload={user_id:user.id,client_id:clientId||null,deal_id:dealId||null,starts_at:starts.toISOString(),ends_at:ends.toISOString(),status:editing?.status||"scheduled",location:location.trim()||null,notes:notes.trim()||null};
  const result=editing?await supabase.from("visits").update(payload).eq("id",editing.id).eq("user_id",user.id):await supabase.from("visits").insert(payload).select("id").single();
  if(result.error){setError(result.error.message);return}
  const visitId=editing?.id||result.data?.id;if(!visitId){setError("Não consegui identificar a visita.");return}
  const old=editing?await supabase.from("visit_properties").delete().eq("visit_id",visitId).eq("user_id",user.id):null;
  if(old?.error){setError(old.error.message);return}
  if(propertyIds.length){const rows=propertyIds.map((property_id,index)=>({user_id:user.id,visit_id:visitId,property_id,sequence:index+1,visited:false,notes:null}));const inserted=await supabase.from("visit_properties").insert(rows);if(inserted.error){setError(inserted.error.message);return}}
  await load(user.id);setOpen(false);resetForm();
 }
 async function setStatus(id:string,status:"done"|"cancelled"){if(!user)return;setError("");const{error:e}=await supabase.from("visits").update({status}).eq("id",id).eq("user_id",user.id);if(e)setError(e.message);else await load(user.id)}
 if(!ready||!user)return null;
 const initials=user.name.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase();
 return <div className="clean-app">
  <aside className="clean-sidebar"><div className="clean-brand"><div className="brand-symbol">I</div><div><strong>imobfy</strong><span>GESTÃO IMOBILIÁRIA</span></div></div><nav><span className="nav-section">OPERAÇÃO</span><Link to="/"><CalendarDays size={17}/><span>Visão geral</span></Link><Link to="/imoveis"><Home size={17}/><span>Imóveis</span></Link><Link to="/clientes"><UserRound size={17}/><span>Clientes</span></Link><Link to="/negocios"><Clock3 size={17}/><span>Negócios</span></Link><Link to="/agenda" className="active"><CalendarDays size={17}/><span>Agenda</span></Link><Link to="/comissoes"><Clock3 size={17}/><span>Comissões</span></Link><Link to="/vgv"><Clock3 size={17}/><span>Meu VGV</span></Link></nav><div className="sidebar-footer"><div className="profile-avatar">{initials}</div><div><strong>{user.name}</strong><span>Perfil profissional</span></div></div></aside>
  <main className="clean-main"><header className="clean-header"><div><span className="header-kicker">ROTINA COMERCIAL</span><h1>Agenda</h1><p>Visitas conectadas aos clientes, negócios e imóveis da jornada.</p></div><div className="header-actions"><button className="clean-button primary" onClick={openNew}><Plus size={16}/> Nova visita</button></div></header>
   <div className="content"><div className="clean-toolbar"><div className="period-tabs">{[["today","Hoje"],["upcoming","Próximos"],["done","Concluídos"]].map(([k,l])=><button key={k} className={filter===k?"selected":""} onClick={()=>setFilter(k as typeof filter)}>{l}</button>)}</div><span className="muted">{visible.length} visita(s)</span></div>
    {error&&<div className="notice"><strong>Ops.</strong> {error}</div>}
    <section className="clean-card table-card"><div className="card-title"><div><span className="label">VISITAS</span><h3>{filter==="today"?"Sua agenda de hoje":filter==="upcoming"?"Próximas visitas":"Histórico"}</h3></div></div>
     <div className="table">{visible.length?visible.map(v=>{const ps=propsFor(v.id);return <div className="table-row" key={v.id}><div><strong>{clientName(v.client_id)}</strong><small>{dateLabel(v.starts_at)}{v.location?` · ${v.location}`:""}</small></div><span>{ps.length?`${ps.length} imóvel(is)`:"Sem imóvel"}</span><span>{dealLabel(v.deal_id)}</span><span>{statusLabel(v.status)}</span><div className="row-actions">{!['done','completed','cancelled','canceled'].includes(v.status)&&<><button className="icon-button" title="Editar" onClick={()=>openEdit(v)}><Pencil size={15}/></button><button className="icon-button" title="Concluir" onClick={()=>void setStatus(v.id,"done")}><Check size={16}/></button><button className="icon-button" title="Cancelar" onClick={()=>void setStatus(v.id,"cancelled")}><X size={16}/></button></>}</div><small style={{gridColumn:"1 / -1"}}>{ps.map(p=>p.title).join(" · ")||v.notes||"Nenhum imóvel vinculado ainda."}</small></div>}) : <div className="empty"><strong>Nenhuma visita aqui.</strong><span>Agende uma visita e selecione todos os imóveis que serão apresentados ao cliente.</span></div>}</div>
    </section></div></main>
  {open&&<div className="mvp-overlay"><div className="mvp-modal"><button className="mvp-close" onClick={()=>{setOpen(false);resetForm()}}><X size={18}/></button><span className="label">{editing?"EDITAR VISITA":"NOVA VISITA"}</span><h2>{editing?"Editar visita":"Agendar visita"}</h2><p>Conecte cliente, negócio e todos os imóveis que serão apresentados.</p><div className="form-grid"><label>Data<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Hora<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label></div><label>Cliente<select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Selecione o cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Negócio<select value={dealId} onChange={e=>setDealId(e.target.value)}><option value="">Sem negócio</option>{deals.map(d=><option key={d.id} value={d.id}>{dealLabel(d.id)}</option>)}</select></label><label>Imóveis da visita<div style={{display:"grid",gap:7,maxHeight:190,overflowY:"auto",marginTop:6}}>{properties.map(p=><button key={p.id} type="button" onClick={()=>toggleProperty(p.id)} style={{textAlign:"left",padding:"10px 12px",border:"1px solid var(--border,#e7e2d8)",borderRadius:10,background:propertyIds.includes(p.id)?"#f5f0e5":"#fff",cursor:"pointer"}}><strong>{propertyIds.includes(p.id)?"✓ ":""}{p.title}</strong>{p.neighborhood?<small style={{display:"block",marginTop:2}}>{p.neighborhood}</small>:null}</button>)}</div></label><label>Local<input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Ex.: endereço ou ponto de encontro"/></label><label>Observações<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Objetivo da visita, próximos passos..."/></label><div className="mvp-actions"><button className="clean-button secondary" onClick={()=>{setOpen(false);resetForm()}}>Cancelar</button><button className="clean-button primary" onClick={()=>void save()}>{editing?"Salvar alterações":"Agendar visita"}</button></div></div></div>}
 </div>
}
