# Conexões oficiais — instalação e limites

## Estado da entrega

Código local, ainda sem deploy ou homologação real. A integração inicial Meta
é provisionada pelo administrador para **um titular/conta por ambiente**.
Não há OAuth self-service, renovação automática de tokens ou conexão multiempresa
na interface. Não confundir esse limite com SaaS multi-tenant pronto para venda.

WhatsApp implementa entrada assinada, persistência, CRM e recibos de status.
**Não há envio externo operacional nesta entrega.** Adaptadores existentes
continuam sem worker de saída. Faltam outbox, reserva concorrente de limites,
aprovação vinculada ao conteúdo/destinatário, templates e reconciliação antes
de ativar respostas ou campanhas. Modos off/assisted/bounded não concedem essas
capacidades sozinhos. Nenhuma transferência bancária.

## 1. Acesso e pré-validação

1. Autenticar GitHub localmente para push/PR; branch
   `feat/imobfy-operational-integrations-20261119`.
2. Disponibilizar acesso administrativo de leitura ao Supabase e comparar
   objetos/migrations reais dos projetos staging `etcdlxkpidiqbgdayiol` e
   produção `zenzuialkjalkabenbtv`. Esta sessão não conseguiu confirmar
   inventário remoto nem Advisors. Não assumir contagens de 18/11 atuais.
3. Criar pelo painel Auth duas contas fictícias confirmadas de staging. Variáveis
   seguras: `IMOBFY_STAGING_PUBLISHABLE_KEY`, `IMOBFY_STAGING_USER_A_EMAIL`,
   `IMOBFY_STAGING_USER_A_PASSWORD`, `IMOBFY_STAGING_USER_B_EMAIL`,
   `IMOBFY_STAGING_USER_B_PASSWORD`, `IMOBFY_E2E_CONFIRM_STAGING=1`.
4. Executar os runners existentes com Python:
   `python scripts/staging/auth_http_homologation.py` e
   `python scripts/staging/intelligence_http_homologation.py`.
   Nunca colocar service_role nesses runners.

## 2. Gemini

No painel Edge Secrets de staging, confirmar presença de `GEMINI_API_KEY` e
modelo com acesso vigente. Código usa `GEMINI_MODEL` e overrides
`GEMINI_CHAT_MODEL`, `GEMINI_SPECIALISTS_MODEL`, `GEMINI_ATTENDANCE_MODEL`.
Não foi comprovado que o default `gemini-3.5-flash-lite` está disponível na conta.
Não trocar modelo por suposição.

Smoke separado, com chave local segura e limite explícito:
`GEMINI_API_KEY`, `IMOBFY_SMOKE_GEMINI_MODEL`,
`IMOBFY_CONFIRM_PROVIDER_TEST=1`, depois:

```sh
bun scripts/staging/gemini_provider_smoke.ts
```

Somente dados fictícios, no máximo três tentativas de 128 tokens de saída.
Preço monetário depende do modelo/contrato e deve ser conferido antes de executar.
Esse smoke não testa RLS nem qualidade imobiliária; depois executar casos
autenticados: imóvel de outra conta, dados inexistentes, negociação, agendamento,
pedido humano, quota e falha de rede. Rascunhos continuam sujeitos à revisão:
heurísticas de texto não provam ausência geral de alucinações.

## 3. Meta Insights (sem alterações de campanhas)

No Meta Business, verificar titularidade e conceder token oficial com `ads_read`
restrito à conta autorizada. Em **Edge Secrets**, configurar:

```text
IMOBFY_META_OWNER_ID=<UUID Auth do titular de teste>
IMOBFY_META_READ_TOKEN=<token oficial somente leitura>
IMOBFY_META_AD_ACCOUNT_ID=act_<ID autorizado>
IMOBFY_META_GRAPH_VERSION=<versão vigente, formato vNN.0>
```

Publicar `imobfy-meta-insights` com verificação JWT habilitada, após autorização.
O endpoint valida `auth.getUser()`, compara titular em segredo de servidor e
confirma ID, BRL e timezone na Meta. Não aceita token/conta enviados pelo browser.
Na rota `/ads`, selecionar datas/nível e “Consultar e comparar períodos”.
Conferir valores contra Ads Manager com mesmo fuso, janela e data de conversão.
Não somar alcance entre linhas; leads Meta não são qualificados/vendas do CRM.
Falha/paginação incompleta retorna erro, nunca total parcial.

