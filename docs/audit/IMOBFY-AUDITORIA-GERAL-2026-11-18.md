# IMOBFY — AUDITORIA GERAL E ENTREGA DAS INTELIGÊNCIAS
**Data:** 18/11/2026 · **Repositório:** `luizoctaviocosta2000-collab/hello-again-hug`  
**Base anterior:** `main` em `cb5b7337` antes dos novos módulos; **entrega deste ciclo:** PR #65 `feat/imobfy-intelligence-foundation-20261118`.

> **Critério de honestidade:** código compilado ≠ produto publicado ≠ homologação real. Nenhum campo marcado como "pronto para produção" sem testar login real, CRUD, canais, autorização e publicação no Lovable.

## 1. O que foi implantado nesta etapa

### Atendimento Inteligente
- /atendimento com **caixa de conversas internas**, vínculo a cliente e imóvel, notas registradas pelo corretor, histórico, rascunhos internos gerados por IA, pausa e encaminhamento ao humano.
- Laboratório de simulação do PR #54 reutilizado, não refeito: Gemini com contrato JSON, histórico limitado, consulta ao imóvel do proprietário autenticado, quota e recusa de promessas comerciais (desconto, condição, proposta).
- **Privacidade:** antes de chamar Gemini, e-mails, celulares reconhecíveis e CPF são mascarados; dados de proprietário, notas internas, endereço completo e outros clientes não são consultados pelo simulador.
- **Não ativo:** mensagens automáticas via WhatsApp/Instagram, API de inbox externo, captura de leads de outros canais, confirmação de visitas pelo robô e atendimento sem revisão.
- **Staging:** `imobfy-attendance-simulate` v2 ACTIVE, verify_jwt=true; sem prova de requisição Gemini completa com conta de teste real.

### Ads Intelligence
- /ads com relatórios diários de **gasto, cliques e impressões informados manualmente**, identificados por conta/campanha/data e protegidos contra duplicação.
- Eventos de funil associados a clientes reais no CRM e campanha: lead, atendimento, qualificação, visita, proposta, venda; chave idempotente e vinculação de proprietário.
- Cálculos auditáveis: investimento, volume por etapa, CPL, custo por qualificado, custo por visita e custo por venda; denominadores zerados aparecem como **"Sem base"**, nunca como R$0.
- Atribuição ambígua a duas contas é ignorada; não considera todo lead do CRM como lead de anúncio.
- Diagnósticos determinísticos **somente para revisão humana**; nenhuma campanha é pausada, ampliada ou alterada por IA.
- **Não ativo:** Meta OAuth/API Insights, importação automática de gastos, CAPI de conversões offline/CRM, opt-in, regras Meta de atribuição, gerenciamento de anúncios e Instagram/WhatsApp reais.

### Segurança e banco de testes
- Migration: `supabase/migrations/20261118100000_intelligence_foundation.sql`.
- Quatro tabelas com RLS: `imobfy_attendance_threads`, `imobfy_attendance_messages`, `imobfy_ads_daily_metrics`, `imobfy_ads_funnel_events`.
- FK composta para impedir referência entre corretores; ações de usuário gravam apenas `source=manual`, não falsificam Meta. Histórico de mensagens/eventos sem UPDATE para usuários.
- Supabase `imobfy-testes`: 15 migrations registradas e 25 tabelas públicas com RLS; aplicação da migration de inteligência confirmada.
- Testes SQL com dois usuários fictícios, dados de campanhas e clientes; bloqueio de RLS/foreign key, origem falsa, repetição de chave; todos os dados revertidos. Nenhum usuário fictício permaneceu.
- Edge Function de compartilhamento de imóveis corrigida também foi implantada **somente em staging**.

## 2. Estado do IMOBFY como um todo

