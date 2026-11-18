import {describe,expect,test} from "bun:test";
import {dispatchAgentAction,type AgentAuditPort} from "../supabase/functions/_shared/agent-autonomy-dispatch";
import {createDefaultPolicy,type AgentAction,type TrustedExecutionContext} from "../supabase/functions/_shared/agent-autonomy-policy";

const policy={...createDefaultPolicy("ads"),mode:"bounded" as const,emergencyStop:false,
  maxAdsDailyBudgetBrl:200,maxAdsBudgetChangePct:10};
const action:AgentAction={domain:"ads",kind:"ads.adjust_budget",idempotencyKey:"ads-dispatch-20261118-a",
  previousDailyBudgetBrl:100,proposedDailyBudgetBrl:105,qualifiedLeads:4,daysObserved:7,attributionVerified:true};
const ctx:Omit<TrustedExecutionContext,"auditReservationSucceeded"|"idempotencyKeyUnused">={
  actorAuthenticated:true,tenantBoundToProvider:true,providerConnected:true,
  evidenceVerified:true,evidenceAgeMinutes:15,operatorPausedAll:false,
};

function mockAudit(failAt?:string){
  const calls:string[]=[];
  const audit:AgentAuditPort={
    async reserve(){calls.push("reserve");if(failAt==="reserve")throw Error("DB down");return true;},
    async settle(_action,state){calls.push(state);if(failAt===state)throw Error("DB down");},
  };
  return {audit,calls};
}
describe("Autonomous dispatcher: no side effects without durable evidence",()=>{
  test("actually dispatches via a supplied provider only when authorized",async()=>{
    const {audit,calls}=mockAudit();
    let executions=0;
    const receipt=await dispatchAgentAction(policy,action,ctx,{audit,adapter:{
      async execute(_action,key){executions++;expect(key).toBe(action.idempotencyKey);return{providerRequestId:"meta-verified-123"};}
    }});
    expect(receipt.status).toBe("executed");
    expect(receipt.providerRequestId).toBe("meta-verified-123");
    expect(executions).toBe(1);
    expect(calls).toEqual(["reserve","executing","succeeded"]);
  });
  test("denies when the reservation fails (including replay)",async()=>{
    const {audit}=mockAudit("reserve");
    let executed=false;
    const result=await dispatchAgentAction(policy,action,ctx,{audit,adapter:{
      async execute(){executed=true;return{providerRequestId:"should-never-run"};}
    }});
    expect(result.status).toBe("denied");expect(executed).toBe(false);
    expect(result.decision.code).toBe("AUDIT_OR_REPLAY");
  });
  test("will never pretend provider is connected or action executed without adapter",async()=>{
    const {audit,calls}=mockAudit();
    const result=await dispatchAgentAction(policy,action,ctx,{audit});
    expect(result.status).toBe("denied");expect(calls).toEqual(["reserve","denied"]);
    expect(result.decision.recordedExecution).toBe(false);
  });
  test("freezes when operator has pressed global emergency stop",async()=>{
    const {audit,calls}=mockAudit();
    let executed=false;
    const result=await dispatchAgentAction(policy,action,{...ctx,operatorPausedAll:true},{
      audit,adapter:{async execute(){executed=true;return{providerRequestId:"x"};}},
    });
    expect(result.status).toBe("denied");expect(executed).toBe(false);
    expect(result.decision.code).toBe("EMERGENCY_STOP");
    expect(calls).toEqual(["reserve","denied"]);
  });
  test("does not send in assisted mode",async()=>{
    const {audit}=mockAudit();let executed=false;
    const result=await dispatchAgentAction({...policy,mode:"assisted"},action,ctx,{
      audit,adapter:{async execute(){executed=true;return{providerRequestId:"x"};}},
    });
    expect(result.status).toBe("requires_approval");expect(executed).toBe(false);
  });
  test("fails closed if audit cannot record start of an external action",async()=>{
    const {audit}=mockAudit("executing");let executed=false;
    const result=await dispatchAgentAction(policy,action,ctx,{
      audit,adapter:{async execute(){executed=true;return{providerRequestId:"x"};}},
    });
    expect(result.status).toBe("requires_reconciliation");expect(executed).toBe(false);
  });
  test("requires reconciliation if API succeeded but audit completion failed",async()=>{
    const {audit}=mockAudit("succeeded");let count=0;
    const result=await dispatchAgentAction(policy,action,ctx,{
      audit,adapter:{async execute(){count++;return{providerRequestId:"meta-999"};}},
    });
    expect(count).toBe(1);expect(result.status).toBe("requires_reconciliation");
    expect(result.providerRequestId).toBe("meta-999");
  });
  test("records provider failures instead of reporting success",async()=>{
    const {audit,calls}=mockAudit();
    const result=await dispatchAgentAction(policy,action,ctx,{
      audit,adapter:{async execute(){throw Error("Provider outage");}},
    });
    expect(result.status).toBe("failed");expect(calls).toEqual(["reserve","executing","failed"]);
  });
});
