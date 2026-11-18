# IMOBFY — AUDITORIA INTEGRAL E PASSAGEM AO CODEX
**Verificação:** 18 de novembro de 2026 (após PR #65 e PR #67)  
**Repositório:** `luizoctaviocosta2000-collab/hello-again-hug`  
**Base verificada:** `main` em `30ab261ff6495e26771c2a21ba812b1207fb297e`  
**Aplicativo:** `https://imobfyy.lovable.app`  
**Ambiente de testes:** Supabase `etcdlxkpidiqbgdayiol`; **produção:** `zenzuialkjalkabenbtv`.

> Este documento é uma fotografia do código, das migrações e das verificações vistas nesta data. "Código implementado" não significa "usuário final testado". Não há evidência de conexão ativa do app ao WhatsApp, Instagram ou às APIs da Meta. Não confundir a conexão Meta disponível no ChatGPT com autorização/token armazenado pelo IMOBFY.

## 1. Resumo executivo

**O que já foi entregue no código da main:**
- Atendimento Inteligente assistido: `/atendimento`, conversa interna com vínculo a cliente/imóvel, registro manual de mensagens, rascunho Gemini revisável, pausa e transferência para atendimento humano, simulador isolado; nada é enviado automaticamente.
- Ads Intelligence manual: `/ads`, cadastro de gasto/cliques/impressões por conta/campanha/dia, etapas do funil vinculadas a clientes, CPL/CPQL/CPV/CPS, diagnósticos determinísticos que não alteram anúncios; sem importação automática da Meta.
- Regra de privacidade para o simulador: minimização de dados de imóveis e máscara de e-mails/telefone/CPF no histórico antes da chamada ao Gemini.
- Banco da inteligência em **staging**: 4 tabelas novas, 25 tabelas públicas ao todo, todas com RLS; 15 migrações registradas; 0 usuários reais criados nesse ambiente; `imobfy-attendance-simulate` v2 implantada com JWT exigido. Ainda não há teste real Gemini autenticado.
- Correção financeira do PR #67: valores monetários de recibos validados em centavos. O comportamento anterior transformava `1234.56` em `123456` antes da escrita. Testes automatizados incluídos; não altera recebimentos históricos.

**O que ainda NÃO está entregue:**
- Webhook validado e envio oficial por WhatsApp/Instagram; chegada automática de leads; automação de respostas/qualificação em canais externos.
- OAuth Meta Marketing API, importação de Ads Insights, eventos Conversions API com confirmação/dedupe, otimização de campanhas ou aprovação/execução via Meta.
- Migração das 4 tabelas de inteligência à produção; função `imobfy-attendance-simulate` em produção; teste completo com contas Auth reais e com Gemini.
- Evidência de que a interface nova passou por uso real completo no domínio publicado.

**Verificações atuais:**
- GitHub CI compilação/TypeScript/Bun/regressões de finanças, segurança, inventário e runtime Worker aprovados na `main` consultada.
- Monitor público de `/login`: HTTP 200. Monitor de `/imobfy-release.json`: aprovado em consulta, porém usa **marcador estático** `2026-11-18-main-auth-verified`; futuras mudanças podem passar sem serem publicadas se esse valor não for incrementado. Não é atestado de deploy do último SHA.
- Produção: 21 tabelas públicas com RLS, 46 migrations, 2 contas Auth, 5 Edge Functions em operação; nenhuma das 4 tabelas `imobfy_*` de inteligência.
- Staging: 25 tabelas com RLS, 15 migrations, 2 Edge Functions (`imobfy-attendance-simulate` e `imobfy-property-share`), **não** equivale a produção.

## 2. Inventário de todas as áreas

| Módulo | Evidência no repositório | Estado para lançamento |
|---|---|---|
| Login, cadastro, recuperação e sessão | `ImobfyAuth.tsx`, `imobfy-session.ts`, PR #61 | **Parcial:** rota protegida corrigida; login real e recuperação por email não homologados |
| Site / Lovable | projeto conectado à main, `live-site-smoke.yml`, `ssr-runtime-smoke.yml` | **Parcial:** login e release estático disponíveis; não há prova de release por SHA e UX completa |
| Navegação, responsividade e identidade | `ImobfyAppShell.tsx`, rotas TanStack, estilos graphite/champagne | **Parcial:** falta teste visual autenticado 390px/desktop, estados vazios e erros |
| Dashboard / KPIs | `ImobfyDashboardCore.tsx`, `financial-summary.ts` | **Parcial:** indicador de fechamentos/coortes deve ser definido; alguns dados são paginados sem cobertura total |
| Imóveis | `ImobfyImoveisCore.tsx`, `ImobfyOperacao.tsx` | **Parcial:** CRUD no código; fotos/storage, áudio e links precisam de E2E |
| Captações e proprietários | tabelas `captures`, `owners`, fluxo do CRM | **Parcial:** verificar estados, permissões cruzadas e jornadas reais |
| Clientes | `ImobfyOperacao.tsx` e `clients` | **Parcial:** CRUD no código, sem duas contas Auth reais verificadas |
| Negócios / pipeline | `ImobfyNegociosCore.tsx`, SQL de negócios | **Parcial:** conferir transições, proprietário, datas, perda e fechamento |
| Agenda / visitas | `ImobfyAgenda.tsx`, RPCs `save_visit_journey`/`finish_visit_journey` | **Parcial:** regressões SQL; staging/prod divergem no status `done`/`completed` |
| Propostas / vendas | `proposals`, `sales`, SQL financeiro | **Parcial:** fechamento, duplicação, idempotência e desistência exigem E2E |
| VGV | `ImobfyVgvCore.tsx`, `vgv_entries` | **Parcial:** reconciliação com venda efetiva e período não homologada |
| Comissões e recebimentos | `ImobfyFinanceCore.tsx`, migrations, PR #67 | **Melhorado:** parser monetário corrigido, mas precisa teste financeiro real |
| Oportunidades / compatibilidade | `ImobfyOportunidadesPage.tsx` | **Implementado no código:** qualidade dos matches e paginação não aferidas |
| Configurações | `ImobfyConfiguracoesCore.tsx`, `profiles` | **Parcial:** persistência de perfil/metas e cenários de permissão sem E2E |
| IA flutuante e ferramentas de imóveis | `FloatingImobfyAI.tsx`, `imobfy-ai`, áudio/descrição | **Parcial:** funções em produção, mas resposta Gemini real, quota e custo não certificados |
| Atendimento Inteligente | `ImobfyAttendanceWorkspace.tsx`, simulador, função Edge | **Staging + código:** internal-only; nenhum envio automático nem canais reais |
| Ads Intelligence | `AdsIntelligenceDashboard.tsx`, `ads-intelligence.ts`, novas tabelas | **Staging + código:** métricas manuais; Meta Insights/CAPI ausentes |
| Arquivamento, LGPD, observabilidade | RLS, CI e documentação; faltam políticas operacionais | **Pendente:** retenção, exclusão, acessos e alertas de produção |

## 3. Riscos e falhas confirmados ou ainda não validados

### P0 — travas de produção
1. **Compartilhamento público de fotos com versão antiga:** a `imobfy-property-share` de produção v5 ainda assina objetos do Storage usando client com service role sem a validação de caminho/proprietário introduzida no código da main. A versão corrigida está em staging v1. Risco potencial quando houver metadados incorretos; **não há prova de vazamento**. Pré-checagem no prod mostrou 0 fotos e 1 link com proprietário válido. Codex deve preparar migração de FK/constraints e implantar nova versão **após autorização**, com testes negativos/positivos de URL assinada.
2. **Sem homologação real ponta a ponta:** SQL simulado e CI não substituem login JWT emitido pelo Supabase, REST API com duas contas isoladas, Storage, Edge Functions, visita, fechamento, comissões e recebimentos.
3. **Mudança de banco de inteligência ausente na produção:** interfaces novas podem exibir `banco não instalado`. Fazer delta específico de schema, não aplicar composites de staging 10–26 na produção. Validar backup/rollback e RLS antes do deploy.

### P1 — integridade e integrações
4. **Atendimento por canais externos incompleto:** falta mapeamento tenant/canal, webhook challenge/HMAC, controle de duplicatas/replay, conversa por mensagem real, opt-out, janela de atendimento, template autorizado, aprovação do corretor, custos e auditoria. Assistido por padrão; nunca lançar respostas automáticas sem consentimento.
5. **Ads Intelligence sem Meta real:** falta OAuth, contas corretamente associadas ao usuário/empresa, Insights por campanha/adset/ad, sincronização diária com retry, tracking confiável do lead (campanha/event IDs), Conversions API com consentimento e outbox idempotente; aprovação obrigatória de qualquer pausa/orçamento. Não supor que contas Meta conectadas ao ChatGPT estejam conectadas ao IMOBFY.
6. **Recebimento monetário corrigido no PR #67:** parser anterior era bug concreto (input `1234.56` multiplicava valor por cem). Novo parser em `src/lib/money-input.ts` com regressão. Testar formulário autenticado, limite e centavos no banco real; reconciliar lançamentos históricos suspeitos, mas nunca alterá-los sem autorização.
7. **Conversão e coorte do dashboard:** `ImobfyDashboardCore.tsx` usa `deals.created_at` para coorte e conta `closed` desse conjunto. Isso mede conversão da **coorte de criação**, não fechamentos ocorridos no período. Definir e rotular métrica separada baseada em `closed_at` antes de alterar cálculo (não misturar denominadores; vendas de outros meses podem causar taxa > 100%).
8. **Monitor de release pode dar falso verde:** `public/imobfy-release.json` não é incrementado automaticamente em cada alteração de código. O CI ter passado no SHA do PR #65 não comprova que esse SHA específico foi publicado no Lovable. Implantar marcador por release/SHA ou validação de provenance confiável.
9. **Drift entre bancos:** produção com 46 versões históricas e 21 tabelas; staging com 15 versões composites e 25 tabelas, plus normalização `done` → `completed`. Promover somente delta aprovado e testado contra schema real, sem `supabase db push` cego.

### P2 — endurecimento, dados e UX
10. **Linter de segurança:** prod aponta `public.consume_ai_quota(text)` SECURITY DEFINER executável por autenticados e proteção contra senhas vazadas desativada; `ai_usage` com RLS sem policy é bloqueio intencional. Auditar função e limites, corrigir configurações Auth pela interface de administração com aprovação, não criar policy pública.
11. **Volume e performance:** avaliações de indices/FKs/RLS com alertas em produção/staging; consultar EXPLAIN e volume antes de trocar índices; `limit(2000)` no Ads, `limit(100)` threads e `limit(300)` mensagens pode esconder histórico à medida que cresce. Paginar de maneira explícita.
12. **Qualidade da atribuição:** painel manual impede inventar campanhas, mas coorte de data do evento não é janela de atribuição Meta. Dedupe atual é por cliente/etapa/campanha; avaliar idêntico lead em contas distintas, múltiplos negócios, retorno e CRM/Meta offline. A relação cliente-negócio deve corresponder ao lead realmente atribuído.
13. **LGPD e custo:** definir base legal/consentimento, retenção/exclusão, limites de chamadas Gemini, PII em histórico/logs, reprocessamento, retries e dashboards de falhas.
14. **Visual e acessibilidade:** CSS fragmentado, estados longos, mobile, teclado, contraste, leitores de tela e permissão de ação ainda sem inspeção visual completa.

## 4. Como completar os dois motores — contrato técnico

### Atendimento Inteligente
**Fase A (entregue no código/staging):** interna, assistida, mensagem manual e rascunho revisado, simulador Gemini com redator PII; nunca enviar ao cliente sem ação humana.

**Fase B (Codex):** `channel_connections` com token/identidade isolada e segura no backend, inbox de entrada persistida idempotentemente, validação de assinatura antes de parse, mapeamento autorizado telefone/Instagram → tenant, tratamento de arquivos/status e identidade de mensagem externa. `inbound_events`/fila com IDs únicos, ordem e limite de tentativas; reconciliação de CRM com consentimento e política de exclusão. Meta WhatsApp Cloud API e Instagram Messaging exigem permissões reais; não criar conexão fictícia.

**Fase C (Codex):** orquestrador de rascunho sob limite de custos e revisão humana, regras anti-alucinação de financiamento/descontos/agendamentos, handoff imediato, estado do lead/agenda vinculado e auditável; envio externo opcional somente após opt-in e testes de políticas de canal.

### Ads Intelligence
**Fase A (entregue no código/staging):** despesas declaradas manualmente, etapas da jornada no CRM, métricas transparentes, sugestões não executáveis.

**Fase B (Codex):** Meta OAuth/escopos mínimos, backend com tokens criptografados, vinculação comprovada de `ad_account_id` ao tenant, importador `Ads Insights` por dia/campanha/adset/ad com paginação, currency/timezone e reprocessamento de dados, idempotência e UI de sincronização/erros.

**Fase C (Codex):** identificação comprovada da origem do lead, evento de CRM elegível e consentido, `Meta CAPI outbox` com `event_id`, `event_time`, dados permitidos e hashed conforme API, retry exponencial, dedupe e entrega observável. Nunca fabricar conversões ou assumir correspondência entre Meta e CRM sem evidência.

**Fase D (Codex):** alertas explicáveis e aprovação humana prévia (conta/campanha, motivo, orçamento, efeito máximo, janela e undo) antes de qualquer ação sobre anúncios. Inicialmente somente recomendações; alteração via Meta API requer autorização específica.

## 5. Critérios obrigatórios de aceite

- [ ] PR validado com Bun tests, TypeScript, build, SSR Worker e regressões PostgreSQL 17.
- [ ] Supabase Auth JWTs reais: duas contas descartáveis, RLS/PostgREST/Storage testados cruzando proprietários.
- [ ] Atendimento: Gemini real autenticado, mock inválido, prompt injection, PII, limite, fallback e human handoff.
- [ ] Meta: conta verificada, spend/insights reconciliados, CAPI com dedupe, eventos elegíveis, consentimento e retry — **sem alterar campanhas**.
- [ ] Teste 390px e desktop autenticados; CRUD de clientes/imóveis, proposta/venda/visita/comissão/recebimento, sem misturar dados.
- [ ] Delta de produção revisado e aprovado, migração aplicada, grants e Security Advisor pós-deploy, funções redeployadas e verificadas.
- [ ] Lovable publicou o novo commit comprovadamente; monitor não pode dar verde com marcador antigo.
- [ ] Nenhum P0 restante e P1 explicitamente aceitos ou adiados com corte de escopo.

## 6. Referências e evidência reproduzível

- PR #65 (inteligência, integrado à main): https://github.com/luizoctaviocosta2000-collab/hello-again-hug/pull/65
- PR #67 (parser financeiro, integrado à main): https://github.com/luizoctaviocosta2000-collab/hello-again-hug/pull/67
- Auditoria anterior: `docs/audit/IMOBFY-AUDITORIA-GERAL-2026-11-18.md`
- Handoff anterior: `docs/engineering/CODEX-REMEDIATION-2026-11-18.md`
- Planos e schema: `docs/engineering/INTELLIGENCE-FOUNDATION-2026-11-18.md`, `supabase/migrations/20261118100000_intelligence_foundation.sql`
- Testes: `tests/ads-intelligence.test.ts`, `tests/database/intelligence_staging_regression.sql`, `tests/money-input.test.ts`.
- Monitor de release: `.github/workflows/live-site-smoke.yml`; passou, mas apenas compara marker estático.
- Produção Supabase e staging consultados via inventário, migrations, Edge e Security Advisor neste ciclo.

**Aviso:** não houve aprovação para modificar Meta Ads, disparar mensagens ou executar migrations/Edge Functions em produção. Não declare o projeto integralmente lançado até os testes e deploys de todas essas dependências.
