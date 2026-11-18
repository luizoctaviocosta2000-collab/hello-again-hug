import type { AgentData, AgentReport, SpecialistKind } from "./specialist-agents.ts";

/** Versioned internal operating guidance, not legal advice or live external research. */
export const PLAYBOOK_VERSION = "2026-11-18.1";
export type SpecialistTask = {
  id: string;
  title: string;
  evidence: string;
  hypothesis: string;
  steps: string[];
  success: string;
  priority: "alta" | "media";
};
export type SpecialistPlan = {
  version: string;
  basis: string;
  questions: string[];
  tasks: SpecialistTask[];
  boundaries: string[];
};
const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const cents = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
};
const time = (v: unknown) => Date.parse(String(v ?? ""));
const questions: Record<SpecialistKind, string[]> = {
  ads: [
    "Qual imóvel, região e perfil de comprador a campanha pretende atender?",
    "Os leads têm origem confirmada e critérios de qualificação registrados?",
    "Qual limite de investimento foi aprovado e qual período será comparado?",
  ],
  atendimento: [
    "O cliente procura morar ou investir, em qual região e prazo?",
    "Qual faixa de valor e forma de pagamento ele informou, sem presumir aprovação de crédito?",
    "Quais requisitos são indispensáveis e qual próximo contato foi combinado?",
  ],
  comercial: [
    "A disponibilidade e as condições do imóvel foram confirmadas com o responsável?",
    "Qual objeção impede o próximo passo: aderência, preço, prazo ou documentação?",
    "Qual ação e data foram combinadas com o comprador?",
  ],
  financeiro: [
    "A comissão é de captação, venda ou ambas, e existe divisão acordada?",
    "Qual vencimento e condição de pagamento estão documentados?",
    "Os recibos foram confrontados com comprovantes de liquidação?",
  ],
};
const boundaries: Record<SpecialistKind, string[]> = {
  ads: [
    "Gastos manuais não são Ads Insights; atribuição de origem não prova causalidade.",
    "Não aumentar verba sem autorização nem prometer vendas. Confirmar regras atuais da plataforma antes de publicar.",
  ],
  atendimento: [
    "Rascunho e anotação interna não comprovam resposta enviada.",
    "Respeitar opt-out e repasse humano; não prometer disponibilidade, desconto ou financiamento.",
  ],
  comercial: [
    "Tempo sem atualização não prova ausência de contato.",
    "Visita, proposta e condições só são confirmadas pelos responsáveis; nunca inventar urgência.",
  ],
  financeiro: [
    "Registro no CRM não é extrato bancário. Não cobrar com base em divergência não conciliada.",
    "Não alterar valores, regras de divisão ou destinatários; nenhuma transferência é autorizada por este plano.",
  ],
};

