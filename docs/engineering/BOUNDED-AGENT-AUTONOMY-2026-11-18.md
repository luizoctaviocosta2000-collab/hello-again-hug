# IMOBFY — Autonomia operacional dos agentes
18 de novembro de 2026 | Base: PR #70

## Visão
O objetivo agora é executar ações reais — não apenas sugerir — quando contas oficiais, consentimentos e limites estiverem habilitados. Modelos generativos propõem ações estruturadas, mas não possuem tokens Meta, WhatsApp ou bancários. A decisão de executar passa por uma política determinística do backend, por reserva transacional com idempotência, por validação de identidade e por um adaptador oficial.

**Esta fase prepara controles e despacho. Não conecta APIs externas nem movimenta dinheiro.**

## O que os quatro agentes poderão fazer

| Área | Automático com limites | Quando precisa de intervenção |
| --- | --- | --- |
| Ads | Pausa de anúncio com amostra/atribuição confirmada e ajustes pequenos de orçamento com teto diário | Criativos, reativação, aumentos acima do limite, dados insuficientes |
| Atendimento | Responder clientes com consentimento, dentro de janela ou via template autorizado, limites diários e handoff | Opt-out, proposta comercial, negociação, reclamações e janela fechada |
| Comercial | Criar follow-ups internos para clientes comprovados em horários válidos | Confirmação de visita, proposta, alteração contratual |
| Financeiro | Conciliar pagamento com webhook assinado; futuramente transferir a beneficiário fixo previamente aprovado | Pix a novo destinatário, falta de mandato bancário, exceção de saldo/valor, pagamentos acima do teto |

O motor usa modos off / assisted / bounded. O padrão é **off + emergência ligada** em todas as áreas e no bloqueio global. A UI não executa mensagens, Ads nem transferências só por salvar um modo.

## Código desta fase
- supabase/functions/_shared/agent-autonomy-policy.ts: decide deny, needs_approval ou allow.
- supabase/functions/_shared/agent-autonomy-dispatch.ts: reserva a tentativa com chave única e trilha de auditoria, verifica a decisão e só chama um adaptador oficial se existir; não informa sucesso até receber resposta do provider.
- supabase/functions/_shared/agent-provider-adapters.ts: adaptadores HTTP para Meta Ads (pausa e orçamento de conjunto com validação de conta/estado anterior e readback) e WhatsApp Cloud API (texto/template e recibo de aceite). Não fazem OAuth nem armazenam credenciais; precisam de ligação segura a tokens de cada tenant. Testados somente com respostas mock.
- supabase/migrations/20261118180000_agent_autonomy_control_plane.sql: políticas com RLS por proprietário, bloqueio global e auditoria sem INSERT/UPDATE pelo usuário.
- src/components/ImobfyAutonomyConsole.tsx: configura modos, limites, bloqueio geral e consulta histórico real pela sessão.
- tests/agent-autonomy-policy.test.ts, tests/agent-autonomy-dispatch.test.ts e testes/database/agent_autonomy_regression.sql: cenários de autorização, replay, consentimento, orçamento, Pix e isolamento.
- .github/workflows/agent-autonomy.yml: testes PostgreSQL 17 em ambiente descartável.

## Requisitos antes de qualquer execução real
1. Backend lê política atual, bloqueio global e integrações por conta autenticada. Nunca aceita contexto, conta, saldo, destino ou aprovação fornecidos pelo navegador ou pela IA.
2. Reserva única por user_id/idempotency_key antes de chamada externa, limite diário reservado de forma transacional, plano de retry e conciliação pós-timeout.
3. Verifica consentimento, opt-out, handoff e janela/templates WhatsApp; valida assinatura HMAC do webhook e status de entrega.
4. Meta: OAuth oficial, Marketing API e Insights, contas vinculadas por usuário, limites de gasto real e mudanças com readback. Medir CPL, custo por lead qualificado, visitas e vendas, nunca confundir origem manual com Meta real.
5. Banco/Pix: parceiro financeiro autorizado, conta e destinatário validados fora do modelo, forte autenticação/mandato delegado, saldo comprovado e limites de transferência; nada pode sair para novo beneficiário sem confirmação humana.
6. Kill switch efetivo e alarmes em todos os workers, observabilidade e logs sem PII; teste de transações concorrentes e suspensão instantânea.
7. Critério de qualidade do conhecimento: playbooks versionados com fontes oficiais, dados reais do CRM, retrieval autorizado, avaliação de alucinações, falsos positivos, custo operacional e impacto em leads qualificados/vendas. Nunca alegar resultado garantido.

## Plano de ativação
- Etapa 1: código e regressões Bun/TypeScript/build/PostgreSQL 17.
- Etapa 2: migration aplicada em staging no projeto etcdlxkpidiqbgdayiol, com três tabelas novas protegidas por RLS e sem contas Auth reais no ambiente. Ainda faltam duas contas de teste, auditoria, kill switch e simulação HTTP ponta a ponta.
- Etapa 3: conectar Meta somente leitura/Insights; WhatsApp oficial com consentimento e webhook; banco apenas com provider regulado e mandato.
- Etapa 4: shadow (decidir sem executar), assisted (aprovação), bounded (baixo risco e tetos).
- Etapa 5: go/no-go de produção, migration aprovada, release Lovable por commit, análise de reversão e alertas.

### Fontes técnicas a manter atualizadas
- https://developers.facebook.com/docs/marketing-api/insights/
- https://developers.facebook.com/docs/graph-api/reference/ad-campaign/
- https://developers.facebook.com/docs/whatsapp/cloud-api
- https://supabase.com/docs/guides/functions/auth

## Limites atuais
A conexão Meta disponível via ChatGPT **não fornece tokens ao IMOBFY**. Meta Ads, WhatsApp, Instagram e banking/Pix continuam sem autenticação operacional dentro do app. Os adaptadores Meta e WhatsApp já existem como código e passaram por simulações; ainda não estão ligados a OAuth, à fila de eventos nem a credenciais reais do IMOBFY. O despachante não tem worker ativo nem qualquer transferência bancária. Sem adapter, toda ação real é negada, não simulada como sucesso. Nenhuma mudança de produção está autorizada por este artefato.
