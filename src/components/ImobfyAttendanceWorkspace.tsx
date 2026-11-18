import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Clipboard, Headphones, MessageCircle, Plus, ShieldAlert } from "lucide-react";
import { supabase } from "../lib/supabase";
import { restoreSession } from "../lib/imobfy-session";
import { readableFunctionError } from "../lib/function-error";
import type { AttendanceBrief } from "../../supabase/functions/_shared/attendance-contract";
import ImobfyAttendanceSimulator from "./ImobfyAttendanceSimulator";
import "../imobfy-intelligence.css";
import "../imobfy-attendance-workspace.css";

type Thread = {
 id:string;user_id:string;client_id:string|null;property_id:string|null;
 status:"open"|"handoff"|"paused"|"closed";channel:string;updated_at:string;
};
type ThreadMessage = {id:string;thread_id:string;role:"customer"|"assistant_draft"|"agent_note";body:string;created_at:string};
type Client = {id:string;name:string};
type Property = {id:string;title:string};
type DraftResponse={draft?:string;brief?:AttendanceBrief;property_id?:string;mode?:string;error?:string};
type Status = "loading"|"ready"|"not_installed"|"error";
const labelStatus:Record<Thread["status"],string>={open:"Aberto",handoff:"Corretor",paused:"Pausado",closed:"Concluído"};

