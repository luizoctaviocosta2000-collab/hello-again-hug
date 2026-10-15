import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronRight, Filter, Home, Loader2, Pencil, Plus, Search, UserRound, X, ImagePlus, Sparkles, Trash2, ArrowUp, ArrowDown, Mic, Square, Link2, Copy, ExternalLink, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";
import { type ImobfyUser } from "../lib/imobfy-session";

 type Owner = { id: string; name: string; phone: string | null; email: string | null };
 type Property = {
  id: string; property_code: string | null; title: string; property_type: string | null; purpose: string;
  status: string; neighborhood: string | null; city: string | null; address: string | null; address_number: string | null;
  address_complement: string | null; zip_code: string | null; bedrooms: number | null; suites: number | null;
  bathrooms: number | null; parking_spaces: number | null; area_m2: number | null; asking_price: number | null;
  owner_name: string | null; owner_phone: string | null; description: string | null; condominium_fee: number | null;
  iptu_amount: number | null; habite_se: string | null; origin: string | null; capture_date: string | null;
  exclusivity: boolean; commercial_notes: string | null;
 };
 type Capture = { id: string; property_id: string; owner_id: string | null; capture_type: string; captured_at: string; origin: string | null; commission_pct: number; status: string; notes: string | null };
 const emptyForm = { title:"", property_code:"", property_type:"Apartamento", purpose:"venda", status:"ativo", neighborhood:"", city:"Belo Horizonte", address:"", address_number:"", address_complement:"", zip_code:"", bedrooms:"", suites:"", bathrooms:"", parking_spaces:"", area_m2:"", asking_price:"", condominium_fee:"", iptu_amount:"", habite_se:"", origin:"", exclusivity:false, description:"", commercial_notes:"", owner_id:"", capture_type:"normal", capture_origin:"" };
 const money=(v:number|null|undefined)=>v==null?"—":v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 const statusLabel:Record<string,string>={ativo:"Ativo",reservado:"Reservado",vendido:"Vendido",inativo:"Inativo"};
 const captureLabel:Record<string,string>={normal:"Captação própria",exclusive:"Exclusiva",shared:"Meiada"};

 export default function ImobfyImoveisCore({user}:{user:ImobfyUser}){
  const [properties,setProperties]=useState<Property[]>([]); const [owners,setOwners]=useState<Owner[]>([]); const [captures,setCaptures]=useState<Capture[]>([]);
  const [selected,setSelected]=useState<Property|null>(null); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [notice,setNotice]=useState("");
  const [query,setQuery]=useState(""); const [status,setStatus]=useState("todos"); const [showForm,setShowForm]=useState(false); const [showOwner,setShowOwner]=useState(false); const [showPhotoManager,setShowPhotoManager]=useState(false); const [photoProperty,setPhotoProperty]=useState<Property|null>(null); const [editing,setEditing]=useState<Property|null>(null); const [form,setForm]=useState({...emptyForm});
  const [ownerForm,setOwnerForm]=useState({name:"",phone:"",email:""}); const [showShareModal,setShowShareModal]=useState(false); const [shareProperty,setShareProperty]=useState<Property|null>(null); const [shareLink,setShareLink]=useState(""); const [shareActive,setShareActive]=useState(false); const [shareBusy,setShareBusy]=useState(false);
  type NewPhoto={id:string;file:File;preview:string;category:string}; type SavedPhoto={id:string;url:string;category:string;sort_order:number;is_cover:boolean;storage_path:string};
  const [newPhotos,setNewPhotos]=useState<NewPhoto[]>([]); const [savedPhotos,setSavedPhotos]=useState<SavedPhoto[]>([]); const [sortingPhotos,setSortingPhotos]=useState(false); const [photoInputKey,setPhotoInputKey]=useState(0);
  const [isRecordingAudio,setIsRecordingAudio]=useState(false); const [parsingAudio,setParsingAudio]=useState(false); const audioRecorder=useRef<MediaRecorder|null>(null); const audioChunks=useRef<Blob[]>([]);
  const photoCategories:Record<string,string>={fachada:"Fachada",sala:"Sala",cozinha:"Cozinha",area_servico:"Área de serviço",quarto:"Quarto",banheiro:"Banheiro",varanda:"Varanda",area_externa:"Área externa",garagem:"Garagem",condominio:"Condomínio",planta:"Planta",outros:"Outros"};
  const ownerMap=useMemo(()=>new Map(owners.map(o=>[o.id,o])),[owners]); const captureMap=useMemo(()=>new Map(captures.map(c=>[c.property_id,c])),[captures]);
  const filtered=properties.filter(p=>{const text=[p.title,p.property_code,p.neighborhood,p.city,p.owner_name].filter(Boolean).join(" ").toLowerCase(); return (status==="todos"||p.status===status)&&text.includes(query.toLowerCase())});

  async function openShare(p:Property){
   setShareProperty(p);setShareLink("");setShareActive(false);setShowShareModal(true);setShareBusy(true);setNotice("");
   try{
    const {data,error}=await supabase.functions.invoke("imobfy-property-share",{body:{action:"create",propertyId:p.id}});
    if(error||!data?.token)throw new Error(data?.error||error?.message||"Não consegui gerar o link.");
    setShareLink(window.location.origin+"/p/"+data.token);setShareActive(Boolean(data.active));
   }catch(error){setNotice(error instanceof Error?error.message:"Não consegui gerar o link do imóvel.");setShowShareModal(false)}
   finally{setShareBusy(false)}
  }
  async function deactivateShare(){
   if(!shareProperty)return;setShareBusy(true);
   try{const {data,error}=await supabase.functions.invoke("imobfy-property-share",{body:{action:"deactivate",propertyId:shareProperty.id}});if(error||!data?.ok)throw new Error(data?.error||error?.message||"Não consegui desativar o link.");setShareActive(false);setShareLink("");setNotice("Link público desativado. O cliente não poderá mais acessar a página.");}
   catch(error){setNotice(error instanceof Error?error.message:"Não consegui desativar o link.")}
   finally{setShareBusy(false)}
  }
  async function copyShareLink(){if(!shareLink)return;try{await navigator.clipboard.writeText(shareLink);setNotice("Link copiado! Agora é só enviar para o cliente.")}catch{setNotice("Não consegui copiar automaticamente. Selecione e copie o link manualmente.")}}
  async function load(){setLoading(true); const [p,o,c]=await Promise.all([
   supabase.from("properties").select("id,property_code,title,property_type,purpose,status,neighborhood,city,address,address_number,address_complement,zip_code,bedrooms,suites,bathrooms,parking_spaces,area_m2,asking_price,owner_name,owner_phone,description,condominium_fee,iptu_amount,habite_se,origin,capture_date,exclusivity,commercial_notes").eq("user_id",user.id).order("created_at",{ascending:false}),
   supabase.from("owners").select("id,name,phone,email").eq("user_id",user.id).order("name"), supabase.from("captures").select("id,property_id,owner_id,capture_type,captured_at,origin,commission_pct,status,notes").eq("user_id",user.id).eq("status","active")
  ]); if(p.error||o.error||c.error)setNotice("Não consegui carregar todo o inventário."); setProperties((p.data||[]) as Property[]);setOwners((o.data||[]) as Owner[]);setCaptures((c.data||[]) as Capture[]);setLoading(false)}
  useEffect(()=>{void load()},[user.id]);
  function openNew(){setEditing(null);setForm({...emptyForm});setNewPhotos([]);setSavedPhotos([]);setNotice("");setShowForm(true)}
  function openPhotos(p:Property){setPhotoProperty(p);setNewPhotos([]);setSavedPhotos([]);setNotice("");setShowPhotoManager(true);void loadSavedPhotos(p.id)}
  function openEdit(p:Property){const c=captureMap.get(p.id);setEditing(p);setNewPhotos([]);setSavedPhotos([]);setForm({...emptyForm,...Object.fromEntries(Object.entries(p).map(([k,v])=>[k,v==null?"":String(v)])),exclusivity:p.exclusivity,owner_id:c?.owner_id||"",capture_type:c?.capture_type||"normal",capture_origin:c?.origin||p.origin||""});setShowForm(true);void loadSavedPhotos(p.id)}

  async function loadSavedPhotos(propertyId:string){const {data,error}=await supabase.from("property_photos").select("id,storage_path,category,sort_order,is_cover").eq("user_id",user.id).eq("property_id",propertyId).order("sort_order");if(error){setNotice("Não consegui carregar fotos. A migração da galeria precisa estar aplicada.");return}setSavedPhotos(await Promise.all((data||[]).map(async row=>{const r=await supabase.storage.from("property-photos").createSignedUrl(row.storage_path,3600);return {...row,url:r.data?.signedUrl||""}})) as SavedPhoto[])}
  function addPhotos(files:FileList|null){if(!files)return;const valid=Array.from(files).filter(f=>/^image\/(jpeg|png|webp|avif)$/.test(f.type)&&f.size<=12*1024*1024);if(valid.length!==files.length)setNotice("Algumas fotos foram ignoradas. Use JPG, PNG, WEBP ou AVIF de até 12 MB.");setNewPhotos(old=>[...old,...valid.map(file=>({id:crypto.randomUUID(),file,preview:URL.createObjectURL(file),category:"outros"}))].slice(0,40));setPhotoInputKey(k=>k+1)}
  function movePhoto(index:number,delta:number){setNewPhotos(list=>{const next=[...list],to=index+delta;if(to<0||to>=next.length)return list;const current=next[index],target=next[to];if(!current||!target)return list;next[index]=target;next[to]=current;return next})}
  async function sortPhotosWithAI(){if(!newPhotos.length)return;setSortingPhotos(true);setNotice("");try{const images=await Promise.all(newPhotos.map(async p=>({mimeType:p.file.type,data:await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Falha ao ler uma foto."));reader.readAsDataURL(p.file)})})));const {data,error}=await supabase.functions.invoke("imobfy-sort-property-photos",{body:{images}});if(error||!data?.photos)throw new Error(data?.error||error?.message||"A IA não conseguiu organizar as fotos.");setNewPhotos(current=>[...data.photos].sort((a:any,b:any)=>a.order-b.order).flatMap((p:any)=>{const photo=current[p.index];return photo?[{...photo,category:photoCategories[p.category]?p.category:"outros"}]:[]}));setNotice("Fotos classificadas pela IA. Confira a ordem antes de salvar.")}catch(e){setNotice(e instanceof Error?e.message:"Não foi possível organizar as fotos.")}finally{setSortingPhotos(false)}}
  async function persistPhotos(propertyId:string){if(!newPhotos.length)return null;const start=savedPhotos.length;const rows:any[]=[];for(let i=0;i<newPhotos.length;i++){const p=newPhotos[i];if(!p)continue;const ext=p.file.name.split(".").pop()?.toLowerCase()||"jpg",path=user.id+"/"+propertyId+"/"+crypto.randomUUID()+"."+ext;const {error}=await supabase.storage.from("property-photos").upload(path,p.file,{contentType:p.file.type});if(error)return error;rows.push({user_id:user.id,property_id:propertyId,storage_path:path,category:p.category,sort_order:start+i,is_cover:start+i===0})}const {error}=await supabase.from("property_photos").insert(rows);if(error)return error;setNewPhotos([]);return null}
  async function savePhotoGallery(){if(!photoProperty)return;setBusy(true);const error=await persistPhotos(photoProperty.id);if(error)setNotice("Não foi possível salvar as fotos: "+error.message);else{await loadSavedPhotos(photoProperty.id);setShowPhotoManager(false);setNotice("Galeria de fotos salva.")}setBusy(false)}
  async function startAudioCapture(){
   setNotice("");
   if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){setNotice("Seu navegador não permite gravar áudio aqui. Tente usar o Chrome atualizado e liberar o microfone.");return}
   try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const preferred=MediaRecorder.isTypeSupported("audio/webm;codecs=opus")?"audio/webm;codecs=opus":MediaRecorder.isTypeSupported("audio/webm")?"audio/webm":"";
    const recorder=new MediaRecorder(stream,preferred?{mimeType:preferred}:undefined);
    audioChunks.current=[];
    recorder.ondataavailable=(event)=>{if(event.data.size>0)audioChunks.current.push(event.data)};
    recorder.onerror=()=>{stream.getTracks().forEach(track=>track.stop());setIsRecordingAudio(false);setParsingAudio(false);setNotice("Ocorreu um erro durante a gravação. Tente novamente.")};
    recorder.onstop=async()=>{
     stream.getTracks().forEach(track=>track.stop());setIsRecordingAudio(false);setParsingAudio(true);setNotice("");
     try{
      const blob=new Blob(audioChunks.current,{type:recorder.mimeType||"audio/webm"});
      if(!blob.size){setNotice("Não recebemos áudio. Grave novamente.");return}
      if(blob.size>8*1024*1024){setNotice("Esse áudio ficou muito grande. Grave uma descrição mais curta (até 8 MB).");return}
      const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Não consegui ler o áudio."));reader.readAsDataURL(blob)});
      const comma=dataUrl.indexOf(",");
      const audioBase64=comma>=0?dataUrl.slice(comma+1):"";
      const {data,error}=await supabase.functions.invoke("imobfy-parse-property-audio",{body:{audioBase64,mimeType:blob.type||"audio/webm"}});
      if(error||!data?.fields)throw new Error(data?.error||error?.message||"Não consegui interpretar o áudio.");
      const fields=data.fields as Record<string,unknown>;
      const allowed=["title","property_code","property_type","purpose","status","neighborhood","city","address","address_number","address_complement","zip_code","bedrooms","suites","bathrooms","parking_spaces","area_m2","asking_price","condominium_fee","iptu_amount","habite_se","exclusivity","description","commercial_notes","origin","capture_origin"];
      const numeric=new Set(["bedrooms","suites","bathrooms","parking_spaces","area_m2","asking_price","condominium_fee","iptu_amount"]);
      const validEnums:Record<string,string[]>={property_type:["Apartamento","Casa","Cobertura","Loja","Lote","Conjunto","Outro"],purpose:["venda","locacao","venda_locacao"],status:["ativo","reservado","vendido","inativo"],habite_se:["Sim","Não","Em andamento","Não se aplica"]};
      setForm(current=>{
       const next={...current};
       for(const key of allowed){const value=fields[key];if(value===null||value===undefined||value==="")continue;
        if(key==="exclusivity"){if(typeof value==="boolean")next.exclusivity=value;continue}
        if(numeric.has(key)){const n=typeof value==="number"?value:Number(value);if(Number.isFinite(n)&&n>=0)(next as any)[key]=String(n);continue}
        if(typeof value==="string"){if(validEnums[key]&&!validEnums[key].includes(value))continue;(next as any)[key]=value}
       }
       return next;
      });
      setNotice("Áudio interpretado! Confira os campos preenchidos e corrija o que for necessário antes de salvar.");
     }catch(error){setNotice(error instanceof Error?error.message:"Não foi possível interpretar o áudio. Tente novamente.")}finally{setParsingAudio(false);audioChunks.current=[]}
    };
    audioRecorder.current=recorder;recorder.start();setIsRecordingAudio(true);
   }catch(error){setNotice(error instanceof Error&&error.name==="NotAllowedError"?"O acesso ao microfone foi negado. Libere a permissão do microfone no navegador e tente novamente.":"Não consegui iniciar o microfone. Verifique as permissões do navegador.");}
  }
  function stopAudioCapture(){if(audioRecorder.current&&audioRecorder.current.state!=="inactive")audioRecorder.current.stop()}
  function setField(k:string,v:string|boolean){setForm(f=>({...f,[k]:v}))}
  async function createOwner(){if(!ownerForm.name.trim())return;setBusy(true);const {data,error}=await supabase.from("owners").insert({user_id:user.id,name:ownerForm.name.trim(),phone:ownerForm.phone||null,email:ownerForm.email||null}).select("id,name,phone,email").single();if(error)setNotice(error.message);else{setOwners(os=>[...(os),data as Owner]);setField("owner_id",data.id);setOwnerForm({name:"",phone:"",email:""});setShowOwner(false)}setBusy(false)}
  async function save(){if(!form.title.trim())return;setBusy(true);const payload={user_id:user.id,title:form.title.trim(),property_code:form.property_code||null,property_type:form.property_type||null,purpose:form.purpose,status:form.status,neighborhood:form.neighborhood||null,city:form.city||null,address:form.address||null,address_number:form.address_number||null,address_complement:form.address_complement||null,zip_code:form.zip_code||null,bedrooms:form.bedrooms?Number(form.bedrooms):null,suites:form.suites?Number(form.suites):null,bathrooms:form.bathrooms?Number(form.bathrooms):null,parking_spaces:form.parking_spaces?Number(form.parking_spaces):null,area_m2:form.area_m2?Number(form.area_m2):null,asking_price:form.asking_price?Number(form.asking_price):null,description:form.description||null,condominium_fee:form.condominium_fee?Number(form.condominium_fee):null,iptu_amount:form.iptu_amount?Number(form.iptu_amount):null,habite_se:form.habite_se||null,origin:form.origin||null,capture_date:new Date().toISOString(),exclusivity:Boolean(form.exclusivity),commercial_notes:form.commercial_notes||null,owner_name:form.owner_id?(ownerMap.get(form.owner_id)?.name||null):null,owner_phone:form.owner_id?(ownerMap.get(form.owner_id)?.phone||null):null};
   let propertyId=editing?.id; let error=null as any; if(editing){const r=await supabase.from("properties").update(payload).eq("user_id",user.id).eq("id",editing.id);error=r.error}else{const r=await supabase.from("properties").insert(payload).select("id").single();error=r.error;propertyId=r.data?.id}
   if(!error&&propertyId){const existing=captureMap.get(propertyId);const cap={user_id:user.id,property_id:propertyId,owner_id:form.owner_id||null,capture_type:form.capture_type,origin:form.capture_origin||form.origin||null,commission_pct:form.capture_type==="shared"?10:20,status:"active",notes:form.commercial_notes||null};if(existing){const r=await supabase.from("captures").update(cap).eq("user_id",user.id).eq("id",existing.id);error=r.error}else{const r=await supabase.from("captures").insert(cap);error=r.error}}
   if(error)setNotice("Não foi possível salvar o imóvel: "+error.message);else{setShowForm(false);await load();setNotice(editing?"Imóvel atualizado. Agora você pode gerenciar as fotos separadamente.":"Imóvel cadastrado com sucesso. Agora você pode adicionar as fotos.")}setBusy(false)
  }
  if(loading)return <div className="empty"><Loader2 className="spin"/> Carregando imóveis...</div>;
  return <div className="negocios-core imoveis-core">
   <div className="module-actions"><div><span className="label">INVENTÁRIO COMERCIAL</span><h2>Imóveis</h2><p className="muted">Estoque, proprietários e captações em uma única operação.</p></div><button className="clean-button primary" onClick={openNew}><Plus size={16}/> Novo imóvel</button></div>
   {notice&&<div className="notice"><strong>Imobfy:</strong> {notice}</div>}
   <div className="inventory-toolbar"><div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar código, imóvel, bairro ou proprietário..."/></div><div className="filter-pills"><Filter size={15}/>{["todos","ativo","reservado","vendido","inativo"].map(s=><button key={s} className={status===s?"selected":""} onClick={()=>setStatus(s)}>{s==="todos"?"Todos":statusLabel[s]}</button>)}</div></div>
   <div className="inventory-grid">{filtered.map(p=>{const c=captureMap.get(p.id);return <button className="inventory-card" key={p.id} onClick={()=>setSelected(p)}><div className="inventory-icon"><Building2 size={19}/></div><div className="inventory-main"><div className="inventory-top"><span>{p.property_code||"SEM CÓDIGO"}</span><em>{statusLabel[p.status]||p.status}</em></div><h3>{p.title}</h3><p>{[p.property_type,p.neighborhood,p.city].filter(Boolean).join(" · ")||"Sem localização"}</p><div className="inventory-stats"><span>{p.area_m2?`${p.area_m2} m²`:"Área —"}</span><span>{p.bedrooms??0} qtos</span><span>{p.parking_spaces??0} vagas</span></div></div><div className="inventory-side"><strong>{money(p.asking_price)}</strong><small>{c?captureLabel[c.capture_type]:"Sem captação"}</small><ChevronRight size={16}/></div></button>})}{!filtered.length&&<div className="empty inventory-empty"><Home size={20}/><strong>Nenhum imóvel encontrado</strong><span>Cadastre seu primeiro imóvel ou ajuste a busca.</span></div>}</div>
   {selected&&<div className="journey-panel inventory-detail"><div className="journey-header"><div><span className="label">FICHA DO IMÓVEL</span><h3>{selected.title}</h3><p>{selected.property_code||"Sem código"} · {selected.neighborhood||"Sem bairro"}</p></div><button className="icon-button" onClick={()=>setSelected(null)}><X size={18}/></button></div><div className="journey-actions"><button className="clean-button secondary" onClick={()=>openEdit(selected)}><Pencil size={15}/> Editar imóvel</button><button className="clean-button primary" onClick={()=>openPhotos(selected)}><ImagePlus size={15}/> Gerenciar fotos</button><button className="clean-button secondary" onClick={()=>void openShare(selected)}><Link2 size={15}/> Página do imóvel</button></div><div className="property-detail-grid"><article className="clean-card"><span className="label">COMERCIAL</span><h3>{money(selected.asking_price)}</h3><p>{selected.purpose==="venda_locacao"?"Venda ou locação":selected.purpose==="locacao"?"Locação":"Venda"} · {selected.exclusivity?"Exclusividade":"Captação aberta"}</p><div className="detail-list"><span>Tipo <b>{selected.property_type||"—"}</b></span><span>Área <b>{selected.area_m2?`${selected.area_m2} m²`:"—"}</b></span><span>Quartos <b>{selected.bedrooms??"—"}</b></span><span>Suítes <b>{selected.suites??"—"}</b></span><span>Banheiros <b>{selected.bathrooms??"—"}</b></span><span>Vagas <b>{selected.parking_spaces??"—"}</b></span></div></article><article className="clean-card"><span className="label">PROPRIETÁRIO</span><h3>{selected.owner_name||"Não informado"}</h3><p>{selected.owner_phone||"Sem telefone"}</p>{captureMap.get(selected.id)&&<div className="capture-badge">{captureLabel[captureMap.get(selected.id)!.capture_type]} · {captureMap.get(selected.id)!.commission_pct}%</div>}<div className="detail-list"><span>Origem <b>{captureMap.get(selected.id)?.origin||selected.origin||"—"}</b></span><span>Captação <b>{selected.capture_date?new Date(selected.capture_date).toLocaleDateString("pt-BR"):"—"}</b></span><span>Condomínio <b>{money(selected.condominium_fee)}</b></span><span>IPTU <b>{money(selected.iptu_amount)}</b></span><span>Habite-se <b>{selected.habite_se||"—"}</b></span></div></article><article className="clean-card full"><span className="label">LOCALIZAÇÃO E OBSERVAÇÕES</span><p>{[selected.address,selected.address_number,selected.address_complement,selected.neighborhood,selected.city,selected.zip_code].filter(Boolean).join(", ")||"Endereço não informado"}</p><p>{selected.description||"Sem descrição."}</p><p>{selected.commercial_notes||"Sem observações comerciais."}</p></article></div></div>}
   {showForm&&<Modal title={editing?"Editar imóvel":"Novo imóvel"} close={()=>setShowForm(false)} wide>
    <div className="property-form-intro">Preencha os dados principais manualmente ou fale para a IA organizar as informações para você.</div>
    <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",margin:"12px 0 18px",padding:14,border:"1px solid var(--border, #ddd)",borderRadius:12}}>
     {!isRecordingAudio?<button type="button" className="clean-button primary" onClick={()=>void startAudioCapture()} disabled={parsingAudio||busy}><Mic size={16}/>{parsingAudio?" Interpretando áudio...":" Cadastrar por áudio"}</button>:<button type="button" className="clean-button primary" onClick={stopAudioCapture}><Square size={15}/> Parar e preencher campos</button>}
     {isRecordingAudio&&<span className="muted" role="status">Gravando… fale naturalmente e inclua apenas as informações que você souber.</span>}
     {parsingAudio&&<span className="muted" role="status"><Loader2 className="spin" size={14}/> A IA está organizando as informações.</span>}
     {!isRecordingAudio&&!parsingAudio&&<span className="muted" style={{fontSize:12}}>Grave uma descrição curta em português. Você revisa tudo antes de salvar.</span>}
    </div>
    <div className="property-form-scroll">
     <section className="property-form-section">
      <div className="property-section-heading"><span>01</span><div><h3>Identificação do imóvel</h3><p>Como o imóvel será identificado no seu inventário.</p></div></div>
      <div className="form-grid">
       <label className="field-span-2">Nome / referência <input value={form.title} onChange={e=>setField("title",e.target.value)} placeholder="Ex.: Apartamento 3 quartos · Castelo" /></label>
       <label>Código de referência <input value={form.property_code} onChange={e=>setField("property_code",e.target.value)} placeholder="Ex.: IMB-001" /></label>
       <label>Tipo de imóvel <select value={form.property_type} onChange={e=>setField("property_type",e.target.value)}><option>Apartamento</option><option>Casa</option><option>Cobertura</option><option>Loja</option><option>Lote</option><option>Conjunto</option><option>Outro</option></select></label>
       <label>Finalidade <select value={form.purpose} onChange={e=>setField("purpose",e.target.value)}><option value="venda">Venda</option><option value="locacao">Locação</option><option value="venda_locacao">Venda ou locação</option></select></label>
       <label>Status do imóvel <select value={form.status} onChange={e=>setField("status",e.target.value)}><option value="ativo">Ativo</option><option value="reservado">Reservado</option><option value="vendido">Vendido</option><option value="inativo">Inativo</option></select></label>
      </div>
     </section>
     <section className="property-form-section">
      <div className="property-section-heading"><span>02</span><div><h3>Valores e características</h3><p>Preço, metragem e distribuição dos ambientes.</p></div></div>
      <div className="form-grid">
       <label>Preço pedido (R$) <input type="number" min="0" value={form.asking_price} onChange={e=>setField("asking_price",e.target.value)} placeholder="0,00" /></label>
       <label>Área (m²) <input type="number" min="0" value={form.area_m2} onChange={e=>setField("area_m2",e.target.value)} placeholder="Ex.: 85" /></label>
       <label>Quartos <input type="number" min="0" value={form.bedrooms} onChange={e=>setField("bedrooms",e.target.value)} placeholder="0" /></label>
       <label>Suítes <input type="number" min="0" value={form.suites} onChange={e=>setField("suites",e.target.value)} placeholder="0" /></label>
       <label>Banheiros <input type="number" min="0" value={form.bathrooms} onChange={e=>setField("bathrooms",e.target.value)} placeholder="0" /></label>
       <label>Vagas de garagem <input type="number" min="0" value={form.parking_spaces} onChange={e=>setField("parking_spaces",e.target.value)} placeholder="0" /></label>
      </div>
     </section>
     <section className="property-form-section">
      <div className="property-section-heading"><span>03</span><div><h3>Localização</h3><p>Endereço e região para encontrar o imóvel com facilidade.</p></div></div>
      <div className="form-grid">
       <label>Bairro <input value={form.neighborhood} onChange={e=>setField("neighborhood",e.target.value)} placeholder="Ex.: Santa Amélia" /></label>
       <label>Cidade <input value={form.city} onChange={e=>setField("city",e.target.value)} placeholder="Cidade" /></label>
       <label className="field-span-2">Endereço <input value={form.address} onChange={e=>setField("address",e.target.value)} placeholder="Rua, avenida..." /></label>
       <label>Número <input value={form.address_number} onChange={e=>setField("address_number",e.target.value)} placeholder="Nº" /></label>
       <label>Complemento <input value={form.address_complement} onChange={e=>setField("address_complement",e.target.value)} placeholder="Bloco, apto..." /></label>
       <label>CEP <input value={form.zip_code} onChange={e=>setField("zip_code",e.target.value)} placeholder="00000-000" /></label>
      </div>
     </section>
     <section className="property-form-section">
      <div className="property-section-heading"><span>04</span><div><h3>Proprietário e captação</h3><p>Vincule o responsável e registre como o imóvel chegou até você.</p></div></div>
      <div className="form-grid">
       <div className="property-owner-field field-span-2"><label htmlFor="property-owner">Proprietário</label><select id="property-owner" value={form.owner_id} onChange={e=>setField("owner_id",e.target.value)}><option value="">Selecionar proprietário</option>{owners.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><button type="button" className="text-link" onClick={()=>setShowOwner(true)}><UserRound size={14}/> Cadastrar proprietário</button></div>
       <label>Tipo de captação <select value={form.capture_type} onChange={e=>setField("capture_type",e.target.value)}><option value="normal">Normal</option><option value="exclusive">Exclusiva</option><option value="shared">Meiada</option></select></label>
       <label>Origem da captação <input value={form.capture_origin} onChange={e=>setField("capture_origin",e.target.value)} placeholder="Indicação, prospecção..." /></label>
       <label>Condomínio (R$) <input type="number" min="0" value={form.condominium_fee} onChange={e=>setField("condominium_fee",e.target.value)} placeholder="0,00" /></label>
       <label>IPTU (R$) <input type="number" min="0" value={form.iptu_amount} onChange={e=>setField("iptu_amount",e.target.value)} placeholder="0,00" /></label>
       <label>Habite-se <select value={form.habite_se} onChange={e=>setField("habite_se",e.target.value)}><option value="">Selecione a situação</option><option value="Sim">Regularizado</option><option value="Não">Pendente / não possui</option><option value="Em andamento">Em andamento</option><option value="Não se aplica">Não se aplica</option></select></label>
       <label className="property-exclusive"><input type="checkbox" checked={Boolean(form.exclusivity)} onChange={e=>setField("exclusivity",e.target.checked)} /><span><strong>Captação exclusiva</strong><small>Marque se houver exclusividade acordada.</small></span></label>
      </div>
     </section>
     <section className="property-form-section">
      <div className="property-section-heading"><span>05</span><div><h3>Informações adicionais</h3><p>Detalhes que ajudam a apresentar e negociar o imóvel.</p></div></div>
      <div className="form-grid">
       <label className="field-span-2">Descrição do imóvel <textarea value={form.description} onChange={e=>setField("description",e.target.value)} rows={3} placeholder="Destaques, acabamento, diferenciais e distribuição..." /></label>
       <label className="field-span-2">Observações comerciais <textarea value={form.commercial_notes} onChange={e=>setField("commercial_notes",e.target.value)} rows={3} placeholder="Condições de negociação, chaves, disponibilidade..." /></label>
      </div>
     </section>
    </div>

     

    <Actions close={()=>setShowForm(false)} save={save} busy={busy}/>
   </Modal>}
   {showPhotoManager&&photoProperty&&<Modal title={`Fotos · ${photoProperty.title}`} close={()=>setShowPhotoManager(false)} wide>
    <div className="property-form-intro">Envie e organize as fotos em uma etapa separada. As informações do imóvel já estão salvas.</div>
<section className="property-form-section">
      <div className="property-section-heading"><span>06</span><div><h3>Fotos do imóvel</h3><p>Adicione imagens e use a IA para classificar os ambientes.</p></div></div>
      <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",marginBottom:12}}>
       <label className="clean-button secondary" style={{display:"inline-flex",alignItems:"center",gap:8,cursor:"pointer"}}><ImagePlus size={16}/> Adicionar fotos <input key={photoInputKey} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={e=>addPhotos(e.target.files)} style={{display:"none"}} /></label>
       <button type="button" className="clean-button primary" disabled={!newPhotos.length||sortingPhotos} onClick={()=>void sortPhotosWithAI()}><Sparkles size={15}/>{sortingPhotos?" Analisando fotos...":" Organizar com IA"}</button><span className="muted" style={{fontSize:12}}>Até 40 fotos · 12 MB por imagem</span>
      </div>
      {savedPhotos.length>0&&<><p className="muted">Fotos já salvas ({savedPhotos.length})</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10,marginBottom:14}}>{savedPhotos.map(p=><div key={p.id} style={{border:"1px solid var(--border, #ddd)",borderRadius:10,overflow:"hidden"}}><img src={p.url} alt={photoCategories[p.category]||"Foto do imóvel"} style={{width:"100%",height:90,objectFit:"cover"}}/><div style={{padding:7,fontSize:12}}>{photoCategories[p.category]||"Outros"}{p.is_cover?" · Capa":""}</div></div>)}</div></>}
      {newPhotos.length>0&&<><p className="muted">{newPhotos.length} nova(s) foto(s) · use as setas para ajustar a ordem</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(145px,1fr))",gap:10}}>{newPhotos.map((p,i)=><div key={p.id} style={{border:"1px solid var(--border, #ddd)",borderRadius:10,overflow:"hidden",minWidth:0}}><img src={p.preview} alt={photoCategories[p.category]||"Foto selecionada"} style={{width:"100%",height:105,objectFit:"cover"}}/><div style={{padding:8,display:"grid",gap:7}}><strong style={{fontSize:12}}>{i===0&&savedPhotos.length===0?"Capa · ":""}{photoCategories[p.category]||"Outros"}</strong><select aria-label="Categoria da foto" value={p.category} onChange={e=>setNewPhotos(list=>list.map(item=>item.id===p.id?{...item,category:e.target.value}:item))} style={{width:"100%",fontSize:12}}>{Object.entries(photoCategories).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><div style={{display:"flex",justifyContent:"space-between"}}><button type="button" className="icon-button" disabled={i===0} onClick={()=>movePhoto(i,-1)} aria-label="Mover para cima"><ArrowUp size={14}/></button><button type="button" className="icon-button" disabled={i===newPhotos.length-1} onClick={()=>movePhoto(i,1)} aria-label="Mover para baixo"><ArrowDown size={14}/></button><button type="button" className="icon-button" onClick={()=>{URL.revokeObjectURL(p.preview);setNewPhotos(list=>list.filter(item=>item.id!==p.id))}} aria-label="Remover foto"><Trash2 size={14}/></button></div></div></div>)}</div></>}
      {!newPhotos.length&&!savedPhotos.length&&<div className="empty" style={{padding:22,border:"1px dashed var(--border, #bbb)",borderRadius:12}}><ImagePlus size={22}/><span>As fotos selecionadas aparecerão aqui para revisão.</span></div>}
     </section>
    <Actions close={()=>setShowPhotoManager(false)} save={()=>void savePhotoGallery()} busy={busy}/>
   </Modal>}
   {showOwner&&<Modal title="Novo proprietário" close={()=>setShowOwner(false)}><label>Nome<input value={ownerForm.name} onChange={e=>setOwnerForm({...ownerForm,name:e.target.value})}/></label><label>Telefone<input value={ownerForm.phone} onChange={e=>setOwnerForm({...ownerForm,phone:e.target.value})}/></label><label>E-mail<input value={ownerForm.email} onChange={e=>setOwnerForm({...ownerForm,email:e.target.value})}/></label><Actions close={()=>setShowOwner(false)} save={createOwner} busy={busy}/></Modal>}
  </div>
 }
 function Modal({title,close,children,wide=false}:{title:string;close:()=>void;children:React.ReactNode;wide?:boolean}){return <div className="mvp-overlay"><div className={`mvp-modal ${wide?"modal-wide":""}`}><button className="mvp-close" onClick={close}><X size={18}/></button><span className="label">IMOBFY</span><h2>{title}</h2>{children}</div></div>}
 function Actions({close,save,busy}:{close:()=>void;save:()=>void;busy:boolean}){return <div className="mvp-actions"><button className="clean-button secondary" onClick={close}>Cancelar</button><button className="clean-button primary" onClick={()=>void save()} disabled={busy}>{busy?<Loader2 className="spin" size={15}/>:`Salvar`}</button></div>}
