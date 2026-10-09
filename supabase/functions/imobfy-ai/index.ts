import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json"}});const wait=(n:number)=>new Promise(r=>setTimeout(r,n));
async function ask(key:string,m:string,system:string,contents:any[]){const u=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`;const body={systemInstruction:{parts:[{text:system}]},contents,generationConfig:{temperature:.25,maxOutputTokens:1400}};let status=0,text="";const deadline=Date.now()+23000;for(let i=0;i<3;i++){const remaining=deadline-Date.now();if(remaining<=0)break;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),Math.min(7000,remaining));try{const r=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal});if(r.ok)return await r.json();status=r.status;text=await r.text();if(![429,500,502,503,504].includes(status)||i===2)break;}catch(e){if((e as Error)?.name==="AbortError"){status=504;text="Tempo limite da IA excedido.";}else throw e;}finally{clearTimeout(timeout)}if(Date.now()<deadline)await wait(Math.min(700*(i+1),Math.max(0,deadline-Date.now())))}throw new Error(`Gemini (${status}): ${text||"tempo limite excedido"}`);}Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="POST")return out({error:"Método não permitido."},405);const auth=req.headers.get("Authorization"),key=Deno.env.get("GEMINI_API_KEY")?.trim();if(!auth)return out({error:"Não autenticado."},401);if(!key)return out({error:"A chave Gemini não está disponível no servidor."},503);const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});const {data:{user},error:ue}=await sb.auth.getUser();if(ue||!user)return out({error:"Sessão inválida."},401);let b:any={};try{b=await req.json()}catch{}const q=String(b.question||"").trim();if(!q)return out({error:"Digite uma pergunta."},400);let cid=typeof b.conversation_id==="string"?b.conversation_id.trim():null;if(!cid||cid==="null"||cid==="undefined"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cid))cid=null;if(cid){const {data:c,error}=await sb.from("ai_conversations").select("id").eq("id",cid).eq("user_id",user.id).maybeSingle();if(error||!c)cid=null}if(cid){/* existing conversation validated above */}const lower=q.toLocaleLowerCase("pt-BR");
const normalized=lower.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"");
const has=(...terms:string[])=>terms.some(t=>normalized.includes(t));
const matches=(pattern:RegExp)=>pattern.test(normalized);
let intent:"finance"|"vgv"|"clients"|"properties"|"deals"|"visits"|"general"="general";
if(has("vgv","volume geral de vendas","meta de vgv")||matches(/\bmeta\b.*\bvgv\b/))intent="vgv";
else if(has("agenda","agendamento","agendamentos","compromisso","compromissos","tarefa","tarefas","visita","visitas")||matches(/\b(hoje|amanha)\b.*\b(agenda|visita|compromisso|tarefa)\b/))intent="visits";
else if(has("comissao","comissoes","financeiro","dinheiro","a receber","receber","recebimento","recebimentos","quanto tenho para receber","quanto vou receber","quanto recebo")||matches(/\b(vencid|pagament|recebiment|comiss)\w*/))intent="finance";
else if(has("cliente","clientes","lead","leads","prospect","prospects")||matches(/\bquem\b.*\b(cliente|lead)\b/))intent="clients";
else if(has("imovel","imoveis","estoque","captacao","captacoes","captado","captados","proprietario","proprietarios")||matches(/\b(casa|apartamento|apto)\b/))intent="properties";
else if(has("negocio","negocios","negociacao","negociacoes","pipeline","fechamento","fechamentos","venda","vendas","proposta","propostas","deal","deals")||matches(/\b(fechar|fechou|fechando|negociar|negociando)\b/))intent="deals";
else if(has("visita","visitas","agenda","agendamento","agendamentos","compromisso","compromissos")||matches(/\b(hoje|amanha)\b.*\b(agenda|visita|compromisso)\b/))intent="visits";
const pick=async(table:string,select:string,limit=200)=>{const r=await sb.from(table).select(select).eq("user_id",user.id).limit(limit);if(r.error)throw r.error;return r.data||[]};
let context:any={};
if(intent==="finance"){
 const [financial,commissionRows]=await Promise.all([
   sb.rpc("get_ai_financial_summary"),
   sb.rpc("get_ai_commission_summary",{p_limit:30})
 ]);
 if(financial.error||commissionRows.error)throw financial.error||commissionRows.error;
 context={finance_summary:financial.data||{},commissions:commissionRows.data||[]};
}else if(intent==="vgv"){
 const v=await sb.rpc("get_ai_vgv_summary",{p_from:null,p_to:null});if(v.error)throw v.error;
 context={vgv_summary:v.data||{}};
}else if(intent==="clients"){
 const [clients,deals,activities]=await Promise.all([
   pick("clients","id,name,email,phone,intent,budget_min,budget_max,preferred_neighborhoods,property_types,bedrooms_min,status,created_at,updated_at",300),
   pick("deals","id,property_id,client_id,status,property_value,created_at,updated_at,closed_at,expected_close_at,title,stage,operation_value,sale_value",200),
   pick("activities","id,client_id,deal_id,property_id,activity_type,title,description,occurred_at",300)
 ]);
 context={clients,deals,activities};
}else if(intent==="properties"){
 const [properties,captures]=await Promise.all([
   pick("properties","id,title,address,neighborhood,city,state,property_type,bedrooms,bathrooms,parking_spaces,area_m2,sale_value,asking_price,status,owner_name,owner_phone,notes,created_at,updated_at",300),
   pick("captures","id,property_id,status,captured_at,commission_pct,notes",300)
 ]);
 context={properties,captures};
}else if(intent==="deals"){
 const [deals,proposals,sales,properties]=await Promise.all([
   pick("deals","id,property_id,client_id,status,property_value,brokerage_pct,tax_pct,participation_pct,sides,notes,created_at,updated_at,closed_at,expected_close_at,title,stage,operation_value,sale_value",300),
   pick("proposals","id,deal_id,property_id,amount,status,financing,down_payment,proposed_at,responded_at,notes",300),
   pick("sales","id,deal_id,property_id,proposal_id,sale_value,sold_at,notes",200),
   pick("properties","id,title,neighborhood,city,property_type,bedrooms,asking_price,sale_value,status",300)
 ]);
 context={deals,proposals,sales,properties};
}else if(intent==="visits"){
 const [visits,appointments,visitProperties,clients,properties]=await Promise.all([
   pick("visits","id,deal_id,client_id,starts_at,ends_at,status,location,notes,created_at,updated_at",300),
   pick("appointments","id,title,starts_at,ends_at,status,notes,client_id,property_id,deal_id,created_at,updated_at",300),
   pick("visit_properties","id,visit_id,property_id,sequence,visited,notes",500),
   pick("clients","id,name,phone,status",300),
   pick("properties","id,title,neighborhood,city,property_type,asking_price,status",300)
 ]);
 context={visits,appointments,visit_properties:visitProperties,clients,properties};
 const sortByStart=(rows:any[])=>[...rows].sort((a,b)=>{
   const ta=Date.parse(a.starts_at||"");
   const tb=Date.parse(b.starts_at||"");
   if(!Number.isFinite(ta))return Number.isFinite(tb)?1:0;
   if(!Number.isFinite(tb))return -1;
   return ta-tb;
 });
 const now=new Date();
 context={
   ...context,
   visits:sortByStart(visits),
   appointments:sortByStart(appointments),
   agenda_reference:{
     timezone:"America/Sao_Paulo",
     now_iso:now.toISOString(),
     now_local:new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"full",timeStyle:"long"}).format(now),
     instructions:"Use esta referência para interpretar hoje, amanhã e atrasos no fuso America/Sao_Paulo. Compare starts_at com o horário atual. Só classifique como atrasado se o horário já passou e o status não indicar conclusão ou cancelamento. Preserve o status original; se o status for ambíguo, informe a ambiguidade em vez de presumir."
   }
 };
}else{
 const [clients,properties,deals,commissions,vgv,visits,appointments,proposals,sales,activities]=await Promise.all([
   pick("clients","id,name,intent,budget_min,budget_max,preferred_neighborhoods,property_types,bedrooms_min,status,created_at,updated_at",150),
   pick("properties","id,title,neighborhood,city,property_type,bedrooms,bathrooms,parking_spaces,area_m2,sale_value,asking_price,status,created_at,updated_at",150),
   pick("deals","id,property_id,client_id,status,property_value,created_at,updated_at,closed_at,expected_close_at,title,stage,operation_value,sale_value",150),
   pick("commissions","id,deal_id,property_value,user_amount,status,received_at,due_date,paid_at,commission_type,reference_month",150),
   pick("vgv_entries","id,deal_id,property_value,month,reference_month,vgv",150),
   pick("visits","id,deal_id,client_id,starts_at,ends_at,status,location,notes,created_at,updated_at",150),
   pick("appointments","id,title,starts_at,ends_at,status,notes,client_id,property_id,deal_id,created_at,updated_at",150),
   pick("proposals","id,deal_id,property_id,amount,status,financing,down_payment,proposed_at,responded_at",150),
   pick("sales","id,deal_id,property_id,proposal_id,sale_value,sold_at",150),
   pick("activities","id,client_id,deal_id,property_id,activity_type,title,description,occurred_at",200)
 ]);
 context={clients,properties,deals,commissions,vgv,visits,appointments,proposals,sales,activities};
}
let history:any[]=[];if(cid){const {data:rows,error:he}=await sb.from("ai_messages").select("role,content,created_at").eq("conversation_id",cid).eq("user_id",user.id).order("created_at",{ascending:false}).limit(20);if(he)throw he;history=rows||[];}
const contents=(history||[]).reverse().filter((m:any)=>m.role==="user"||m.role==="assistant").map((m:any)=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]}));
contents.push({role:"user",parts:[{text:q}]});
const system=`Você é o Imobfy AI, cérebro comercial de um CRM imobiliário. Responda em português do Brasil, objetiva e acionável. Ajude o corretor a CAPTAR, VENDER, RECEBER ou DECIDIR melhor. Nunca invente dados; use somente o contexto fornecido. Não exponha IDs internos. Para financeiro, VGV e comissões, trate os números recebidos como fonte determinística e não refaça cálculos com regras próprias. Se faltar dado, diga o que falta. Não diga que executou algo se apenas recomendou.
Intenção detectada: ${intent}. Para perguntas sobre agenda, diferencie visitas imobiliárias (tabela visits) de tarefas e compromissos pessoais/comerciais (tabela appointments). Quando existir agenda_reference, use explicitamente o horário atual e o fuso America/Sao_Paulo para interpretar hoje, amanhã e atrasos. Ordene mentalmente os compromissos pelo início; use starts_at e status originais. Só diga que algo está atrasado quando o início já passou e o status não indicar conclusão ou cancelamento. Se o status for ambíguo, explique a incerteza. Não presuma que uma tarefa foi concluída sem status correspondente.
CONTEXTO:
${JSON.stringify(context)}`;
try{const m=Deno.env.get("GEMINI_MODEL")?.trim()||"gemini-2.5-flash-lite";const r=await ask(key,m,system,contents);const answer=(r.candidates?.[0]?.content?.parts||[]).map((p:any)=>p.text||"").join("\n").trim();if(!answer)return out({error:"Não consegui gerar uma resposta agora."},502);const {data:nc,error:ce}=cid?{data:{id:cid},error:null as any}:await sb.from("ai_conversations").insert({user_id:user.id,title:q.slice(0,80)}).select("id").single();if(ce||!nc)return out({error:"A resposta foi gerada, mas não consegui salvar a conversa."},500);cid=nc.id;const um=await sb.from("ai_messages").insert({user_id:user.id,conversation_id:cid,role:"user",content:q});if(um.error)return out({error:"A resposta foi gerada, mas não consegui registrar sua pergunta."},500);await sb.from("ai_messages").insert({user_id:user.id,conversation_id:cid,role:"assistant",content:answer});await sb.from("ai_conversations").update({updated_at:new Date().toISOString()}).eq("id",cid).eq("user_id",user.id);return out({answer,conversation_id:cid,model:m})}catch(e){const msg=e instanceof Error?e.message:String(e);console.error(msg);if(/503|high demand/i.test(msg))return out({error:"O Gemini está temporariamente sob alta demanda. O Imobfy tentou novamente automaticamente; tente de novo em alguns segundos."},503);return out({error:`Não consegui falar com a IA. ${msg}`},502)}});
