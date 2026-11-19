import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CheckCircle2, CircleHelp, Loader2, Plus, ShieldCheck, Target } from "lucide-react";
import { supabase } from "../lib/supabase";
import { adsAdvice, summarizeAds, type AdDailyMetric, type AdFunnelEvent, type FunnelStage } from "../lib/ads-intelligence";
import "../imobfy-intelligence.css";
import MetaInsightsPanel from "./MetaInsightsPanel";

type ClientOption = { id: string; name: string };
const BRL = (value: number) => value.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const int = (value: number) => value.toLocaleString("pt-BR");
const dateKey = (value: Date) => {
  const local = new Date(value.getTime() - value.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,10);
};
const today = dateKey(new Date());
const firstDay = today.slice(0,8)+"01";
const stages: {value:FunnelStage;label:string}[]=[
 {value:"lead",label:"Lead"},
 {value:"atendimento",label:"Atendimento"},
 {value:"qualificado",label:"Qualificado"},
 {value:"visita",label:"Visita"},
 {value:"proposta",label:"Proposta"},
 {value:"venda",label:"Venda"},
];
type LoadState = "loading" | "ready" | "not_installed" | "error";
export default function AdsIntelligenceDashboard({userId}:{userId:string}) {
 const [state,setState]=useState<LoadState>("loading");
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [reports,setReports]=useState<AdDailyMetric[]>([]);
 const [events,setEvents]=useState<AdFunnelEvent[]>([]);
 const [clients,setClients]=useState<ClientOption[]>([]);
 const [start,setStart]=useState(firstDay);
 const [end,setEnd]=useState(today);
 const [showExpense,setShowExpense]=useState(false);
 const [showEvent,setShowEvent]=useState(false);
 const [expense,setExpense]=useState({report_date:today,ad_account_id:"",campaign_id:"",campaign_name:"",spend_brl:"",impressions:"0",clicks:"0"});
 const [conversion,setConversion]=useState({client_id:"",stage:"lead" as FunnelStage,campaign_key:""});

 const load=useCallback(async()=>{
  setState("loading");setError("");
  try {
   const [m,e,c]=await Promise.all([
    supabase.from("imobfy_ads_daily_metrics").select("report_date,ad_account_id,campaign_id,campaign_name,spend_brl,impressions,clicks,source").eq("user_id",userId).order("report_date",{ascending:false}).limit(2000),
    supabase.from("imobfy_ads_funnel_events").select("id,event_key,stage,campaign_id,ad_account_id,client_id,deal_id,occurred_at,source").eq("user_id",userId).order("occurred_at",{ascending:false}).limit(2000),
    supabase.from("clients").select("id,name").eq("user_id",userId).order("name").limit(500),
   ]);
   const problem=m.error||e.error||c.error;
   if(problem){
    const code=(problem as {code?:string}).code;
    if(code==="42P01" || code==="PGRST205" || /relation .* does not exist|Could not find the table/i.test(problem.message)){
     setState("not_installed");return;
    }
    throw problem;
   }
   setReports((m.data||[]) as AdDailyMetric[]);
   setEvents((e.data||[]) as AdFunnelEvent[]);
   setClients((c.data||[]) as ClientOption[]);
   setState("ready");
  } catch(cause){
   setError(cause instanceof Error?cause.message:"Não foi possível carregar os indicadores.");
   setState("error");
  }
 },[userId]);
 useEffect(()=>{void load()},[load]);
 const rows=useMemo(()=>summarizeAds(reports,events,start,end),[reports,events,start,end]);
 const advice=useMemo(()=>adsAdvice(rows),[rows]);
 const totals=useMemo(()=>rows.reduce((a,row)=>({
  spend:a.spend+row.spendBrl,clicks:a.clicks+row.clicks,leads:a.leads+row.leads,
  qualified:a.qualified+row.qualified,visits:a.visits+row.visits,sales:a.sales+row.sales,
 }),{spend:0,clicks:0,leads:0,qualified:0,visits:0,sales:0}),[rows]);
 const campaignOptions=useMemo(()=>Array.from(new Map(reports.map(r=>[r.ad_account_id+":"+r.campaign_id,{
  key:r.ad_account_id+":"+r.campaign_id,account:r.ad_account_id,campaign:r.campaign_id,
  name:r.campaign_name,
 }])).values()),[reports]);

 async function saveExpense(){
  setError("");setMessage("");
  const amount=Number(expense.spend_brl);
  const impressions=Number(expense.impressions),clicks=Number(expense.clicks);
  if(!expense.campaign_id.trim()||!expense.ad_account_id.trim()||!expense.campaign_name.trim()
    ||!expense.report_date||!Number.isFinite(amount)||amount<0
    ||!Number.isSafeInteger(impressions)||impressions<0||!Number.isSafeInteger(clicks)||clicks<0){
    setError("Preencha conta, campanha, data e métricas com valores válidos.");return;
  }
  setBusy(true);
  try {
   const {error:writeError}=await supabase.from("imobfy_ads_daily_metrics").upsert({
     user_id:userId,report_date:expense.report_date,ad_account_id:expense.ad_account_id.trim(),
     campaign_id:expense.campaign_id.trim(),campaign_name:expense.campaign_name.trim(),
     spend_brl:amount,impressions,clicks,source:"manual",updated_at:new Date().toISOString(),
   },{onConflict:"user_id,report_date,ad_account_id,campaign_id"});
   if(writeError)throw writeError;
   setShowExpense(false);setMessage("Métricas registradas como dados informados manualmente.");
   await load();
  }catch(cause){setError(cause instanceof Error?cause.message:"Não consegui registrar a campanha.");}
  finally{setBusy(false)}
 }

 async function saveEvent(){
  setError("");setMessage("");
  const [accountId,campaignId]=conversion.campaign_key.split(":");
  if(!conversion.client_id||!accountId||!campaignId){setError("Selecione um cliente e uma campanha registrada.");return;}
  const eventKey=`manual:${conversion.client_id}:${conversion.stage}:${campaignId}`;
  setBusy(true);
  try {
   const {error:writeError}=await supabase.from("imobfy_ads_funnel_events").insert({
    user_id:userId,event_key:eventKey,stage:conversion.stage,client_id:conversion.client_id,
    campaign_id:campaignId,ad_account_id:accountId,source:"manual",occurred_at:new Date().toISOString(),
   });
   if(writeError){
     if(writeError.code==="23505")throw new Error("Essa etapa já foi registrada para o cliente nesta campanha.");
     throw writeError;
   }
   setShowEvent(false);setMessage("Etapa registrada manualmente. Nenhum evento foi enviado à Meta.");
   await load();
  }catch(cause){setError(cause instanceof Error?cause.message:"Não consegui registrar a etapa.");}
  finally{setBusy(false)}
 }

 return <div className="intel-page">
  <MetaInsightsPanel />
  <header className="intel-head"><div><span className="intel-eyebrow"><BarChart3 size={15}/> IMOBFY / PERFORMANCE</span><h2>Ads Intelligence<span>.</span></h2><p>Gastos informados, conversões atribuídas e sinais para decidir melhor. Nenhum anúncio é alterado automaticamente.</p></div>
   <div className="intel-tag"><ShieldCheck size={16}/> Modo leitura e aprovação humana</div>
  </header>
  <div className="intel-warning"><CircleHelp size={18}/><span><strong>Meta Ads ainda não conectado.</strong> Os gastos inseridos aqui são manuais e os eventos representam etapas confirmadas pelo usuário. Não há importação automática, envio CAPI, pausa, alteração de orçamento ou otimização de campanhas.</span></div>
  <div className="intel-toolbar"><label>De <input type="date" value={start} max={end} onChange={e=>setStart(e.target.value)}/></label><label>Até <input type="date" value={end} min={start} onChange={e=>setEnd(e.target.value)}/></label>
   <button type="button" onClick={()=>setShowExpense(x=>!x)} disabled={state!=="ready"}><Plus size={16}/> Registrar gasto</button>
   <button type="button" onClick={()=>setShowEvent(x=>!x)} disabled={state!=="ready"||!clients.length||!campaignOptions.length}><Plus size={16}/> Registrar etapa</button>
  </div>
  {message&&<p className="intel-success" role="status"><CheckCircle2 size={16}/>{message}</p>}
  {error&&<p className="intel-error" role="alert">{error}</p>}
  {state==="loading"&&<div className="intel-panel"><Loader2 size={18}/> Carregando dados reais do funil...</div>}
  {state==="not_installed"&&<div className="intel-panel" role="status"><strong>Banco do Ads Intelligence não ativado.</strong><p>A interface está preparada, mas a migration de inteligência precisa ser homologada e aplicada antes de registrar campanhas e eventos.</p></div>}
  {state==="error"&&<div className="intel-panel"><button onClick={()=>void load()}>Tentar novamente</button></div>}
  {state==="ready"&&<>
   {showExpense&&<section className="intel-panel"><h3>Registrar métricas da campanha</h3><p>Copie somente os dados reais do Gerenciador de Anúncios. Se informar novamente a mesma campanha e data, os valores serão atualizados.</p>
    <div className="intel-form-grid">
     <label>Data<input type="date" value={expense.report_date} onChange={e=>setExpense(x=>({...x,report_date:e.target.value}))}/></label>
     <label>ID conta de anúncios<input value={expense.ad_account_id} maxLength={80} placeholder="act_..." onChange={e=>setExpense(x=>({...x,ad_account_id:e.target.value}))}/></label>
     <label>ID da campanha<input value={expense.campaign_id} maxLength={80} onChange={e=>setExpense(x=>({...x,campaign_id:e.target.value}))}/></label>
     <label>Nome da campanha<input value={expense.campaign_name} maxLength={180} onChange={e=>setExpense(x=>({...x,campaign_name:e.target.value}))}/></label>
     <label>Gasto (R$)<input type="number" min="0" step="0.01" value={expense.spend_brl} onChange={e=>setExpense(x=>({...x,spend_brl:e.target.value}))}/></label>
     <label>Impressões<input type="number" min="0" step="1" value={expense.impressions} onChange={e=>setExpense(x=>({...x,impressions:e.target.value}))}/></label>
     <label>Cliques<input type="number" min="0" step="1" value={expense.clicks} onChange={e=>setExpense(x=>({...x,clicks:e.target.value}))}/></label>
    </div><div className="intel-form-actions"><button type="button" onClick={()=>setShowExpense(false)}>Cancelar</button><button type="button" disabled={busy} onClick={()=>void saveExpense()}>{busy?"Salvando...":"Salvar métricas"}</button></div>
   </section>}
   {showEvent&&<section className="intel-panel"><h3>Registrar etapa de conversão</h3><p>Selecione uma etapa realmente confirmada no CRM. O registro não dispara nenhuma ação na Meta.</p>
    <div className="intel-form-grid">
     <label>Cliente<select value={conversion.client_id} onChange={e=>setConversion(x=>({...x,client_id:e.target.value}))}><option value="">Escolha um cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
     <label>Campanha<select value={conversion.campaign_key} onChange={e=>setConversion(x=>({...x,campaign_key:e.target.value}))}><option value="">Selecione a campanha de origem</option>{campaignOptions.map(c=><option key={c.key} value={c.key}>{c.name} ({c.account})</option>)}</select></label>
     <label>Etapa<select value={conversion.stage} onChange={e=>setConversion(x=>({...x,stage:e.target.value as FunnelStage}))}>{stages.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
    </div><div className="intel-form-actions"><button type="button" onClick={()=>setShowEvent(false)}>Cancelar</button><button type="button" disabled={busy} onClick={()=>void saveEvent()}>{busy?"Salvando...":"Confirmar etapa"}</button></div>
   </section>}
   <div className="intel-kpis">
    <article><span>Investimento registrado</span><strong>{BRL(totals.spend)}</strong><small>Fonte: relatórios cadastrados</small></article>
    <article><span>Leads atribuídos</span><strong>{int(totals.leads)}</strong><small>Sem estimativas</small></article>
    <article><span>Qualificados</span><strong>{int(totals.qualified)}</strong><small>Registros do funil</small></article>
    <article><span>Visitas atribuídas</span><strong>{int(totals.visits)}</strong><small>Etapas registradas</small></article>
    <article><span>Vendas atribuídas</span><strong>{int(totals.sales)}</strong><small>Não confundir com VGV</small></article>
   </div>
   <section className="intel-panel"><h3>Campanhas e custo por etapa</h3>
    {!rows.length?<p>Sem campanhas registradas nesse período. Cadastre dados reais antes de analisar resultados.</p>:<div className="intel-table-wrap"><table className="intel-table"><thead><tr><th>Campanha</th><th>Gasto</th><th>Cliques</th><th>Leads</th><th>Qualificados</th><th>Visitas</th><th>Vendas</th><th>R$/qualificado</th><th>R$/visita</th></tr></thead><tbody>
     {rows.map(row=><tr key={row.key}><th scope="row">{row.name}<small>{row.campaignId}</small></th><td>{BRL(row.spendBrl)}</td><td>{int(row.clicks)}</td><td>{row.leads}</td><td>{row.qualified}</td><td>{row.visits}</td><td>{row.sales}</td><td>{row.cpql===null?"Sem base":BRL(row.cpql)}</td><td>{row.cpv===null?"Sem base":BRL(row.cpv)}</td></tr>)}
    </tbody></table></div>}
    <p className="intel-footnote">Custos calculados apenas com investimento e eventos atribuídos à mesma campanha no período. “Sem base” significa que não há conversão registrada — nunca significa custo zero.</p>
   </section>
   <section className="intel-panel"><h3><Target size={19}/> Recomendações para revisão</h3>
    {!advice.length?<p>Ainda não há evidência suficiente para sugerir ajustes. Continue registrando os dados do funil.</p>:
     <div className="intel-advice">{advice.map(item=><article key={item.campaignKey}><strong>{item.message}</strong><p>{item.evidence}</p><small>Recomendação de leitura; exige decisão humana.</small></article>)}</div>}
    <p className="intel-footnote">Ações em campanhas e alterações de orçamento permanecem bloqueadas. Nenhuma pausa ou escala automática está ativa.</p>
   </section>
  </>}
 </div>;
}
