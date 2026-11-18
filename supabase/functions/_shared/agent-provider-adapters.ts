import type {AgentAction} from "./agent-autonomy-policy.ts";
import type {AgentActionAdapter} from "./agent-autonomy-dispatch.ts";

/**
 * Provider adapters use credentials resolved by a trusted backend from a
 * verified tenant-owned connection. NEVER instantiate from browser/model input.
 * No connector discovery or token storage is performed here.
 */
type Fetcher = typeof fetch;
type JsonObject = Record<string, unknown>;
const graphRoot = "https://graph.facebook.com/v27.0/";
const graphId = (s:string) => /^\d{6,25}$/.test(s);
const tokenOK = (s:string) => typeof s==="string" && s.length>20 && !/[\r\n]/.test(s);
const plainObject = (x:unknown):x is JsonObject => !!x && typeof x==="object" && !Array.isArray(x);
const objectJSON=async(r:Response):Promise<JsonObject>=>{
  const x:unknown=await r.json().catch(()=>null);
  if(!r.ok || !plainObject(x) || x.error)throw new Error("PROVIDER_REQUEST_REJECTED");
  return x;
};
const accountNumber=(account:string)=>account.replace(/^act_/,"");
const cents=(brl:number)=>Math.round(brl*100);

export interface TrustedMetaConnection {
  token:string;adAccountId:string;adId?:string;adsetId?:string;
}
/** Requires campaign/adset IDs and tenant ownership to have been proven by the caller. */
export function createMetaAdsAdapter(
  connection:TrustedMetaConnection,
  fetcher:Fetcher=fetch,
):AgentActionAdapter {
  const account=accountNumber(connection.adAccountId);
  if(!graphId(account)||!tokenOK(connection.token))throw new Error("META_CONNECTION_INVALID");
  const request=async(id:string,options?:RequestInit,fields?:string)=>{
    if(!graphId(id))throw new Error("META_TARGET_INVALID");
    const url=graphRoot+id+(fields?"?fields="+encodeURIComponent(fields):"");
    const resp=await fetcher(url,{
      ...options,
      headers:{
        Authorization:"Bearer "+connection.token,
        ...(options?.headers||{}),
      },
      signal:AbortSignal.timeout(12_000),
    });
    return objectJSON(resp);
  };
  const assertOwner=(record:JsonObject,id:string)=>{
    if(String(record.id)!==id||accountNumber(String(record.account_id||""))!==account)
      throw new Error("META_TARGET_NOT_OWNED");
  };
  return {
    async execute(action:AgentAction,idempotencyKey:string){
      if(action.domain!=="ads")throw new Error("META_WRONG_DOMAIN");
      if(action.kind==="ads.pause"){
        const id=connection.adId;
        if(!id)throw new Error("META_TARGET_MISSING");
        const before=await request(id,undefined,"id,account_id,configured_status");
        assertOwner(before,id);
        if(before.configured_status!=="PAUSED"){
          await request(id,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
            body:new URLSearchParams({status:"PAUSED"})});
        }
        const after=await request(id,undefined,"id,account_id,configured_status");
        assertOwner(after,id);
        if(after.configured_status!=="PAUSED")throw new Error("META_READBACK_NOT_PAUSED");
        return {providerRequestId:"meta_readback:"+id+":"+idempotencyKey};
      }
      if(action.kind==="ads.adjust_budget"){
        const id=connection.adsetId;
        if(!id)throw new Error("META_ADSET_MISSING");
        // Budgets below are expressed in BRL. Resolve currency from Meta itself,
        // never from a browser-provided connection or inferred country.
        const accountResponse = await fetcher(graphRoot + 'act_' + account + '?fields=id,currency', {
          headers: { Authorization: 'Bearer ' + connection.token },
          signal: AbortSignal.timeout(12_000),
        });
        const accountData = await objectJSON(accountResponse);
        if (String(accountData.id) !== 'act_' + account || accountData.currency !== 'BRL')
          throw new Error('META_ACCOUNT_CURRENCY_UNSUPPORTED');
        const before=await request(id,undefined,"id,account_id,daily_budget");
        assertOwner(before,id);
        const providerCents=Number(before.daily_budget);
        const expectedCents=cents(action.previousDailyBudgetBrl);
        const newCents=cents(action.proposedDailyBudgetBrl);
        if(!Number.isSafeInteger(providerCents)||!Number.isSafeInteger(newCents)||newCents<=0)
          throw new Error("META_CURRENCY_INVALID");
        if(providerCents!==expectedCents)
          throw new Error("META_STALE_BUDGET");
        await request(id,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
          body:new URLSearchParams({daily_budget:String(newCents)})});
        const after=await request(id,undefined,"id,account_id,daily_budget");
        assertOwner(after,id);
        if(Number(after.daily_budget)!==newCents)throw new Error("META_READBACK_BUDGET_MISMATCH");
        return {providerRequestId:"meta_readback:"+id+":"+idempotencyKey};
      }
      throw new Error("META_ACTION_REQUIRES_MANUAL_REVIEW");
    },
  };
}

export interface TrustedWhatsAppConnection {
  token:string;phoneNumberId:string;recipientWaId:string;
  text?:string;
  approvedTemplate?:{name:string;language:string};
}
/** Cloud API acknowledgement is NOT a delivery receipt; await signed webhooks. */
export function createWhatsAppAdapter(
  connection:TrustedWhatsAppConnection,
  fetcher:Fetcher=fetch,
):AgentActionAdapter {
  if(!tokenOK(connection.token)||!graphId(connection.phoneNumberId)||
    !/^\d{8,15}$/.test(connection.recipientWaId))throw new Error("WHATSAPP_CONNECTION_INVALID");
  return {
    async execute(action:AgentAction){
      if(action.domain!=="atendimento")throw new Error("WHATSAPP_WRONG_DOMAIN");
      let payload:JsonObject;
      if(action.kind==="message.reply"){
        const body=connection.text?.trim()||"";
        if(body.length<1||body.length>1000)throw new Error("WHATSAPP_TEXT_INVALID");
        payload={messaging_product:"whatsapp",to:connection.recipientWaId,type:"text",
          text:{preview_url:false,body}};
      }else if(action.kind==="message.template"){
        const template=connection.approvedTemplate;
        if(!template||!/^[a-z0-9_]{1,180}$/.test(template.name)||
          !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(template.language))
          throw new Error("WHATSAPP_TEMPLATE_NOT_ALLOWLISTED");
        payload={messaging_product:"whatsapp",to:connection.recipientWaId,type:"template",
          template:{name:template.name,language:{code:template.language}}};
      }else throw new Error("WHATSAPP_UNSUPPORTED_ACTION");

      const response=await fetcher(graphRoot+connection.phoneNumberId+"/messages",{
        method:"POST",headers:{
          Authorization:"Bearer "+connection.token,
          "Content-Type":"application/json",
        },body:JSON.stringify(payload),signal:AbortSignal.timeout(12_000),
      });
      const output=await objectJSON(response);
      const messages=output.messages;
      const first=Array.isArray(messages)?messages[0]:null;
      const id=plainObject(first)?first.id:null;
      if(typeof id!=="string"||!/^wamid\./.test(id)||id.length>180)
        throw new Error("WHATSAPP_ACKNOWLEDGMENT_MISSING");
      return {providerRequestId:id};
    },
  };
}
