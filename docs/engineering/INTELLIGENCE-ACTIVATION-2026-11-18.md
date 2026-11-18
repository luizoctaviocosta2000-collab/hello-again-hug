# Ativação da inteligência — execução e bloqueios

Base: `0bf47a9e6ef730933ca13793ccaa9e716946c2d8` (main após PR #74). Usuário autorizou incorporar e publicar mudanças; isso não autoriza campanhas, mensagens ou dinheiro real indiscriminadamente.

## Estado conferido nesta execução

Produção `zenzuialkjalkabenbtv`: zero das sete tabelas de inteligência/autonomia; três PKs do núcleo presentes; um trigger de provisionamento em auth.users. Staging possui as sete tabelas e especialistas v4; nenhum conjunto de credenciais Auth A/B existe nas variáveis do workspace.

A tentativa de provisionamento temporário em staging foi rejeitada pela revisão automática: endpoint público sem JWT com poder administrativo ampliaria a superfície privilegiada. Não implantado, não contornado. A lista de funções confirmou ausência de `imobfy-stage-auth-fixtures`; credenciais locais preparadas e não usadas foram removidas. Não inserir usuários diretamente em auth.users nem expor service_role como alternativa.

## Trabalho concluído

- `scripts/release/test_intelligence_delta.py`: Docker PostgreSQL 17 descartável sem portas/rede, snapshot de schema sem dados pessoais, duas migrations existentes em ordem e regressões de tenant, fonte, idempotência, grants e emergência. PASS. Snapshot precisa de trigger de perfil fictício local; não confundir com teste do trigger remoto de produção.
- `scripts/staging/intelligence_http_homologation.py`: runner restrito ao hostname de staging, duas identidades diferentes, contas inicialmente vazias, oito respostas Edge sem dados (sem Gemini), CRUD manual e isolamento em ambos os sentidos, referência cruzada e append de auditoria proibidos. Cleanup por UUID, sem exclusões amplas. `--check` e compilação Python passaram; execução HTTP real BLOQUEADA por credenciais. Contas Auth permanecem para navegador após remover fixtures.
- Nenhuma migration ou Edge de produção foi alterada nesta etapa. Nenhuma chamada paga Gemini, mensagem ou campanha foi feita.

## Acesso necessário, sem segredos no chat

Em https://supabase.com/dashboard/project/etcdlxkpidiqbgdayiol/auth/users, um administrador deve criar duas contas fictícias dedicadas, confirmadas, sem enviar convites para clientes. Configurar por canal seguro as variáveis:

```
IMOBFY_STAGING_PUBLISHABLE_KEY
IMOBFY_STAGING_USER_A_EMAIL
IMOBFY_STAGING_USER_A_PASSWORD
IMOBFY_STAGING_USER_B_EMAIL
IMOBFY_STAGING_USER_B_PASSWORD
IMOBFY_E2E_CONFIRM_STAGING=1
```

A chave é pública/publicável, nunca service_role. O runner recusa contas com dados existentes. Executar:

```
python scripts/staging/auth_http_homologation.py
python scripts/staging/intelligence_http_homologation.py
```

Após passar, validar desktop/mobile autenticados com as mesmas contas e remover/revogar as contas ao concluir. Não declarar Gemini homologado por essas verificações: confirmar presença do secret sem ler seu valor, modelo disponível, limite de chamadas e teste fictício separado.

## Ordem exata de promoção após os gates

1. Conferir commit main e checks; repetir preflight de ausência das sete tabelas, PKs e dependências. Exportar schema/versões atuais e confirmar recuperação operacional. Interromper se estado mudou.
2. Validar o delta em clone/fixture e Auth A/B. Não reaplicar as 46 migrations de produção ou os 16 bundles de staging.
3. Aplicar somente `20261118100000_intelligence_foundation.sql` e depois `20261118180000_agent_autonomy_control_plane.sql`, transações gerenciadas, lock_timeout 5s e statement_timeout 30s. Revalidar tabelas/RLS/grants/constraints e advisors. Autonomia começa off e parada.
4. Publicar `imobfy-specialist-agents` com JWT true e todos os helpers de sua versão; publicar `imobfy-attendance-simulate` com JWT true apenas após configuração/provedor validados. Não publicar messaging-webhooks nem worker de ações externas.
5. Lovable: sincronizar main, inspecionar preview, Publish/Update, comprovar artefato/commit servido e smoke autenticado. Não há ferramenta de publicação/navegador conectado disponível nesta sessão. HTTP 200 ou marcador estático não comprovam versão.
6. Canais e Ads reais: OAuth e ativos oficiais do titular; começar leitura/sandbox, verificar assinatura, dedupe, consentimento e reconciliação antes de envio/gasto. Integração não nasce do merge.

## Rollback

Antes do commit de cada migration: qualquer falha aborta a transação; preservar dados existentes. Após commit com uso real: não fazer DROP automático das sete tabelas. Desabilitar acesso à funcionalidade/execução e preparar correção progressiva ou restauração revisada. Preservar auditoria. Função: versão anterior previamente exportada; UI: reverter release/PR correspondente. Não reverter proteção das fotos implantada anteriormente.

## Critério de pronto

Schema + grants confirmados; duas sessões reais com isolamento; fluxos próprios positivos; Edge/provedor validados separadamente; publicação exata comprovada; zero falsas mensagens/execuções. Atualmente a ativação integral permanece bloqueada por Auth A/B, configuração/provedor e acesso ao Lovable/Meta.
