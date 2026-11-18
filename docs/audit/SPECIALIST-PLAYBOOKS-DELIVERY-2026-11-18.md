# Entrega: planos especializados com evidência

Base `18fa320fe5dfb6a95938b2875c177dea0991ee65`; branch `feat/specialist-playbooks-20261118`. Demanda: tornar os quatro especialistas apoio profissional útil ao corretor.

## Antes e depois

Antes: indicadores, recomendação curta e frase opcional Gemini. Agora: plano setorial versionado com evidência, hipótese explicitamente não confirmada, passos, critério de conclusão, prioridade, perguntas e limites. Funciona sem Gemini e entra no contexto anônimo ao pedir complemento. UI exibe passos expansíveis e inclui plano na cópia. Não alega execução ou persistência de tarefas.

- Ads: conferir origem/qualificação antes de investir; teste de criativo com variável isolada, período, limite aprovado e critério de qualidade.
- Atendimento: priorizar handoff e conversas ativas com última pergunta há 24h; não presumir resposta externa nem tratar rascunho como entrega. Perguntas de intenção, região, prazo e requisitos.
- Comercial: distinguir falta de atualização de falta de contato; investigar objeção antes de retomar; preparar visita e retorno com condições confirmadas.
- Financeiro: recibos parciais, recibos acima da comissão, vencimento ausente/inválido e saldo vencido. Canceladas não entram na sugestão de acompanhamento de vencimentos. Não declarar inadimplência nem substituir regras configuradas por percentuais fixos.
- Dados ausentes/amostra: somente tarefa de conferir a base, sem decisão setorial sobre fontes truncadas.

## Arquivos

`supabase/functions/_shared/specialist-playbooks.ts`: contratos e roteiro interno versionado `2026-11-18.1`. Importação apenas de tipos evita ciclo de runtime. `specialist-agents.ts`: campo opcional plan no AgentReport, preservando formato anterior.
Leitores local/Edge adicionam id de conversa e thread_id para correlação. Corpo, nomes, telefone, endereço e identificadores não entram no plano/contexto Gemini. Consultas mantêm user_id e RLS.
`SpecialistPlanView.tsx`: apresentação; `ImobfyAgentCenter.tsx`: renderização/cópia. CSS preserva cores e fornece foco de teclado. Nenhuma escrita no CRM.

## Validação

113 testes Bun, 356 assertions, TypeScript/build e lint lógico passaram. Seis avaliações determinísticas cobrem setores, ausência/amostra, parciais, vencimentos, hipóteses versus fatos e não propagação de PII/conteúdo malicioso da fixture. Não são avaliação semântica Gemini nem prova geral contra prompt injection.

Harness de navegador renderiza o componente real com fixtures em 390px e 1440px, quatro agentes, abertura dos passos, critério de conclusão, overflow e erros JS. Oito cenários passaram. Captura mobile inspecionada. Não equivale a fluxo autenticado na tela inteira. Evidências em `evidence-specialist-playbooks/`. CI deve compilar Edge via Deno antes do merge.

## Limites

Ainda não são especialistas treinados, pesquisa externa atualizada, memória de tarefas ou executor integrado. Plano levanta perguntas, mas não armazena respostas nem compreende corpo da conversa. Financeiro depende de registros/documentos corretos. Vencimentos usam referência UTC explicitamente; fuso de negócio requer contrato antes de alertas automáticos. Gemini continua complemento qualitativo, sem alterar métricas. Nenhum teste pago foi feito.

Para operação integral: dependências de produção por delta validado, Auth A/B e provider; memória auditável de tarefas e retrieval de fontes autorizadas/datadas com avaliação profissional; integrações oficiais com OAuth, ativos e permissões do titular. Não declarar pronto porque testes locais passaram.

## Publicação e rollback

Usuário já autorizou merge/publicação. Após CI, main e Edge staging com JWT. Não implantar especialista de produção sem schema/homologação; Lovable requer publicação separada indisponível nesta sessão. Reverter PR/versão Edge em caso de regressão, sem migration nem alteração de dados. Nova UI aceita resposta sem plan.