## 4. WhatsApp — entrada em número de teste

1. Verificar acesso oficial ao WABA e phone number de teste no Meta Business.
2. Validar a migration nova em PostgreSQL 17 descartável e staging. Dependência:
   `20261118100000_intelligence_foundation.sql` já presente e conferida.
   Aplicar **somente** `20261119100000_whatsapp_ingress.sql`, em transação,
   depois de snapshot/rollback revisados e autorização. Não reaplicar histórico.
3. Administrador cadastra mapeamento privado com IDs oficiais verificados:

```sql
insert into imobfy_private.whatsapp_connections
  (phone_number_id,waba_id,user_id,enabled)
values ('<PHONE_NUMBER_ID>','<WABA_ID>','<UUID_AUTH_TESTE>',true);
```

4. Em Edge Secrets: `IMOBFY_META_APP_SECRET` (App Secret oficial) e
   `IMOBFY_WHATSAPP_VERIFY_TOKEN` (aleatório, pelo menos 32 caracteres).
   O runtime fornece `SUPABASE_SERVICE_ROLE_KEY`; nunca enviá-la ao frontend.
5. Publicar `imobfy-whatsapp-webhook`. `supabase/config.toml` desabilita JWT
   **somente nesse webhook**; autenticidade POST é HMAC SHA-256 obrigatório sobre
   bytes originais. Cadastro GET exige verify token. Nenhum endpoint
   administrativo público é criado.
6. Configurar callback oficial:
   `https://etcdlxkpidiqbgdayiol.supabase.co/functions/v1/imobfy-whatsapp-webhook`,
   verify token correspondente e assinatura do campo `messages` do WABA.
7. Enviar mensagem fictícia a partir de número autorizado para o número de teste.
   Repetir o mesmo evento deve manter um contato/conversa/mensagem. Testar
   assinatura inválida, WABA diferente, status fora de ordem, STOP/SAIR e pedido
   humano. Confirmar evento persistido antes do HTTP 200.
8. Em `/atendimento`, entrada é rotulada “RECEBIDA PELO WHATSAPP”. Vincular imóvel
   da própria carteira para preparar rascunho. Pausa/handoff preservados;
   ingresso inicia automação pausada. Texto não é enviado.

Recebimentos `sent/delivered/read/failed` ficam append-only no registro de eventos;
não há tela completa de monitoramento outbound nem reconciliação de envios.
Contato ambíguo/número nacional semelhante vira `needs_review` sem novo cliente;
resolução dessa fila é administrativa e ainda precisa de interface.
Anexos recebem aviso para revisão humana, não download/transcrição automática.
Opt-out é persistente; nova mensagem não o remove nem concede consentimento de marketing.
Retenção/expurgo de payloads privados precisa de política operacional antes de produção.

## 5. Publicação

Após gates reais e autorização específica, CLI Supabase 3.x autenticada
(confirmar opções com `supabase functions deploy --help`):

```sh
supabase functions deploy imobfy-ai --remote=etcdlxkpidiqbgdayiol --use-api
supabase functions deploy imobfy-attendance-simulate --remote=etcdlxkpidiqbgdayiol --use-api
supabase functions deploy imobfy-specialist-agents --remote=etcdlxkpidiqbgdayiol --use-api
supabase functions deploy imobfy-meta-insights --remote=etcdlxkpidiqbgdayiol --use-api
supabase functions deploy imobfy-whatsapp-webhook --remote=etcdlxkpidiqbgdayiol --use-api
```

Conferir configuração JWT remota: endpoints de usuário exigem JWT; apenas webhook
Meta usa HMAC. Não promover automaticamente para produção. Antes disso: inventário
remoto, backup recuperável, dependências de inteligência/autonomia, RLS A/B,
Advisors e revisão do risco histórico de fotos.

GitHub: push da branch, draft PR, aguardar CI (inclui novo PostgreSQL 17).
Merge exige aprovação. Lovable: sincronizar commit aprovado, revisar preview,
Publish/Update após autorização e comparar `imobfy-release.json.commit_sha` com
o commit efetivamente compilado. Executar jornadas autenticadas desktop/mobile.

Rollback: desabilitar `whatsapp_connections.enabled`, remover assinatura do
webhook se necessário, reverter frontend/Edges para versão segura anterior.
Preservar eventos/auditoria; não apagar tabelas com dados nem reverter segurança.
