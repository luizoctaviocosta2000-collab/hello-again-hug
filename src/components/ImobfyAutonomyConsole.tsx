import {useCallback,useEffect,useState} from "react";
import {AlertTriangle,BarChart3,Clock3,HandCoins,Headset,PauseCircle,PlayCircle,
  Save,ShieldAlert,ShieldCheck,Users,WalletCards} from "lucide-react";
import {supabase} from "../lib/supabase";
import {
  agentDomains,createDefaultPolicy,
  type AgentAutonomyPolicy,type AgentDomain,type ExecutionMode,
} from "../../supabase/functions/_shared/agent-autonomy-policy";
import "../imobfy-autonomy.css";

type State = "loading"|"ready"|"missing"|"error";
type DbPolicy = {
  domain:AgentDomain; mode:ExecutionMode; emergency_stop:boolean;
  max_ads_daily_budget_brl:string|number;max_ads_budget_change_pct:string|number;
  max_messages_per_day:number;max_messages_per_contact_per_day:number;
  max_followups_per_day:number;enable_preapproved_transfers:boolean;
  max_transfer_brl:string|number;max_transfers_per_day_brl:string|number;
};
type AuditRow = {
  id:string;domain:AgentDomain;action_kind:string;status:string;reason_code:string;
  summary:string;created_at:string;amount_brl:number|null;
};
const meta:Record<AgentDomain,{title:string;icon:typeof BarChart3;description:string}> = {
  ads:{title:"Gestor de anúncios",icon:BarChart3,description:"Pausa campanhas e ajusta orçamentos apenas com dados reais, limites e acesso oficial Meta."},
  atendimento:{title:"Agente de atendimento",icon:Headset,description:"Pode responder clientes autorizados, respeitando mensagens recebidas, janela, templates e handoff."},
  comercial:{title:"Gerente comercial",icon:Users,description:"Organiza follow-ups internos e lembra as próximas ações do pipeline."},
  financeiro:{title:"Agente financeiro",icon:WalletCards,description:"Concilia recebimentos comprovados; transferências dependem de mandato bancário previamente autorizado."},
};
const blank = ():Record<AgentDomain,AgentAutonomyPolicy> => ({
  ads:createDefaultPolicy("ads"),atendimento:createDefaultPolicy("atendimento"),
  comercial:createDefaultPolicy("comercial"),financeiro:createDefaultPolicy("financeiro"),
});
const money = (n:number) => n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const missing = (error:{code?:string;message?:string}|null) =>
  !!error && (["42P01","PGRST205"].includes(error.code||"") ||
    /Could not find the table|relation .* does not exist/i.test(error.message||""));
const normalize = (row:DbPolicy):AgentAutonomyPolicy => ({
  domain:row.domain,mode:row.mode,emergencyStop:row.emergency_stop,
  maxAdsDailyBudgetBrl:Number(row.max_ads_daily_budget_brl)||0,
  maxAdsBudgetChangePct:Number(row.max_ads_budget_change_pct)||0,
  maxMessagesPerDay:Number(row.max_messages_per_day)||0,
  maxMessagesPerContactPerDay:Number(row.max_messages_per_contact_per_day)||0,
  maxFollowupsPerDay:Number(row.max_followups_per_day)||0,
  enablePreapprovedTransfers:row.enable_preapproved_transfers===true,
  maxTransferBrl:Number(row.max_transfer_brl)||0,
  maxTransfersPerDayBrl:Number(row.max_transfers_per_day_brl)||0,
});

