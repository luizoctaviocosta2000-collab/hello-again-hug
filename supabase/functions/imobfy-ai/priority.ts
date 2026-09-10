export type PrioritySignal = {
  kind: "stalled_deal" | "proposal_followup" | "upcoming_visit" | "commission" | "lead_followup";
  score: number;
  title: string;
  reason: string;
  suggested_action: string;
  entity_id?: string;
};

type AnyRecord = Record<string, any>;
const daysBetween = (from: Date, to: Date) => Math.max(0, (to.getTime() - from.getTime()) / 86400000);

export function buildCommercialPriorities(context: {
  clients: AnyRecord[];
  deals: AnyRecord[];
  visits: AnyRecord[];
  proposals: AnyRecord[];
  commissions: AnyRecord[];
  activities: AnyRecord[];
  now?: Date;
}): PrioritySignal[] {
  const now = context.now ?? new Date();
  const priorities: PrioritySignal[] = [];
  for (const deal of context.deals) {
    if (["fechado_ganho", "fechado_perdido", "closed", "won", "lost"].includes(String(deal.stage || deal.status).toLowerCase())) continue;
    const createdAt = deal.created_at ? new Date(deal.created_at) : null;
    if (!createdAt) continue;
    const age = daysBetween(createdAt, now);
    if (age >= 5) priorities.push({kind:"stalled_deal",score:Math.min(98,55+Math.round(age*2)+(Number(deal.sale_value||deal.value||0)>0?10:0)),title:deal.title||deal.name||"Negócio parado",reason:`Este negócio está há ${Math.floor(age)} dias sem fechamento e precisa de uma próxima ação.`,suggested_action:"Revise o histórico e faça um follow-up com o cliente hoje.",entity_id:deal.id});
  }
  for (const proposal of context.proposals) {
    if (!["sent","enviada","pending","pendente"].includes(String(proposal.status||"").toLowerCase())) continue;
    const date=proposal.proposed_at?new Date(proposal.proposed_at):null;if(!date)continue;const age=daysBetween(date,now);
    if(age>=2) priorities.push({kind:"proposal_followup",score:Math.min(100,78+Math.min(18,Math.floor(age))),title:"Proposta aguardando retorno",reason:`A proposta está há ${Math.floor(age)} dias sem resposta registrada.`,suggested_action:"Entre em contato com o cliente e registre o retorno no Imobfy.",entity_id:proposal.id});
  }
  for(const visit of context.visits){const start=visit.starts_at?new Date(visit.starts_at):null;if(!start||start<now||["cancelled","canceled","done","completed"].includes(String(visit.status||"").toLowerCase()))continue;const hours=(start.getTime()-now.getTime())/3600000;if(hours<=48)priorities.push({kind:"upcoming_visit",score:Math.min(97,70+Math.max(0,Math.round(24-hours))),title:"Visita próxima",reason:`Existe uma visita agendada para ${start.toLocaleString("pt-BR")}.`,suggested_action:"Confirme a visita e deixe separados os imóveis que serão apresentados.",entity_id:visit.id})}
  for(const client of context.clients){const lastActivity=context.activities.filter(a=>a.client_id===client.id).sort((a,b)=>new Date(b.occurred_at||0).getTime()-new Date(a.occurred_at||0).getTime())[0];if(!lastActivity?.occurred_at)continue;const age=daysBetween(new Date(lastActivity.occurred_at),now);if(age>=7&&!['inativo','inactive'].includes(String(client.status||'').toLowerCase()))priorities.push({kind:"lead_followup",score:Math.min(92,60+Math.floor(age)),title:client.name||"Cliente sem contato",reason:`O último contato registrado foi há ${Math.floor(age)} dias.`,suggested_action:"Faça um follow-up e confirme se o perfil de busca continua o mesmo.",entity_id:client.id})}
  const pending=context.commissions.filter(c=>["a_receber","prevista","pending","receivable","partially_received"].includes(String(c.status||"").toLowerCase()));if(pending.length){const amount=pending.reduce((s,c)=>s+Number(c.user_amount||0),0);priorities.push({kind:"commission",score:58,title:"Comissões a receber",reason:`Há ${pending.length} comissão(ões) pendente(s), totalizando R$ ${amount.toLocaleString("pt-BR",{minimumFractionDigits:2})}.`,suggested_action:"Confira os vencimentos e acompanhe os pagamentos pendentes."})}
  return priorities.sort((a,b)=>b.score-a.score).slice(0,8);
}
