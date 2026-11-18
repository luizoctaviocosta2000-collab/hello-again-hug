# IMOBFY AI — Atendimento inteligente (MVP, branch isolada)

## O que esta entrega efetivamente implementa

- Nova rota autenticada `/atendimento` e navegação integrada ao IMOBFY.
- Simulador para o corretor escrever como cliente e revisar rascunhos da IA.
- Lista imóveis cadastrados no CRM do usuário autenticado.
- Edge Function `imobfy-attendance-simulate` consulta **somente o imóvel selecionado**, filtrado por `user_id` e sujeito à RLS.
- IA Gemini retorna JSON validado com resposta, objeção, intenção, orçamento declarado, sugestão de próximo passo e sinalização de transferência.
- Regras determinísticas de negociação forçam transferência e substituem promessas potenciais por uma resposta segura.
- Histórico curto da conversa somente na memória da aba; botão reiniciar; pausa local; botão para copiar texto revisável.
- Testes unitários do contrato e de regras de transferência.

**Nenhuma mensagem é enviada a clientes e nenhuma informação é gravada no CRM.** Não há automação de WhatsApp/Instagram, caixa de entrada real, conexão OAuth, agendamento de visitas ou criação automática de leads.

## Pré-requisitos para teste

1. Instalar dependências e executar `bun run test`, `bun run typecheck`, `bun run build`.
2. Validar a UI com uma conta de teste autenticada e com pelo menos um imóvel. A disponibilidade nunca deve ser presumida.
3. Confirmar a existência da RPC `consume_ai_quota`, já utilizada pelas outras funções de IA.
4. Habilitar a Edge Function somente em **ambiente de teste**, com segredos `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY` e opcionalmente `GEMINI_ATTENDANCE_MODEL`. Manter verificação JWT habilitada.
5. Criar cenários: preço caro, financiamento não documentado, proposta de desconto, informação ausente, solicitação de atendimento humano, imóvel inativo, imóvel de outro usuário, histórico malicioso e API Gemini indisponível.
6. Só considerar o módulo validado após testes de integração reais (API + Auth + RLS + Gemini) e conferência visual.

**A função não foi implantada remotamente por esta entrega.** Até ser implantada e validada em staging, o simulador exibirá um erro de serviço indisponível, sem inventar respostas.

## Segurança

- A função recebe token de sessão, chama `auth.getUser()`, usa cliente Supabase com o token do usuário e aplica filtro `user_id` na consulta.
- Envia ao Gemini apenas campos comerciais delimitados. Não lê endereço exato, dados de proprietários, telefones, notas internas ou outros clientes.
- Mensagens de chat são tratadas como dados e limitadas. A IA não recebe acesso a ferramentas de escrita.
- O orçamento de uso da IA respeita `consume_ai_quota('chat')`.
- As respostas não são publicadas nem usadas como fonte de verdade; exigem revisão humana.
- Implicações da LGPD e aprovação das APIs da Meta devem ser revisadas antes de conectar canais reais.

## Etapas pendentes — necessárias antes de prometer atendimento automatizado

1. Criar canal oficial WhatsApp Cloud API: configuração de Meta App, Webhooks verificados, número elegível, verificação de assinatura, manejo de janelas e templates.
2. Persistir conversas e mensagens de atendimento em entidades separadas de `ai_conversations` (que pertence à IA interna), com RLS e isolamento por organização/usuário. Não reutilizar IA interna para atendimento externo.
3. Fila de eventos idempotente, ordenação por conversa e retentativas seguras.
4. Modos assistido/híbrido/automático com aprovação e cancelamento explícito do corretor.
5. Transferência real para humano, inbox, atribuição de responsáveis, notificações e estados de atendimento.
6. Qualificação persistida no CRM apenas com políticas explícitas, revisão humana e prevenção de duplicação.
7. Conexão Instagram Messaging API autorizada.
8. Atribuição de leads ao Ads Intelligence com evidência de origem, sem dados inventados.
9. Observabilidade, limites de custo, retenção/exclusão de dados e testes E2E com contas de teste.

## Nota sobre o uso do Codex depois

Revisar os contratos `attendance-contract.ts` e `imobfy-attendance-simulate/index.ts`; rodar testes; verificar que `src/routeTree.gen.ts` corresponde à árvore gerada pelo TanStack; inspecionar a UI no navegador e documentar falhas reais. Evitar habilitar envio externo, aplicar migrations ou fazer merge sem aprovação.