export function buildSpecialistPlan(
  agent: SpecialistKind,
  data: AgentData,
  report: AgentReport,
  now: Date,
): SpecialistPlan {
  const plan: SpecialistPlan = {
    version: PLAYBOOK_VERSION,
    basis: "Roteiro operacional IMOBFY com evidências do CRM; sem pesquisa externa em tempo real.",
    questions: [...questions[agent]],
    tasks: [],
    boundaries: [...boundaries[agent]],
  };
  const add = (
    id: string,
    title: string,
    evidence: string,
    hypothesis: string,
    steps: string[],
    success: string,
    priority: "alta" | "media" = "media",
  ) => plan.tasks.push({ id, title, evidence, hypothesis, steps, success, priority });
  // Never recommend commercial/financial decisions on independently truncated sources.
  if (report.coverage !== "com_dados") {
    add(
      "validate-data",
      "Preparar uma base confiável",
      report.coverage === "amostra"
        ? "Uma ou mais fontes estão incompletas."
        : "Não há base suficiente para um diagnóstico desta área.",
      "A lacuna pode impedir uma recomendação adequada; não é sinal de baixo desempenho.",
      [
        "Conferir os registros e o período no módulo de origem.",
        "Completar ou consultar a base integral antes de comparar indicadores.",
        "Atualizar a análise após a conferência.",
      ],
      "Base completa e dados de origem conferidos.",
      "alta",
    );
    return plan;
  }
  const metric = (label: string) =>
    report.metrics.find((m) => m.label === label)?.value ?? "Não disponível";
  if (agent === "ads") {
    add(
      "ads-attribution",
      "Conferir atribuição antes de decidir investimento",
      `Investimento informado: ${metric("Investimento informado (30 dias)")}; leads vinculados: ${metric("Leads vinculados")}; qualificados: ${metric("Leads qualificados")}.`,
      "Diferenças podem vir da origem não registrada ou da qualidade dos contatos; os agregados não distinguem as causas.",
      [
        "Conferir conta, campanha, período e origem dos contatos no módulo Ads.",
        "Revisar uma amostra de leads: região, faixa de valor, prazo e aderência ao imóvel.",
        "Separar falta de rastreamento de falta de qualificação antes de mudar orçamento.",
      ],
      "Contatos com origem conferida e critério de qualificação consistente.",
      "alta",
    );
    add(
      "ads-experiment",
      "Desenhar um teste de criativo imobiliário",
      `Cliques registrados: ${metric("Cliques registrados (30 dias)")}.`,
      "A mensagem pode atrair curiosidade sem aderência; isso precisa ser testado, não presumido.",
      [
        "Escolher um imóvel com informações e autorização de divulgação confirmadas.",
        "Escrever duas versões variando apenas uma hipótese, como localização ou benefício de uso.",
        "Definir previamente período, limite aprovado e resultado observado: lead qualificado, não só clique.",
        "Submeter o teste à revisão; nenhum anúncio é criado por este plano.",
      ],
      "Hipótese documentada e comparação de qualidade com origem e gastos reconciliados.",
    );
  } else if (agent === "atendimento") {
    const active = (data.threads || []).filter((t) =>
      ["open", "handoff"].includes(String(t.status)),
    );
    let oldQuestions = 0;
    for (const thread of active) {
      const dates = (data.messages || [])
        .filter((m) => m.thread_id === thread.id && m.role === "customer")
        .map((m) => time(m.created_at))
        .filter((t) => Number.isFinite(t) && t <= now.getTime());
      if (dates.length && now.getTime() - Math.max(...dates) >= 86400000) oldQuestions++;
    }
    const handoffs = active.filter((t) => t.status === "handoff").length;
    add(
      "attendance-review",
      "Revisar fila e repasses humanos",
      `${handoffs} repasse(s) humano(s); ${oldQuestions} conversa(s) ativa(s) com última mensagem do cliente registrada há pelo menos 24 horas.`,
      "Uma mensagem antiga merece revisão, mas o registro interno não comprova atraso na resposta externa.",
      [
        "Atender primeiro os repasses ao corretor.",
        "Abrir o histórico e confirmar se houve resposta no canal autorizado; não tratar rascunho como envio.",
        "Registrar o próximo passo combinado e respeitar pedidos para interromper contato.",
      ],
      "Fila revisada e responsável/próximo passo identificados, sem envio duplicado.",
      handoffs || oldQuestions ? "alta" : "media",
    );
    add(
      "attendance-qualification",
      "Qualificar antes de recomendar um imóvel",
      `Conversas abertas: ${metric("Conversas abertas")}.`,
      "Sem necessidades e condições confirmadas, sugerir imóveis pode gerar contatos pouco úteis.",
      [
        "Usar as perguntas de qualificação abaixo, sem repetir o que já foi respondido.",
        "Conferir preço, disponibilidade e características no cadastro autorizado.",
        "Preparar uma resposta curta explicando a aderência e pedir confirmação humana antes de enviar.",
      ],
      "Necessidades confirmadas e sugestão de imóvel sustentada pelo cadastro, ou lacuna explicitada.",
    );
  } else if (agent === "comercial") {
    const stalled = metric("Sem atualização há 7+ dias");
    add(
      "sales-next-step",
      "Definir próximo passo para negócios parados",
      `Negócios sem atualização há 7+ dias: ${stalled}.`,
      "Pode haver uma objeção pendente ou simplesmente falta de registro; revisar antes de retomar contato.",
      [
        "Filtrar negócios abertos e conferir histórico de contato, proposta e visita.",
        "Classificar o impedimento: aderência ao imóvel, condição comercial, financiamento ou documentação.",
        "Preparar uma alternativa baseada no estoque confirmado e registrar ação, responsável e prazo após decisão humana.",
      ],
      "Negócio com próximo passo acordado ou motivo de encerramento registrado.",
      stalled !== "0" ? "alta" : "media",
    );
    add(
      "sales-visit",
      "Preparar visita e retorno",
      `Visitas nos próximos 7 dias: ${metric("Visitas nos próximos 7 dias")}.`,
      "Preparação reduz desencontro, mas agendamento registrado não comprova confirmação de todos.",
      [
        "Conferir interesse, disponibilidade do imóvel e confirmação dos participantes.",
        "Preparar roteiro ligado às necessidades do comprador, sem ocultar limitações conhecidas.",
        "Depois da visita, registrar aderência, objeções e próximo passo; proposta só com condições confirmadas.",
      ],
      "Visita confirmada por pessoas responsáveis e retorno documentado.",
    );
  } else {
    const receipts = new Map<string, number>();
    for (const r of data.receipts || [])
      receipts.set(
        String(r.commission_id),
        (receipts.get(String(r.commission_id)) || 0) + cents(r.amount),
      );
    let overdue = 0,
      overdueCents = 0,
      overpaid = 0,
      missingDue = 0;
    const today = now.toISOString().slice(0, 10);
    for (const c of data.commissions || []) {
      const amount = cents(c.user_amount),
        paid = receipts.get(String(c.id)) || 0,
        pending = Math.max(0, amount - paid);
      if (paid > amount) overpaid++;
      if (!pending || ["cancelada", "cancelled", "canceled"].includes(String(c.status))) continue;
      const due = String(c.due_date || "");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(due) ||
        !Number.isFinite(time(due)) ||
        new Date(due).toISOString().slice(0, 10) !== due
      )
        missingDue++;
      else if (due < today) {
        overdue++;
        overdueCents += pending;
      }
    }
    add(
      "finance-reconcile",
      "Conciliar antes de cobrar",
      `${overpaid} comissão(ões) com recibos acima do valor; ${missingDue} pendência(s) sem vencimento válido.`,
      "Pode haver divergência de cadastro, ajuste ou documento ausente; o diagnóstico não autoriza correção financeira.",
      [
        "Confrontar comissão e divisão acordadas com a venda e os recibos.",
        "Comparar cada recebimento com comprovante de liquidação, distinguindo recebimento parcial de quitação.",
        "Separar captação e venda e conferir impostos/participações configurados; não substituir regras por percentuais padrão.",
        "Submeter divergências ao responsável antes de corrigir ou cobrar.",
      ],
      "Valores e documentos reconciliados, sem alteração ou cobrança automática.",
      overpaid || missingDue ? "alta" : "media",
    );
    add(
      "finance-due",
      "Revisar vencimentos e recebimentos parciais",
      `${overdue} comissão(ões) vencida(s) com saldo registrado de ${brl(overdueCents)}; referência de data UTC.`,
      "Vencimento cadastrado não comprova inadimplência: pode existir acordo ou pagamento ainda não conciliado.",
      [
        "Conferir vencimento e condições contratuais de cada pendência.",
        "Verificar liquidação e eventuais renegociações antes de preparar contato.",
        "Levar ao responsável um resumo dos documentos e do saldo registrado.",
      ],
      "Pendências classificadas entre aguardando conciliação, acordo e acompanhamento autorizado.",
      overdue ? "alta" : "media",
    );
  }
  return plan;
}
