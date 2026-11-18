# MISSÃO PARA O CODEX — FECHAR O IMOBFY PARA LANÇAMENTO
**Data:** 18/11/2026 · **Prioridade:** P0 → P1 → P2 · **Repositório:** `luizoctaviocosta2000-collab/hello-again-hug`

## COPIE ESTE BLOCO PARA O CODEX

Você é o engenheiro responsável pela estabilização de produção do IMOBFY. Sua missão é **corrigir problemas REAIS, com testes e read-back**, sem destruir o trabalho recém-integrado de Atendimento Inteligente e Ads Intelligence.

**Leitura inicial obrigatória (no código atual, não de memória):**
- `AGENTS.md`, `docs/engineering/PROTOCOL.md`, `docs/audit/IMOBFY-AUDITORIA-GERAL-2026-11-18.md`, `docs/engineering/INTELLIGENCE-FOUNDATION-2026-11-18.md`
- `main` e PR #65 (não assumir merged sem verificar). Ler migrations, PostgREST policies, Edge Functions e histórico de CI.
- Projetos Supabase: produção `zenzuialkjalkabenbtv`; homologação `etcdlxkpidiqbgdayiol`. Não confundir schemas ou historico de migrations.
- Aplicação Lovable `https://imobfyy.lovable.app`.

**Regras inegociáveis:**
1. **Não refazer o sistema ou trocar stack.** Trabalhe com React/TanStack Start/Lovable, Bun e Supabase. Preserve UI graphite/champagne e rotas existentes.
2. **Não escrever em produção para conseguir fazer teste passar.** Para alteração em prod, primeiro apresente diff, impacto, checagem de dados, rollback e aprovação. Deixe alterações testadas em branches e staging.
3. **Não inventar Meta/WhatsApp conectados**, nem métricas de anúncio. Meta/WhatsApp devem usar APIs oficiais, OAuth/escopos autorizados, tokens guardados somente no backend, consentimento, opt-out e deduplicação. Sem auto-envio ou alteração de campanhas antes de liberação expressa.
4. IA **nunca** pode aprovar desconto, prometer financiamento, agendar visita sem confirmação, alterar VGV/comissão/vendas/recebimentos, ou disparar mensagens sem controle humano.
5. Commits pequenos, sem force-push ou rebase de histórico Lovable publicado, com TypeScript, Bun, build, PostgreSQL 17, Auth/HTTP e CI. Não confundir build compilado com Lovable publicado.
6. Se precisar de credencial, integração ou aprovação, marque como bloqueio operacional e continue o que independe disso; nunca cole segredos no GitHub ou logs.
7. Registre para cada achado: severidade, reprodução, causa raiz, risco de negócio, correção, arquivo alterado, teste que falhava e passou, validação staging/prod e eventual rollback.

**Executar nesta ordem:**

### P0: lançamento bloqueado
- Reproduzir e corrigir **Lovable stale**: `/login` HTTP 200, marcador `/imobfy-release.json` HTTP 404. Ver histórico com builds malsucedidos e implantar o commit correto. O CI de build + runtime Cloudflare sozinho não basta. Atestar exatamente qual release está visível no domínio e validar desktop 1440 e mobile 390.
- Resolver **Edge pública `imobfy-property-share` produção v5 antiga**: função usa service role para assinar fotos sem validação composta de proprietário/caminho. Há função corrigida em staging v1 e código novo na main. Antes de deploy, comparar schema, fotos/links existentes e ordem das constraints; executar testes de assinatura negativa para outro proprietário e positivos para dono legítimo. Public GET com token opaco precisa continuar funcional, sem expor dados extras.
- Homologar **login real e isolamento cross-tenant** com dois Auth usuários de staging (sem conta real), sessões JWT emitidas de verdade; validar todos os módulos via PostgREST/Storage/Edge no navegador. Limpar fixtures por ID. Bloquear lançamento se falhar.