export default function ImobfyAttendanceWorkspace(){
 const [section,setSection]=useState<"inbox"|"lab">("inbox");
 const [userId,setUserId]=useState("");
 const [threads,setThreads]=useState<Thread[]>([]);
 const [messages,setMessages]=useState<ThreadMessage[]>([]);
 const [clients,setClients]=useState<Client[]>([]);
 const [properties,setProperties]=useState<Property[]>([]);
 const [active,setActive]=useState<string|null>(null);
 const [status,setStatus]=useState<Status>("loading");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [newClientId,setNewClientId]=useState("");
 const [newPropertyId,setNewPropertyId]=useState("");
 const [creating,setCreating]=useState(false);
 const [incoming,setIncoming]=useState("");
 const [draft,setDraft]=useState("");
 const [brief,setBrief]=useState<AttendanceBrief|null>(null);
 const current=useMemo(()=>threads.find(x=>x.id===active),[threads,active]);
 const currentMessages=useMemo(()=>messages.filter(m=>m.thread_id===active),[messages,active]);
 const clientName=(id:string|null)=>clients.find(x=>x.id===id)?.name||"Contato sem nome";
 const propertyName=(id:string|null)=>properties.find(x=>x.id===id)?.title||"Imóvel não selecionado";

 const reload=useCallback(async(uid:string)=>{
   const [t,m,c,p]=await Promise.all([
    supabase.from("imobfy_attendance_threads").select("id,user_id,client_id,property_id,status,channel,updated_at").eq("user_id",uid).order("updated_at",{ascending:false}).limit(100),
    supabase.from("imobfy_attendance_messages").select("id,thread_id,role,body,created_at").eq("user_id",uid).order("created_at",{ascending:false}).limit(300),
    supabase.from("clients").select("id,name").eq("user_id",uid).order("name").limit(500),
    supabase.from("properties").select("id,title").eq("user_id",uid).order("created_at",{ascending:false}).limit(200),
   ]);
   const failure=t.error||m.error||c.error||p.error;
   if(failure){
     if(failure.code==="42P01"||failure.code==="PGRST205"||/relation .* does not exist|Could not find the table/i.test(failure.message))setStatus("not_installed");
     else {setError(failure.message);setStatus("error");}
     return;
   }
   const list=(t.data||[]) as Thread[];
   setThreads(list);
   setMessages(((m.data||[]) as ThreadMessage[]).reverse());
   setClients((c.data||[]) as Client[]);
   setProperties((p.data||[]) as Property[]);
   setActive(current=>current&&list.some(x=>x.id===current)?current:list[0]?.id||null);
   setStatus("ready");
 },[]);
 useEffect(()=>{
  let alive=true;
  void (async()=>{
   const user=await restoreSession();
   if(!alive)return;
   if(!user){setStatus("error");setError("Faça login para acessar o atendimento.");return;}
   setUserId(user.id);await reload(user.id);
  })();
  return ()=>{alive=false};
 },[reload]);
 useEffect(()=>{setDraft("");setBrief(null);setError("");},[active]);

 async function newThread(){
  if(!userId||!newClientId){setError("Escolha um cliente cadastrado.");return;}
  setError("");setNotice("");setBusy(true);
  try{
   const {data,error:err}=await supabase.from("imobfy_attendance_threads")
    .insert({user_id:userId,client_id:newClientId,property_id:newPropertyId||null,channel:"manual",status:"open",automation_mode:"assisted"})
    .select("id").single();
   if(err)throw err;
   setCreating(false);setActive(data.id);setNewClientId("");setNewPropertyId("");
   setNotice("Conversa interna criada. Nada foi enviado ao cliente.");
   await reload(userId);
  }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível abrir a conversa.");}
  finally{setBusy(false)}
 }
 async function logMessage(){
  if(!current||!userId||!incoming.trim()){return;}
  const body=incoming.trim();
  if(body.length>4000){setError("Máximo de 4.000 caracteres.");return;}
  setBusy(true);setError("");
  try{
   const {error:err}=await supabase.from("imobfy_attendance_messages").insert({
     user_id:userId,thread_id:current.id,role:"customer",source:"manual",body,delivery_state:"internal",
   });
   if(err)throw err;
   setIncoming("");setDraft("");setBrief(null);
   setNotice("Mensagem registrada manualmente. Ela não foi recebida pelo WhatsApp nem enviada.");
   await reload(userId);
  }catch(cause){setError(cause instanceof Error?cause.message:"Não consegui registrar a mensagem.");}
  finally{setBusy(false)}
 }
 async function generateDraft(){
  if(!current?.property_id){setError("Associe um imóvel para gerar uma resposta baseada em dados.");return;}
  const last=[...currentMessages].reverse().find(m=>m.role==="customer");
  if(!last){setError("Registre primeiro a pergunta do interessado.");return;}
  setBusy(true);setError("");setDraft("");
  try{
   // No write tools and no outbound customer communication.
   const history=currentMessages.filter(m=>m.role==="customer"||m.role==="assistant_draft")
    .slice(-11).map(m=>({role:m.role==="customer"?"customer":"assistant",text:m.body}));
   const {data,error:err}=await supabase.functions.invoke<DraftResponse>("imobfy-attendance-simulate",{
    body:{property_id:current.property_id,message:last.body,history:history.slice(0,-1)},
   });
   if(err)throw err;
   if(data?.mode!=="simulator_only"||data.property_id!==current.property_id||!data.draft||!data.brief)
     throw new Error(data?.error||"A IA não retornou um rascunho válido.");
   setDraft(data.draft);setBrief(data.brief);
  }catch(cause){setError(await readableFunctionError(cause));}
  finally{setBusy(false)}
 }
 async function recordDraft(){
  if(!current||!userId||!draft)return;
  setBusy(true);setError("");
  try{
   const {error:err}=await supabase.from("imobfy_attendance_messages").insert({
     user_id:userId,thread_id:current.id,role:"assistant_draft",source:"manual",body:draft,delivery_state:"internal",
   });
   if(err)throw err;
   setNotice("Rascunho salvo para revisão interna. Não foi enviado ao cliente.");
   setDraft("");setBrief(null);await reload(userId);
  }catch(cause){setError(cause instanceof Error?cause.message:"Não consegui salvar o rascunho.");}
  finally{setBusy(false)}
 }
 async function changeStatus(next:Thread["status"]){
  if(!current||!userId)return;
  setBusy(true);setError("");
  const {error:err}=await supabase.from("imobfy_attendance_threads")
   .update({status:next,automation_mode:next==="paused"?"paused":"assisted",updated_at:new Date().toISOString()})
   .eq("id",current.id).eq("user_id",userId);
  if(err)setError(err.message);else{setNotice(next==="handoff"?"Encaminhamento ao corretor registrado.":"Estado atualizado.");await reload(userId);}
  setBusy(false);
 }
 async function copyDraft(){
  if(!draft)return;
  try{await navigator.clipboard.writeText(draft);setNotice("Texto copiado para avaliação humana; nenhum envio automático.");}
  catch{setError("Não foi possível copiar. Selecione o texto manualmente.");}
 }

 return <div className="intel-page">
  <header className="intel-head"><div><span className="intel-eyebrow"><Headphones size={16}/> IMOBFY / RELACIONAMENTO</span><h2>Atendimento inteligente<span>.</span></h2><p>Histórico interno, rascunhos de IA e encaminhamento humano. Primeiro a confiança, depois a automação.</p></div><div className="intel-tag"><ShieldAlert size={16}/> Envio automático desligado</div></header>
  <div className="intel-warning"><ShieldAlert size={17}/><span><strong>Nenhum contato automático está ativo.</strong> WhatsApp e Instagram dependem de integração oficial, consentimento, templates quando aplicáveis e aprovação. Mensagens internas registradas aqui não representam mensagens recebidas ou enviadas nessas plataformas.</span></div>
  <div className="attendance-tabs"><button type="button" className={section==="inbox"?"selected":""} onClick={()=>setSection("inbox")}>Conversa interna</button><button type="button" className={section==="lab"?"selected":""} onClick={()=>setSection("lab")}>Laboratório de IA</button></div>
  {section==="lab"?<ImobfyAttendanceSimulator/>:<>
   {error&&<p className="intel-error" role="alert">{error}</p>}
   {notice&&<p className="intel-success" role="status"><Check size={16}/>{notice}</p>}
   {status==="loading"&&<div className="intel-panel">Carregando conversas...</div>}
   {status==="not_installed"&&<div className="intel-panel"><strong>A caixa de atendimento ainda não foi ativada no banco.</strong><p>A migration de inteligência precisa ser aprovada e instalada. Use o Laboratório de IA para testar sem gravar no CRM.</p></div>}
   {status==="error"&&<div className="intel-panel"><button type="button" onClick={()=>userId&&void reload(userId)}>Tentar novamente</button></div>}
   {status==="ready"&&<div className="attendance-workspace">
    <aside className="intel-panel attendance-list"><div className="attendance-list-head"><h3><MessageCircle size={17}/> Conversas</h3><button type="button" onClick={()=>setCreating(x=>!x)}><Plus size={15}/> Nova</button></div>
     {creating&&<div className="attendance-create"><label>Cliente<select value={newClientId} onChange={e=>setNewClientId(e.target.value)}><option value="">Selecione um cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Imóvel vinculado<select value={newPropertyId} onChange={e=>setNewPropertyId(e.target.value)}><option value="">Nenhum</option>{properties.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      <button disabled={busy||!newClientId} type="button" onClick={()=>void newThread()}>Criar conversa interna</button></div>}
     {threads.length===0?<p>Nenhuma conversa registrada. Abra uma para organizar o atendimento.</p>:
      threads.map(t=><button type="button" key={t.id} className={t.id===active?"attendance-thread selected":"attendance-thread"} onClick={()=>setActive(t.id)}><strong>{clientName(t.client_id)}</strong><small>{propertyName(t.property_id)}</small><span>{labelStatus[t.status]} · Interno</span></button>)}
    </aside>
    <section className="intel-panel attendance-chat">
     {!current?<div className="attendance-empty"><MessageCircle size={28}/><h3>Escolha ou crie uma conversa</h3><p>O histórico e os rascunhos aparecerão aqui.</p></div>:<>
      <div className="attendance-convo-head"><div><h3>{clientName(current.client_id)}</h3><p>{propertyName(current.property_id)} · canal interno · {labelStatus[current.status]}</p></div>
       <div className="attendance-actions"><button type="button" disabled={busy} onClick={()=>void changeStatus("handoff")}>Encaminhar ao corretor</button><button type="button" disabled={busy} onClick={()=>void changeStatus(current.status==="paused"?"open":"paused")}>{current.status==="paused"?"Retomar":"Pausar"}</button></div>
      </div>
      <div className="attendance-messages" role="log" aria-label="Histórico interno">
       {currentMessages.length===0&&<p>Nenhuma mensagem. Registre a pergunta recebida para começar.</p>}
       {currentMessages.map(m=><div key={m.id} className={"attendance-message "+m.role}><small>{m.role==="customer"?"PERGUNTA REGISTRADA":m.role==="assistant_draft"?"RASCUNHO DA IA":"NOTA INTERNA"}</small><p>{m.body}</p></div>)}
      </div>
      <div className="attendance-composer"><label>Pergunta do interessado (registro manual)<textarea maxLength={4000} rows={3} value={incoming} onChange={e=>setIncoming(e.target.value)} placeholder="Registre o que o lead realmente perguntou..."/></label>
       <div className="attendance-actions"><button type="button" disabled={busy||!incoming.trim()} onClick={()=>void logMessage()}>Registrar pergunta</button><button type="button" disabled={busy||!current.property_id||currentMessages.every(m=>m.role!=="customer")} onClick={()=>void generateDraft()}>Gerar rascunho com IA <ArrowRight size={15}/></button></div>
      </div>
      {brief?.handoff_required&&<div className="intel-warning">A IA sugeriu encaminhamento humano: {brief.handoff_reason||"negociação ou solicitação de pessoa"}</div>}
      {draft&&<div className="attendance-draft"><span>RASCUNHO PARA REVISÃO HUMANA — NÃO ENVIADO</span><p>{draft}</p><div className="attendance-actions"><button type="button" disabled={busy} onClick={()=>void copyDraft()}><Clipboard size={15}/> Copiar</button><button type="button" disabled={busy} onClick={()=>void recordDraft()}>Salvar rascunho interno</button></div></div>}
     </>}
    </section>
   </div>}
  </>}
 </div>;
}
