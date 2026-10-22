# Auditoria: primeira entrega de correções

## Escopo

- A01: recebimento e comissão devem pertencer ao mesmo usuário, garantido por FK composta e validação no trigger. Não exige alteração do frontend financeiro.
- A06 (parcial): serializar INSERT/UPDATE/DELETE de recebimentos pela comissão; rejeitar reatribuição de id, proprietário ou comissão para evitar saldos antigos desatualizados. Idempotência por requisição ainda não foi implementada.
- A02: agendamento em Negócios usa `planned` e conflito `(user_id,deal_id,property_id)`. Conflitos existentes são ignorados para preservar estados visited/proposal/sold.

## Compatibilidade e limites

As funções SQL foram comparadas aos metadados de produção em 22/10/2026. A migration substitui os dois nomes conhecidos de trigger de sincronização (histórico do GitHub e banco atual) por um único trigger. Mantém os estados financeiros atuais `receivable`, `partially_received`, `received` e o comportamento de `received_at`.

INSERT/UPDATE de recebimentos exige `auth.uid()` do proprietário, inclusive em integrações privilegiadas. Não há integração service-role de recebimentos identificada; importações administrativas futuras precisarão de fluxo explicitamente autorizado. Exclusões em cascata continuam permitidas. As funções são de trigger e não são expostas como RPC executável por anon/authenticated.

Não muda percentuais, impostos, fórmulas de comissão, dados históricos, autenticação ou paleta. O agendamento continua com operações separadas: atomicidade e conclusão visita → proposta pertencem à próxima entrega, não estão resolvidas aqui.

## Verificação

- Testes SQL com dois usuários sintéticos: leitura/escrita cruzada, vínculo inexistente, troca de vínculo/ID/dono, recebimento parcial/integral, excesso/zero/negativo/NaN, edição, exclusão, cascade e acesso anônimo.
- FK testada independentemente do trigger para defesa em profundidade.
- CI PostgreSQL 17: duas sessões reais; a segunda precisa bloquear e, após commit da primeira, rejeitar recebimento que excede o saldo.
- Fixture mínima reproduz o contrato das tabelas relevantes. Não equivale ao replay integral de migrations do Supabase nem a teste de API/PostgREST.
- Quality gate existente: testes Bun, TypeScript e build. Validação visual autenticada e E2E ainda pendentes.

## Aplicação controlada (exige aprovação)

1. Reconfirmar metadados e executar contagem somente leitura de vínculos entre donos diferentes. Havendo inconsistências, interromper e revisar individualmente.
2. Validar a migration em staging com esquema completo. Não executar o fixture de teste em staging compartilhado ou produção.
3. Aprovar separadamente merge e aplicação no Supabase. A PR não aplica a migration.
4. Aplicar em janela curta: as constraints validam registros existentes; `lock_timeout=5s` evita espera indefinida por locks. A transação falha integralmente se houver vínculos inválidos.
5. Confirmar dois triggers, FK composta, policies inalteradas e fluxo de um recebimento em ambiente de teste. Rodar advisors após aplicação aprovada.

Se a migration falhar, a transação reverte integralmente. Após sucesso, preferir correção progressiva; não remover a proteção de propriedade para contornar erros. Manter snapshot/backup de definições antes da aplicação. Não há backfill ou exclusão de dados nesta migration.

## Fontes técnicas

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://www.postgresql.org/docs/17/explicit-locking.html