| Área | Evidência verificada | Estado para uso real |
| --- | --- | --- |
| Autenticação | Supabase Auth na interface; correção de cache não verificado na `main` (PR #61); login público HTTP 200 | **Parcial** — sem E2E de login/recuperação/sessão expirada com duas contas reais |
| Layout, menu e navegação | TanStack Start/React, rotas geradas, CSS e build; novos caminhos /atendimento e /ads no PR #65 | **Compilado** — inspeção visual desktop/mobile ainda exigida |
| Dashboard e KPIs | Consultas reais a deals, VGV, comissões, recibos, capturas e visitas | **Parcial** — período do funil usa `deals.created_at`, não fechamento; auditar distorção |
| Imóveis e captações | CRUD, proprietário, fotos, áudio e descrição via Supabase/Edge | **Parcial** — uploads, formatos, Storage e compartilhamento público precisam de E2E |
| Clientes | CRUD próprio, perfil de busca e relacionamento com negócios | **Parcial** — sem E2E real entre contas |
| Negócios, propostas, vendas | Telas e RPC transacional de visitas; regressões PostgreSQL | **Parcial** — fechamento completo na interface ainda não homologado |
| Agenda/visitas | `save_visit_journey` e `finish_visit_journey`, testes PG; status normalizado apenas em staging | **Parcial** — ambientes diferentes; testar cancelamento/reagendamento |
| VGV/comissões/recebimentos | Cálculos e regressões PG (inclusive cenários de meiada e propriedade) | **Parcial** — verificar parse monetário, dados históricos, rollback e fluxos reais |
| IA interna e assistente flutuante | Função `imobfy-ai` produção ativa; análise de consultas e cotas no código | **Parcial** — Gemini real, custos, erros e limites não homologados |
| Oportunidades/matching | Algoritmo local de correspondência cliente-imóvel com filtros e escore | **Implementado**, mas qualidade dos matches não homologada |
| Configurações | Atualiza perfil, contato, metas e regras | **Parcial** — conferir persistência e privacidade |
| Atendimento Inteligente | Novo laboratório, inbox interna e drafts, função ativa staging | **Staging implementado**, sem automação externa |
| Ads Intelligence | Novo painel e eventos/gastos manuais com RLS e regressões | **Staging implementado**, sem Meta real |
| Publicação | Domínio Lovable /login HTTP 200; release marker `/imobfy-release.json` HTTP 404 em 4 tentativas | **BLOQUEADOR**: código novo não comprovadamente publicado |

## 3. Falhas e riscos em ordem de urgência

### P0 — impedem lançar confiavelmente
**P0-01 — Lovable não publica a versão confirmada na main.** Teste `.github/workflows/live-site-smoke.yml`: GET /login = 200, GET /imobfy-release.json = 404. Histórico do Lovable indica builds malsucedidos/prévia defasada. O GitHub compila e o Worker serve /login no CI, logo não presumir que build local corrige publicação. **Codex:** reproduzir erro no Lovable, inspecionar detalhes do build, revisar template TanStack Start/Nitro/Cloudflare e resolver publicação; testar marker e navegação desktop/mobile. Publicação depende de conexão/autorização do Lovable.

**P0-02 — função pública de compartilhamento em produção está defasada.** A função implantada `imobfy-property-share` v5 usa service role para assinar Storage sem o filtro `user_id`/validação de `storage_path` presente no código revisado; caso haja metadados mal vinculados, há risco de assinar foto de terceiro. **Codex:** comparar hashes/fonte deployed, revisar registros existentes, aplicar constraint de proprietário + deploy da Edge Function segura com testes de URL assinada, em ordem atômica aprovada. A versão segura está em staging e tem testes de helper/PG; não significa vazamento comprovado.

**P0-03 — falta prova de sessão de ponta a ponta e release.** A UI valida Auth, mas testes de login real, isolamento HTTP PostgREST, Storage, criação de imóvel, visita, proposta, comissão e pagamento numa conta de teste ainda não foram executados. **Codex:** duas contas reais descartáveis de staging, E2E idempotente e limpeza.

### P1 — funcionalidades essenciais incompletas ou com possibilidade de inconsistência
**P1-01 — módulos novos só têm esquema em staging.** O projeto de produção ainda tem 21 tabelas, sem as quatro novas de inteligência. Interfaces exibem estado "banco ainda não instalado" até aplicação segura. Preparar diff/release migration separado, pré-condições, backup e rollback; não repetir as 26 etapas históricas de staging na produção.

**P1-02 — Atendimento real não integrado aos canais.** Não há webhook oficial verificado (challenge + HMAC), evento idempotente/ordenado, caixa de entrada de canal, janela de atendimento/templates, atribuição, consentimento/opt-out, controle de custo ou handoff com envio real. Até homologar, manter modo assistido **sem envio externo**.

**P1-03 — Ads Intelligence sem Meta API e CAPI.** Falta integração OAuth/escopos, armazenamento seguro de token, sincronização de Ads Insights, IDs de campanha/adset/ad e click identifiers válidos, deduplicação Meta CAPI, consentimento, retry/outbox, comparativo de atribuição e aprovação obrigatória para qualquer operação de campanha. Nunca usar token de Meta no browser.

**P1-04 — divergência de ambientes.** Produção tem 46 migrations históricas, staging 15 (composites), constraint de status de visitas difere e staging normaliza `done` para `completed`. Fazer `schema diff` de objetos e verificar semântica antes de qualquer promoção.

**P1-05 — parser monetário frágil.** `src/components/ImobfyFinanceCore.tsx` usa `Number(receiptAmount.replace(/\./g, "").replace(",", "."))`. Entrada `1234.56` vira `123456`; entrada brasileira `1.234,56` funciona. Definir máscara/locale único, validar centavos e testes com `1.234,56`, `1234.56`, `1234,56`, `0`, negativos, espaços e limites; revisar as telas de VGV/venda. Não alterar histórico sem reconciliação.

**P1-06 — KPI de fechamento usa mês de criação do negócio.** `src/components/ImobfyDashboardCore.tsx`: `periodDeals` filtra `created_at`, depois `closed=periodDeals.filter(status==='closed')`. Negócio aberto em outubro e fechado em novembro não conta corretamente como fechamento de novembro. Definir data de fechamento e coorte de conversão com o usuário, manter VGV baseado no banco, adicionar teste de coorte cruzando meses.

### P2 — segurança, escala, consistência e qualidade
- **Quota privilegiada:** Security Advisor marca `public.consume_ai_quota(text)` como `SECURITY DEFINER` acessível a autenticados. Exige auditoria de identidade, allowlist, atomicidade, abuso e `search_path`. O `ai_usage` sem policy RLS é deny-all intencional; não adicionar policy pública para "tirar aviso".
- **Auth:** produção alerta proteção contra senhas vazadas desativada. Habilitar quando disponível em Auth Settings e testar UX; não enfraquecer validações.
- **Performance:** produção: `unindexed_foreign_keys=1`, `auth_rls_initplan=5`, `unused_index=64`; staging: `unindexed_foreign_keys=21`, `auth_rls_initplan=26`, `unused_index=38`, `multiple_permissive_policies=120`, `duplicate_index=2`. São avisos a classificar, não prova de lentidão; medir planos e não remover índices/policies cegamente.
- **Testes e operações:** `main` sem branch protection exigindo CI; verificar regras, artefatos, relatório de falha, dados de demo, teste em celular a 390px, desempenho e acessibilidade.
- **API/infra:** paginar consultas `select` sem `range` quando crescer volume; limites do PostgREST podem cortar dados/indicadores. Monitorar Edge Functions, erros Gemini e cotas. Retenção/exclusão de conversas e dados de clientes conforme LGPD.
- **Design:** CSS distribuído em múltiplas camadas; sem revisão visual autenticada no Lovable, não afirmar acabamento uniforme.

## 4. Evidência da validação

- PR #65: `https://github.com/luizoctaviocosta2000-collab/hello-again-hug/pull/65`.
- CI da branch: Bun tests (incluindo rascunhos, PII e métricas), TypeScript, build, runtime Cloudflare e PostgreSQL 17; todas as dez verificações foram aprovadas antes do merge.
- SQL regressão em `imobfy-testes`: duas identidades simuladas, role `authenticated`, dedupe, source `manual`, RLS, FK tenant e rollback integral. **Não** substitui Auth HTTP com JWT real.
- Supabase staging: 25 tabelas com RLS, 15 registros no histórico; `imobfy-attendance-simulate` v2 ACTIVE e `imobfy-property-share` v1 ACTIVE.
- Supabase produção: 21 tabelas, 46 migrations, cinco funções Edge ativas, compartilhamento v5 antigo. Sem alteração de banco ou Edge de produção neste ciclo.
- Site publicado: GET /login HTTP 200; marcador de release HTTP 404; GitHub Actions reprova publicação da versão nova.
- Não foram testadas conversas WhatsApp/Instagram reais, CAPI, ações de Ads, chamadas Gemini com token real, login web autenticação real ou navegador móvel.

## 5. Ordem exata proposta para o Codex

1. **Travar P0 e registrar baseline.** Inspecionar `main` mais recente e estado do Lovable. Não fechar incidente com build local.
2. **Resolver Lovable e foto segura em produção após plano e autorização.** Respeitar o rollout de schema/FK e a versão da Edge Function, com smoke de link público/Storage.
3. **E2E Auth/CRUD/financeiro.** Simular dois corretores reais no staging; confirmar não há vazamento cruzado e que a operação comercial funciona.
4. **Concluir o backend externo do Atendimento.** Webhook WhatsApp e depois Instagram, HMAC, idempotência, inbox, consentimento, mão humana, janela/template e limites; lançar assistido antes de automático.
5. **Meta Insights + CAPI.** Fazer OAuth, sync real, event IDs idempotentes, relatórios por campanha/adset/ad, custos reconciliados e aprovação explícita de qualquer sugestão que altere ads.
6. **Corrigir parser e KPI de período** com testes de regressão e sem reclassificar finanças silenciosamente.
7. **Auditar performance, mobile, confiabilidade e LGPD.** Separar risco comprovado de aviso de linter; abrir PRs pequenos e apresentar evidência.
8. **Go/no-go**: verificar commit publicado, funções implantadas e migrações remotas com usuários de teste reais; só então declarar pronto.

**Proibido:** simular Meta real, prometer financiamento/descontos, disparar WhatsApp sem consentimento, dar à IA permissão de alterar financeiro, aprovar gastos sem pessoa, atualizar a produção sem rollback/backup e mergear com CI quebrado.
