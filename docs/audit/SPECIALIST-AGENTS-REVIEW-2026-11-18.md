# Quatro especialistas: auditoria e contrato de evolução

Base: `80f9d3c6acfd6617dc13b2cd00ff4dddda3fcad6`. Revisão de 18/11/2026. Escopo: código dos quatro especialistas, leitores local/Edge, UI e ligação com executor. Não é homologação de providers ou atualização de conhecimento externo.

## Conclusão independente

São quatro análises consultivas determinísticas, com complemento opcional de uma frase Gemini. Não são quatro agentes operacionais completos. A interface é explícita sobre ausência de ações automáticas; preservar essa honestidade. A camada atual é útil como primeiro diagnóstico, mas não sustenta sozinha o diferencial prometido.

Pontos corretos preservados: números calculados por código; consultas com JWT/RLS e filtro user_id; nenhuma service role no especialista; contexto enviado ao Gemini restrito a resumo sem identificadores; sem chamada paga quando não há dados ou há amostra; cota verificada; falha da IA mantém análise determinística; links internos não executam ações.

## Achados e correções desta entrega

| Prioridade | Causa/local | Reprodução e solução |
|---|---|---|
| P1 | `_shared/specialist-agents.ts`, cálculo `monthReceiptsCents`: só limite inferior textual | Recebimentos futuros e timestamp inválido entravam em "últimos 30 dias". Teste falhou antes; parse de timestamp e ambos os limites agora exigidos. Base completa de recebimentos não foi redefinida como extrato bancário. |
| P1 | Mesmo arquivo, `coming`: exclusão incompleta de status | `cancelado`, `realizado`, `no_show` e status desconhecido contavam como visita futura. Teste retornava 8 em vez de 4. Allowlist dos estados ativos português/inglês resolve sem migrar dados. |
| P2 | Mesmo arquivo, `last30`: subtração de 30 e inclusão das duas pontas | Ads incluía 31 datas. Agora hoje e 29 datas anteriores, explicitamente UTC. Financeiro usa janela móvel de 30×24 horas, não o filtro de datas de Ads. Fuso da conta Meta continua pendente da integração. |
| P1 | `src/lib/local-agent-report.ts` e `functions/imobfy-specialist-agents/index.ts`: detectar amostra apenas por `length===500` | Um limite de servidor de 100 podia ocultar 600 registros e autorizar Gemini sobre base parcial. Contagem exata e helper compartilhado agora detectam diferença/contagem ausente; 500 de 500 é completo. Teste puro cobre o contrato; HTTP com limite real ainda não homologado. |

Regressões: `tests/specialist-quality.test.ts`. Três cenários de lógica falharam antes da correção. 107 testes Bun/313 assertions passaram depois; TypeScript/build e CI registrados no PR. Sem migration nesta entrega.

## Limitações ainda abertas

1. **Conhecimento e profundidade (P1):** `domains` da Edge são prompts curtos; Gemini recebe apenas resumo e retorna frase até 700 caracteres. Não há retrieval, fontes datadas, memória operacional nem avaliações de qualidade especializadas. Validador sem números/URLs não detecta promessa enganosa escrita por extenso. Não ampliar permissões baseado nessa validação.
2. **Cobertura (P1):** dados limitados a 500 por fonte. A correção sinaliza amostra, não elimina amostragem nem resolve snapshot concorrente. Comissões e recebimentos são truncados independentemente; seus saldos não devem ser promovidos a totais oficiais. Agregação SQL por tenant e período é próxima entrega, com testes e delta revisado.
3. **Atendimento superficial (P1):** só status e quantidade de mensagens, sem SLA, última mensagem do cliente, objeções, intenção ou imóveis disponíveis. Não pode afirmar que compreendeu a conversa.
4. **Comercial superficial (P1):** só status/etapa/datas e visitas. Sem propostas, perfil do comprador, aderência ao imóvel ou histórico de contato; negócio sem atualização não prova cliente sem contato.
5. **Ads manual (P1):** nenhum OAuth/Insights operacional; origem vinculada não prova atribuição causal. Não aumentar orçamento a partir desses indicadores. Faltam fuso/moeda, janela de atribuição e sincronização por conta.
6. **Financeiro consultivo (P1):** dados registrados não comprovam liquidação bancária. Falta priorização por vencimento e reconciliação oficial; não gerar pagamento nem novo lançamento com modelo.
7. **Execução desconectada (P1):** busca por `dispatchAgentAction`, `createMetaAdsAdapter` e `AgentAuditPort` não encontrou chamador operacional. Contrato não é worker: faltam política carregada no servidor, fila, contadores atômicos, outbox, assinatura de webhook e reconciliação. Não ativar bounded.
8. **Infraestrutura/E2E (P0 de liberação integral):** produção sem as sete tabelas de inteligência/autonomia e sem Edge dos especialistas na última inspeção. JWT real de duas contas, provider Gemini e jornada autenticada ainda pendentes. Publicação Lovable também não é provada pelo merge.

