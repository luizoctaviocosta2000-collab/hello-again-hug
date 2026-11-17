# IMOBFY — execução homologação staging 18–22 (2026-11-16)

**Resultado: aplicado com sucesso exclusivamente em `imobfy-testes`. Produção não foi alterada.**

## Escopo e autorização

- O usuário autorizou especificamente a aplicação no projeto Supabase de testes `etcdlxkpidiqbgdayiol` (`imobfy-testes`).
- Projeto de produção `zenzuialkjalkabenbtv` (`Imobfy`) não foi modificado.
- Não houve merge, deploy de Edge Functions, publicação no Lovable ou comunicação externa.
- Versão do código utilizada: PR #59, commit `736f61da517eec48d6c67906a249d770f32fc45a` (a PR continua em draft).
- O Supabase respondeu `{"success":true}` ao `apply_migration`.

## Histórico e migração aplicada

- Nova versão Supabase: **`20261116142621`**.
- Nome: `imobfy_staging_18_22_inventory_finance_profile_secure`.
- Registros de histórico após a execução: **12** (9 passos básicos + 3 lotes compostos).
- Um único lote gerenciado pelo Supabase aplicou os fontes históricos 18, 19, 20, 21 e 22 com duas correções intercaladas. Não foram enviados `BEGIN/COMMIT` externos.
- A estrutura de migrações de staging está propositalmente consolidada: **não executar individualmente os arquivos antigos 10–22 neste banco nem usar `supabase db push` às cegas**.

| Ordem | Fonte e blob SHA do GitHub |
| --- | --- |
| Campos imobiliários (18) | `202610150002_properties_complete_capture_fields.sql` — `7ab35505b9f0e6ae5b626c89fb5e252fbfc7cca3` |
| Geração de códigos (19) | `202610150003_auto_generate_property_codes.sql` — `33e84d28049387a63c7acd9ecebd54fd2972213e` |
| Correção IMB-1000 | `20261116142000_property_code_unbounded_width.sql` — `112592a923c3233317489c87627045a82f4c9e1f` |
| Fechamento/comissão (20) | `202610160001_fix_sale_proposal_commission_flow.sql` — `058bc0869984b9453cbe1eb8332f4c966ed3937c` |
| Correção de captação indevida | `20261116134000_respect_explicit_sale_commission_sides.sql` — `d99b850f094cfc725cbfc3edf80dc540747ad6fd` |
| Contato WhatsApp (21) | `202610160002_profile_whatsapp_contact.sql` — `8619600efb086dd89b11c6fa9c139077b56de326` |
| Sincronização de nome e perfil (22) | `202610190001_sync_profile_name_fields.sql` — `e13e4e973160fb6a6463420758cd58e8ce88dd41` |

## Evidências de pré-aplicação

- Migrações: 11, última `20261116134906`.
- Projeto ACTIVE_HEALTHY, banco PostgreSQL 17.11.
- Sem usuários Auth, perfis, imóveis, negócios, propostas, captações, vendas e comissões.
- `generate_property_code` e `sync_profile_names` ainda não existiam; tabelas de fotos/compartilhamentos presentes; as 20 tabelas públicas estavam com RLS habilitado.
- Permissões autenticadas de SELECT/INSERT/UPDATE confirmadas nas tabelas principais.
- [CI da PR #59, execução 43884422921](https://github.com/luizoctaviocosta2000-collab/hello-again-hug/actions/runs/43884422921): aprovado em PostgreSQL 17 descartável (códigos de imóveis A/B, limite IMB-999/1000, propostas aceitas, fechamento, vendas, comissões, meiadas e VGV), Bun tests, TypeScript e build.

## Verificação imediata após a aplicação

- Supabase: **12 migrações**, última `20261116142621`.
- **20/20 tabelas públicas com RLS habilitado**.
- Funções: `generate_property_code`, `sync_property_address_complement_alias`, `sync_profile_names`, `handle_new_user`, `create_sale_from_closed_deal` e `generate_sale_commission` presentes.
- Gatilhos de imóveis, sincronização dos nomes, Auth signup e fechamento de negócios presentes.
- `properties_user_property_code_unique` presente.
- Correção da geração acima de 999 presente na definição PostgreSQL e expressão de teste `IMB-1000` confirmada.
- Fallback antigo de captação indevida ausente da função `generate_sale_commission`.
- `anon` e `authenticated` sem EXECUTE direto dos gatilhos privilegiados e de geração de código.
- SQL negativo com ROLE `anon` negou execução de RPCs financeiros; ROLE `authenticated` com claim JWT simulada A não conseguiu registrar operações como usuário B. As transações de teste foram revertidas.
- Tabelas `auth.users`, `profiles`, `properties`, `deals`, `sales`, `commissions`, `vgv_entries`, `property_photos`, `property_share_links` e `proposals` seguem com **0 registros**.
- Supabase **Security Advisors: 0 alertas**.
- Supabase **Performance Advisors**: 5 categorias existentes (18 chaves estrangeiras sem índice, 26 avisos de reavaliação auth RLS, 39 índices ainda não usados, 120 avisos de múltiplas políticas permissivas, 1 índice duplicado em `sales`: `sales_deal_id_key` e `sales_one_per_deal_idx`). As contagens refletem lints, não necessariamente número de objetos distintos. Priorizar revisão das sobreposições e índices; não remover automaticamente nem afirmar que o desempenho está certificado.

## Limites de homologação

Esta validação prova que a migração ocorreu, que o catálogo está íntegro e que as regras negativas selecionadas funcionam. **Não prova o E2E hospedado** de cadastro/Auth real, upload de Storage, interface, corretor/cliente ou processamento de pagamentos/comissões por usuários de teste com tokens reais. Os cenários positivos foram testados com identidades fictícias em PostgreSQL descartável, não no banco remoto.

Permanecem pendentes os fontes históricos posteriores (incluindo quotas de IA, recebimentos, visitas) e os testes integrais de duas contas Auth. A PR #57 contém o mesmo patch de comissões já trazido para a PR #59: reconciliar antes de eventuais merges para não aplicar o mesmo arquivo duas vezes.

## Próxima etapa segura

Planejar explicitamente as migrações restantes e os testes E2E em Auth/Storage com credenciais de teste (sem dados de clientes reais), obter aprovação específica para criação de contas/alterações remotas adicionais, e só depois analisar readiness de produção. Sem merge/deploy automático.