### P1: operação comercial e inteligências
- Auditar `src/components/ImobfyFinanceCore.tsx` parser monetário: entrada `1234.56` é convertida em `123456` pelo replace de pontos. Criar parser único e testes BRL, corrigir sem alterar dados históricos.
- Auditar `src/components/ImobfyDashboardCore.tsx`: `periodDeals` considera `deals.created_at` para contar `closed`, não data de fechamento; definir indicador e teste de negócio iniciado num mês e fechado no seguinte.
- Corrigir drift de schemas e migrations entre produção (46 históricos) e staging (15 composites, 25 tabelas). **Jamais rodar 10–26 composites em produção.** Gerar delta específico para novas tabelas `imobfy_*` com FKs/RLS, no-op guard/preflight e reversibilidade, validando antes em clone isolado.
- Finalizar **Atendimento Inteligente real**: preservar simulador com JSON validado/PII redacted e inbox manual; webhook oficial WhatsApp Cloud API (verificação challenge + HMAC `X-Hub-Signature-256`), Instagram autorizado, telefone/tenant mapping, fila idempotente, dedupe por message_id, ordenação, janela de 24h/templates quando aplicável, consentimento/opt-out, atribuição, handoff, auditoria, custo. Adicionar testes de assinatura falsa, duplicatas, replay, envio falhado, bloqueio por canal, humano assumiu, prompt injection e vazamento de dados. **Manter modo assistido por padrão**; envio externo somente com aprovação e testes reais.
- Finalizar **Ads Intelligence**: preservar painel de gastos e funil manual sem dados inventados; conectar Meta Marketing API Insights com OAuth e importação real por campanha/adset/ad, sem client-side token; reconciliação por período/janela de atribuição; conectar CRM → CAPI (dataset + event_id + event_time + user_data permitidos e hash conforme Meta), outbox com retries/observabilidade/dedupe e consentimento; manter controle humano para pausar/escala/orçamento. Testar que não se atribui lead a campanha sem evidência e não se calcula custo sobre denominador zero.
- Confirmar o novo fluxo de testes em `tests/database/intelligence_staging_regression.sql` e `supabase/migrations/20261118100000_intelligence_foundation.sql`; validar grants reais que o Supabase aplica por default (revogar antes de conceder).

### P2: estabilidade e acabamento
- Revisar com cuidado os alertas `consume_ai_quota SECURITY DEFINER` (sem ampliar acesso), proteção de senhas vazadas desativada, 5 avisos de `auth_rls_initplan` produção, 1 FK sem índice, possíveis índices redundantes, perfis/quotas e logs Edge, sem executar DROP cego.
- Paginar consultas do dashboard/CRM para evitar limite implícito de 1.000 linhas, validar valores de receita/VGV contra SQL canônico, modal e estado de edição do cliente.
- Testar imóveis/captações/fotos, clientes, propostas, negócios, agenda, vendas, comissões, recibos, relatórios, IA, configurações e match de oportunidades; desktop/mobile; erros de rede e expiração de sessão; acessibilidade.
- Revisar CSS e lint escopado sem reformatar milhares de linhas legadas não relacionadas. Propor proteção do `main` com required checks/branch rules se permissoes permitirem.

## Evidência de aceite (preencher TODOS antes de declarar pronto)
- [ ] Lovable publicado serve o marcador esperado da `main` + login real + rota nova /atendimento e /ads; evidência de screenshot/HTTP da versão correta
- [ ] Dois usuários Auth de staging: CRUD e RLS de todos os módulos, cruzamentos proibidos sem vazamento
- [ ] Financeiro: comissões, recebimentos, imposto, captação, venda, meiada, VGV, estorno e moeda testados
- [ ] Compartilhamento/fotos privados sem URLs assinadas cruzadas; operação legítima preservada
- [ ] Gemini real: resposta estruturada, quota, timeout, dados ausentes e negociação exigindo humano
- [ ] Canais Meta/WhatsApp: autenticação, verificação de webhook, consentimento, limites e handoff; se sem credenciais, marcar explicitamente **NÃO CONECTADO**, sem maquiar
- [ ] Ads Insights/CAPI: dados reais, IDs, dedupe, retry, indicadores e zero ações automáticas
- [ ] Bun tests, TypeScript, build, SSR Cloudflare e PostgreSQL 17 completos, sem novos WARN de security advisor atribuíveis ao release
- [ ] Mudanças implantadas lidas de volta no Supabase/projeto publicado, plano de rollback revisado
- [ ] Relatório final: o que foi corrigido, o que não foi, PRs/SHAs, CI, release, pendências e decisão GO/NO-GO

**Não quero um plano genérico nem só relatório:** implemente e corrija o que estiver ao seu alcance; forneça PRs pequenos e evidências. Quando houver bloqueio de credenciais ou de autorização de produção, pause APENAS esse passo e continue o restante.