## Contrato de produto proposto — não apresentado como já implementado

Todo diagnóstico deve mostrar: fato observado e período → fonte/data da consulta → hipótese e incerteza → tarefa sugerida → aprovação necessária → evidência de execução → resultado observado. Sem dados suficientes, perguntar ou declarar limite. "Confiança" não será percentual inventado pelo modelo.

| Especialista | Entrega útil ao corretor | Dados necessários | Evidência de sucesso |
|---|---|---|---|
| Ads | Indicar campanha a investigar e teste de criativo/público com hipótese explícita | Insights oficial por conta, moeda/fuso, gastos, origem e evolução dos leads | Custo por lead qualificado reconciliado e comparação por período; sem promessa de venda |
| Atendimento | Priorizar fila, qualificar necessidade e sugerir resposta apoiada no imóvel | Última interação, consentimento, intenção, canal, estoque autorizado e handoff | Tempo de resposta, qualificação completa e encaminhamento correto; rascunho não conta como envio |
| Comercial | Apontar oportunidade concreta e próximo passo entre lead, visita e proposta | Necessidades do comprador, disponibilidade do imóvel, visitas, proposta e histórico | Tarefa concluída e evolução registrada, sem atribuir causalidade automática ao agente |
| Financeiro | Explicar comissão/vencimento, detectar divergência e orientar conciliação | RPCs oficiais, regras de divisão, recibos e eventual extrato autorizado | Valores conciliados e divergências resolvidas; jamais movimento bancário pelo modelo |

Identidade IMOBFY: operação imobiliária brasileira; distinguir captação/venda/meiadas, informações confirmadas do imóvel e simulação de financiamento. Linguagem direta de corretor, sem pressão ou promessas. Comportamento vem de regras, fontes e avaliações, não de títulos grandiosos no prompt.

## Sequência de implementação

1. **Dados confiáveis e casos fictícios:** concluir Auth A/B e consultas completas/agregadas; definir cenários de vendas, visitas, comissões e atendimento. Gate: vazamento zero, valores reconciliados, falhas explícitas.
2. **Consultoria útil:** contrato de recomendação estruturada com evidências e tarefa; playbooks imobiliários versionados, revisão humana e fontes autorizadas com data/validade. Retrieval isolado por tenant; conteúdo recuperado não concede permissões. Gate: nenhum número ou imóvel inventado; insuficiência de evidência detectada; revisão de respostas por corretor.
3. **Memória de tarefas e resultado:** registrar sugestão, aprovação, executor, prazo e resultado; diferenciar sugerido/aprovado/executado/confirmado. Gate: histórico auditável e ação sem comprovante nunca marcada concluída.
4. **Integrações em leitura:** Meta OAuth/Insights e ingestão oficial de canais sandbox. Gate: titularidade da conta, escopos mínimos, tokens protegidos, webhook assinado, dedupe e custos reconciliados.
5. **Ações assistidas:** uma capacidade por vez, com confirmação humana. Política/limite/kill switch checados no servidor imediatamente antes da execução; reserva atômica e chave idempotente. Gate: dois workers concorrentes não duplicam efeito; timeout requer reconciliação.
6. **Autonomia limitada:** somente para ações aprovadas como elegíveis, depois de testes operacionais; campanhas/mensagens/dinheiro real exigem autorizações próprias. Finanças permanecem consultivas nesta evolução.

Avaliações obrigatórias: tenant trocado; prompt injection em CRM/fonte externa; fonte vencida ou conflitante; ausência/amostra de dados; não inventar disponibilidade/preço/financiamento; pedido de envio sem consentimento; provider indisponível; orçamento agregado concorrente; kill switch durante retry; aprovação expirada; token de outra conta; comprovante ausente. Avaliações semânticas do Gemini são separadas dos testes unitários; registrar modelo, versão do playbook, custo e decisão de aprovação.

## Publicação e rollback

Correções compatíveis com formato atual de AgentReport, sem mudança de schema. Publicar leitor frontend via main/Lovable e mesma lógica na Edge de staging. Não implantar especialista em produção sem suas dependências e teste autenticado. Rollback por reversão do PR/versão Edge anterior; não reverter proteção de fotos nem ativar executor externo. O relatório de passagem anexado é contexto, não prova nem nova autorização operacional.
