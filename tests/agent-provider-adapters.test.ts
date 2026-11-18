import {describe,expect,test} from "bun:test";
import {createMetaAdsAdapter,createWhatsAppAdapter} from "../supabase/functions/_shared/agent-provider-adapters";
import type {AgentAction} from "../supabase/functions/_shared/agent-autonomy-policy";

const token="test-only-not-a-live-provider-access-token";
const actionPause:AgentAction={domain:"ads",kind:"ads.pause",idempotencyKey:"pause-policy-20261118-a",
  last7dClicks:100,last7dQualified:0,daysObserved:7,attributionVerified:true};
const actionBudget:AgentAction={domain:"ads",kind:"ads.adjust_budget",idempotencyKey:"budget-policy-20261118-a",
  previousDailyBudgetBrl:100,proposedDailyBudgetBrl:110,qualifiedLeads:5,daysObserved:7,attributionVerified:true};
const reply:AgentAction={domain:"atendimento",kind:"message.reply",idempotencyKey:"reply-policy-20261118-a",
  optIn:true,optedOut:false,humanHandoff:false,within24h:true,approvedTemplate:false,
  contentPolicyPassed:true,sentToday:2,sentToContactToday:1};

const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{"Content-Type":"application/json"}});

describe("official Meta / WhatsApp execution adapters (mock network only)",()=>{
  test("pauses only an ad confirmed under the authorized account and verifies readback",async()=>{
    let state="ACTIVE";let writes=0;const allUrls:string[]=[];
    const network=(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);allUrls.push(url);
      expect(init?.headers).toHaveProperty("Authorization","Bearer "+token);
      if(init?.method==="POST"){
        writes++;expect(new URLSearchParams(String(init.body)).get("status")).toBe("PAUSED");
        state="PAUSED";return json({success:true});
      }
      return json({id:"987654321",account_id:"123456789",configured_status:state});
    }) as typeof fetch;
    const adapter=createMetaAdsAdapter({token,adAccountId:"act_123456789",adId:"987654321"},network);
    const result=await adapter.execute(actionPause,actionPause.idempotencyKey);
    expect(result.providerRequestId).toContain("meta_readback");
    expect(writes).toBe(1);expect(allUrls).toHaveLength(3);
    expect(allUrls.every(url=>!url.includes(token))).toBe(true);
  });
  test("rejects Meta cross-account target before any write",async()=>{
    let writes=0;
    const network=(async(_input:RequestInfo|URL,init?:RequestInit)=>{
      if(init?.method==="POST")writes++;
      return json({id:"987654321",account_id:"another-ad-account",configured_status:"ACTIVE"});
    }) as typeof fetch;
    const adapter=createMetaAdsAdapter({token,adAccountId:"123456789",adId:"987654321"},network);
    await expect(adapter.execute(actionPause,actionPause.idempotencyKey)).rejects.toThrow("META_TARGET_NOT_OWNED");
    expect(writes).toBe(0);
  });
  test("refuses stale Meta budget and only writes exact centavos",async()=>{
    let budget=10000,writes=0;
    const network=(async(_input:RequestInfo|URL,init?:RequestInit)=>{
      if (String(_input).includes("/act_123456789?")) return json({id:"act_123456789",currency:"BRL"});
      if(init?.method==="POST"){
        budget=Number(new URLSearchParams(String(init.body)).get("daily_budget"));
        writes++;return json({success:true});
      }
      return json({id:"345678900",account_id:"123456789",daily_budget:String(budget)});
    }) as typeof fetch;
    const adapter=createMetaAdsAdapter({token,adAccountId:"123456789",adsetId:"345678900"},network);
    const result=await adapter.execute(actionBudget,actionBudget.idempotencyKey);
    expect(result.providerRequestId).toContain("345678900");expect(writes).toBe(1);
    expect(budget).toBe(11000);
    const stale={...actionBudget,previousDailyBudgetBrl:50};
    await expect(adapter.execute(stale,stale.idempotencyKey)).rejects.toThrow("META_STALE_BUDGET");
    expect(writes).toBe(1);
  });
  test("accepts only official WhatsApp message acknowledgment, not imagined delivery",async()=>{
    let body:unknown;
    const network=(async(input:RequestInfo|URL,init?:RequestInit)=>{
      expect(String(input)).toBe("https://graph.facebook.com/v27.0/12345678910/messages");
      body=JSON.parse(String(init?.body));return json({messages:[{id:"wamid.test-message-1"}]});
    }) as typeof fetch;
    const adapter=createWhatsAppAdapter({token,phoneNumberId:"12345678910",
      recipientWaId:"5531999999999",text:"Olá! Posso confirmar sua preferência de bairro?"},network);
    const result=await adapter.execute(reply,reply.idempotencyKey);
    expect(result.providerRequestId).toBe("wamid.test-message-1");
    expect((body as {type:string}).type).toBe("text");
  });
  test("requires preapproved WhatsApp template and rejects a malformed recipient",async()=>{
    const network=(async()=>{throw Error("Network must not be called");}) as typeof fetch;
    const conn={token,phoneNumberId:"12345678910",recipientWaId:"5531999999999"};
    const action:AgentAction={...reply,kind:"message.template",within24h:false,
      approvedTemplate:true,idempotencyKey:"template-policy-20261118-a"};
    await expect(createWhatsAppAdapter(conn,network).execute(action,action.idempotencyKey)).rejects.toThrow("WHATSAPP_TEMPLATE_NOT_ALLOWLISTED");
    expect(()=>createWhatsAppAdapter({...conn,recipientWaId:"not-a-number"},network)).toThrow("WHATSAPP_CONNECTION_INVALID");
  });
});