export default function ImobfyAutonomyConsole({userId}:{userId:string}) {
  const [state,setState]=useState<State>("loading");
  const [selected,setSelected]=useState<AgentDomain>("ads");
  const [policies,setPolicies]=useState(blank);
  const [globalStop,setGlobalStop]=useState(true);
  const [globalSaved,setGlobalSaved]=useState(false);
  const [persistedDomains,setPersistedDomains]=useState<Set<AgentDomain>>(new Set());
  const [audits,setAudits]=useState<AuditRow[]>([]);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const policy=policies[selected];

  const load=useCallback(async()=>{
    setState("loading");setError("");setNotice("");
    const [global,policyResult,audit] = await Promise.all([
      supabase.from("imobfy_agent_global_controls").select("emergency_stop")
        .eq("user_id",userId).maybeSingle(),
      supabase.from("imobfy_agent_policies").select("*").eq("user_id",userId),
      supabase.from("imobfy_agent_execution_audit")
        .select("id,domain,action_kind,status,reason_code,summary,created_at,amount_brl")
        .eq("user_id",userId).order("created_at",{ascending:false}).limit(30),
    ]);
    const fault=global.error||policyResult.error||audit.error;
    if(fault){
      if(missing(fault)){setState("missing");return;}
      setError("Não consegui conferir as permissões. Nenhuma configuração foi ativada.");
      setState("error");return;
    }
    const globalRow=global.data as unknown as {emergency_stop?:boolean}|null;
    setGlobalStop(globalRow?.emergency_stop!==false);
    setGlobalSaved(!!globalRow);
    const newPolicies=blank();
    const rows=Array.isArray(policyResult.data)?policyResult.data as unknown as DbPolicy[]:[];
    for(const row of rows){
      if(!agentDomains.includes(row.domain))continue;
      newPolicies[row.domain]=normalize(row);
    }
    setPolicies(newPolicies);
    setPersistedDomains(new Set(rows.filter(row=>agentDomains.includes(row.domain)).map(row=>row.domain)));
    setAudits(Array.isArray(audit.data)?audit.data as unknown as AuditRow[]:[]);
    setState("ready");
  },[userId]);
  useEffect(()=>{void load()},[load]);

  function change<K extends keyof AgentAutonomyPolicy>(key:K, value:AgentAutonomyPolicy[K]) {
    setPolicies(current=>({...current,[selected]:{...current[selected],[key]:value}}));
  }

  async function savePolicy(){
    if(busy||state!=="ready")return;
    if(selected==="financeiro"&&policy.enablePreapprovedTransfers &&
      !window.confirm("Esta configuração não envia dinheiro agora. Transferências futuras só poderão usar beneficiários e mandatos já autorizados pelo banco. Deseja salvar?"))return;
    setBusy(true);setError("");setNotice("");
    const patch={
      mode:policy.mode,emergency_stop:policy.emergencyStop,
      max_ads_daily_budget_brl:policy.maxAdsDailyBudgetBrl,
      max_ads_budget_change_pct:policy.maxAdsBudgetChangePct,
      max_messages_per_day:policy.maxMessagesPerDay,
      max_messages_per_contact_per_day:policy.maxMessagesPerContactPerDay,
      max_followups_per_day:policy.maxFollowupsPerDay,
      enable_preapproved_transfers:policy.enablePreapprovedTransfers,
      max_transfer_brl:policy.maxTransferBrl,
      max_transfers_per_day_brl:policy.maxTransfersPerDayBrl,
      updated_at:new Date().toISOString(),
    };
    // UPDATE omits immutable user_id/domain because column-level grants forbid
    // changes to identity. ON CONFLICT upsert would require unsafe UPDATE grants.
    const result=persistedDomains.has(selected)
      ? await supabase.from("imobfy_agent_policies").update(patch)
          .eq("user_id",userId).eq("domain",selected).select("domain").maybeSingle()
      : await supabase.from("imobfy_agent_policies")
          .insert({user_id:userId,domain:selected,...patch}).select("domain").maybeSingle();
    if(result.error||!result.data) {
      setError("A política foi recusada pelo banco. Confira o teto e suas permissões.");
    }else{
      setPersistedDomains(current=>new Set([...current,selected]));
      setNotice("Política registrada. Não ativa integrações externas nem autoriza execução sem verificações do servidor.");
    }
    setBusy(false);
  }

  async function changeGlobalStop(shouldStop:boolean){
    if(busy||state!=="ready")return;
    if(!shouldStop&&!window.confirm(
      "Liberar o bloqueio global NÃO conecta WhatsApp, Meta ou banco. Quando esses serviços forem homologados, os agentes só agirão dentro de suas permissões salvas. Confirmar?"
    ))return;
    setBusy(true);setError("");setNotice("");
    const patch={emergency_stop:shouldStop,updated_at:new Date().toISOString()};
    const result=globalSaved
      ? await supabase.from("imobfy_agent_global_controls").update(patch)
          .eq("user_id",userId).select("emergency_stop").maybeSingle()
      : await supabase.from("imobfy_agent_global_controls")
          .insert({user_id:userId,...patch}).select("emergency_stop").maybeSingle();
    if(result.error||!result.data) setError("Não consegui alterar o bloqueio global. Nenhuma liberação foi confirmada.");
    else {
      setGlobalSaved(true);setGlobalStop(shouldStop);
      setNotice(shouldStop?"Bloqueio de emergência gravado.":"Bloqueio global liberado, sujeito a políticas e integrações oficiais.");
    }
    setBusy(false);
  }

  const cap=(key:keyof AgentAutonomyPolicy,label:string,max:number,step=1)=>
    <label className="auto-field">{label}<input type="number" min={0} max={max} step={step}
      value={String(policy[key])}
      disabled={busy}
      onChange={event=>change(key,Math.min(max,Math.max(0,Number(event.target.value)||0)) as never)}/></label>;

  const Icon=meta[selected].icon;
  return <div className="imobfy-auto-page">
    <header className="auto-heading">
      <div><span className="auto-eyebrow"><ShieldCheck size={16}/> CENTRAL DE AUTONOMIA</span>
        <h2>Agentes com liberdade controlada<span>.</span></h2>
        <p>Você define o nível de autonomia. O backend deve validar a conta, a fonte do dado, os limites e cada tentativa antes de executar.</p>
      </div>
      <div className={globalStop?"auto-main-status is-paused":"auto-main-status"}>
        {globalStop?<PauseCircle size={19}/>:<PlayCircle size={19}/>}
        {globalStop?"Bloqueio global ligado":"Bloqueio global liberado"}
      </div>
    </header>
    <div className="auto-disclosure"><AlertTriangle size={18}/><span><strong>Importante:</strong> a conexão do IMOBFY com Meta Ads, WhatsApp e um parceiro bancário ainda precisa de configuração e homologação. Salvar limites aqui não permite transferências, envio de mensagens ou mudança de anúncio por si só. Nenhum resultado é garantido.</span></div>
    {state==="loading"&&<div className="auto-panel" role="status">Conferindo políticas e registros...</div>}
    {state==="missing"&&<div className="auto-panel" role="status">
      <strong>Banco de autonomia ainda não ativado neste ambiente.</strong>
      <p>É necessário homologar e aplicar a migration de políticas de agentes antes de salvar permissões. Os agentes consultivos existentes continuam funcionando.</p>
    </div>}
    {state==="error"&&<div className="auto-panel"><p role="alert">{error}</p><button type="button" onClick={()=>void load()}>Tentar novamente</button></div>}
    {state==="ready"&&<>
      <div className="auto-emergency">
        <div><ShieldAlert size={20}/><strong>Controle de emergência</strong><span>Bloqueia toda execução automatizada, independentemente da área.</span></div>
        {globalStop?<button type="button" className="auto-release" disabled={busy} onClick={()=>void changeGlobalStop(false)}><PlayCircle size={17}/> Liberar bloqueio global</button>
          :<button type="button" className="auto-stop" disabled={busy} onClick={()=>void changeGlobalStop(true)}><PauseCircle size={17}/> PARAR TODAS AS AUTOMAÇÕES</button>}
      </div>
      <div className="auto-agent-grid">
        {agentDomains.map(domain=>{const DomainIcon=meta[domain].icon;const row=policies[domain];return <button type="button"
          key={domain} className={selected===domain?"auto-agent active":"auto-agent"} onClick={()=>{setSelected(domain);setError("");setNotice("");}}>
          <DomainIcon size={21}/><strong>{meta[domain].title}</strong>
          <small>{row.mode==="bounded"?"Automático com limites":row.mode==="assisted"?"Assistido":"Desligado"}</small>
          <span>{row.emergencyStop?"Área pausada":"Área sem pausa local"}</span>
        </button>})}
      </div>
      <section className="auto-panel">
        <div className="auto-panel-head"><div><span className="auto-eyebrow"><Icon size={17}/> CONFIGURAÇÃO DO ESPECIALISTA</span>
          <h3>{meta[selected].title}</h3><p>{meta[selected].description}</p></div>
          <button type="button" className="auto-save" disabled={busy} onClick={()=>void savePolicy()}><Save size={16}/>{busy?"Salvando...":"Salvar política"}</button>
        </div>
        {error&&<p role="alert" className="auto-error">{error}</p>}
        {notice&&<p role="status" className="auto-success">{notice}</p>}
        <div className="auto-form">
          <label className="auto-field">Nível de autonomia
            <select value={policy.mode} disabled={busy} onChange={event=>change("mode",event.target.value as ExecutionMode)}>
              <option value="off">Desligado</option><option value="assisted">Assistido — pede aprovação</option>
              <option value="bounded">Automático com limites</option>
            </select>
          </label>
          <label className="auto-toggle"><input type="checkbox" checked={policy.emergencyStop} disabled={busy}
            onChange={event=>change("emergencyStop",event.target.checked)}/> Bloqueio deste especialista</label>
          {selected==="ads"&&<>
            {cap("maxAdsDailyBudgetBrl","Teto de orçamento diário por conjunto (R$)",10000,0.01)}
            {cap("maxAdsBudgetChangePct","Mudança máxima por ajuste (%)",20,0.1)}
            <p className="auto-help">Ajustes exigem conta Meta vinculada, gasto e qualificação auditáveis e amostra mínima. Mudanças fora do limite vão para aprovação.</p>
          </>}
          {selected==="atendimento"&&<>
            {cap("maxMessagesPerDay","Máximo de mensagens por dia",200)}
            {cap("maxMessagesPerContactPerDay","Máximo por contato por dia",5)}
            <p className="auto-help">Somente contatos elegíveis, com consentimento, opt-out respeitado, janela aberta ou template aprovado e sem atendimento humano em andamento.</p>
          </>}
          {selected==="comercial"&&<>
            {cap("maxFollowupsPerDay","Máximo de follow-ups internos por dia",100)}
            <p className="auto-help">Só registros internos para clientes existentes e horários válidos. Negociações, preços e promessas continuam fora do controle automático.</p>
          </>}
          {selected==="financeiro"&&<>
            <label className="auto-toggle"><input type="checkbox" checked={policy.enablePreapprovedTransfers}
              disabled={busy} onChange={event=>change("enablePreapprovedTransfers",event.target.checked)}/> Planejar transferências sob mandato bancário pré-autorizado</label>
            {cap("maxTransferBrl","Limite por transferência (R$)",5000,0.01)}
            {cap("maxTransfersPerDayBrl","Limite agregado diário (R$)",10000,0.01)}
            <p className="auto-help">Sem banco/Pix integrado e sem beneficiários aprovados, este controle não envia dinheiro. Transferências novas ou sem mandato serão bloqueadas. Conciliações exigem comprovante assinado do provedor.</p>
          </>}
        </div>
      </section>
      <section className="auto-panel">
        <div className="auto-panel-head"><div><span className="auto-eyebrow"><Clock3 size={15}/> TRILHA DE AUDITORIA</span><h3>Ações registradas pelo servidor</h3><p>Não mostramos ações fictícias nem consideramos uma recomendação como execução.</p></div>
          <button type="button" className="auto-refresh" onClick={()=>void load()} disabled={busy}>Atualizar</button>
        </div>
        {audits.length===0?<p className="auto-help">Nenhuma execução verificada registrada neste ambiente.</p>:
          <div className="auto-log">{audits.map(log=><article key={log.id}>
            <strong>{log.action_kind}</strong><span>{log.status} · {log.reason_code}</span>
            <small>{new Date(log.created_at).toLocaleString("pt-BR")} · {log.summary || "Sem descrição"}
              {log.amount_brl!=null?" · "+money(log.amount_brl):""}</small>
          </article>)}</div>}
      </section>
    </>}
  </div>;
}
