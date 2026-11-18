# IMOBFY — Equipe de agentes especialistas (fase 1)
18 de novembro de 2026

## Objetivo e limite desta entrega
Uma central real no IMOBFY com quatro especialistas consultivos: Ads, Atendimento, Comercial e Financeiro. O centro reutiliza a rota autenticada \`/ia\`, mantendo o chat geral. Cada especialista consulta por sua própria sessão autenticada os dados do CRM e calcula métricas determinísticas e recomendações; o botão **Complementar com IA** chama \`imobfy-specialist-agents\` para obter um comentário estratégico opcional via Gemini. A interface mostra claramente quando o resultado vem de regras ou da IA.

**Não há agentes autônomos que operam campanhas ou respondem clientes nesta etapa.** É proibido declarar "WhatsApp conectado" ou "Meta Ads conectado" com base nesta implantação. Essas integrações ainda requerem APIs oficiais, contas autorizadas, tokens mantidos no backend, consentimento, envio idempotente, aprovação humana e homologação ponta a ponta.

## Contrato técnico e privacidade
- A Edge Function exige JWT e valida \`auth.getUser()\` com a própria sessão do usuário, sem usar \`service_role\`. Cada query tem RLS e \`eq("user_id",user.id)\`.
- Dados da IA: **somente contagens, totais da base consultada, tendências e rótulos genéricos**. Não envia nome, contato, endereço, CPF, conversas reais nem anotações.
- Agentes usam consultas mínimas:
  - **Ads**: \`imobfy_ads_daily_metrics\` e \`imobfy_ads_funnel_events\`, somente contas/campanhas comprovadamente vinculadas nos registros. Atribuição manual ≠ atribuição oficial Meta.
  - **Atendimento**: status de \`imobfy_attendance_threads\` e função das mensagens de \`imobfy_attendance_messages\`; nunca envia o conteúdo da conversa.
  - **Comercial**: etapas, status e datas de negócios; status/horários de visitas. Não tem ferramentas de escrita.
  - **Financeiro**: comissões, valores e recebimentos já registrados; apresenta saldos da base consultada, não dados bancários.
- Cada dataset tem limite de 500 registros; limite atingido é marcado **amostra**, não total oficial. Zero ou ausência de dados não gera gasto/resultado imaginário.
- Só recomendações determinísticas contêm números. Gemini, quando configurado com \`GEMINI_API_KEY\`, pode gerar uma frase qualitativa curta, sem números, IDs ou links; saída JSON é validada ou descartada.
- A quota existente \`consume_ai_quota(p_feature='chat')\` é consumida somente ao fazer chamada Gemini. Sem credencial/cota, o usuário vê modo regras, com identificação explícita.
- As ações do agente ficam fora do servidor; botões só geram análise/cópia ou abrem o módulo relevante. Nenhum \`INSERT\`, \`UPDATE\`, \`DELETE\`, WhatsApp outbound, Conversions API ou Meta Campaign write.

## Ponto de integração e evidências
- Frontend: \`src/components/ImobfyAgentCenter.tsx\`, \`src/lib/local-agent-report.ts\`, \`src/imobfy-agents.css\`, \`src/routes/ia.tsx\`, \`ImobfyAppShell.tsx\`.
- Backend: \`supabase/functions/imobfy-specialist-agents/index.ts\`; helper puro \`supabase/functions/_shared/specialist-agents.ts\`.
- Testes: \`tests/specialist-agents.test.ts\`, além de toda regressão do repositório (Bun, TypeScript, Vite/Nitro, SQL).
- Novo endpoint **não** deve ser exposto em produção até homologar JWT real e autorização cruzada em staging, carga Gemini e estado do Lovable. O modo local consultivo **funciona sem essa Edge Function**, respeitando RLS; o botão Gemini informa honestamente quando a função não está instalada.
- Staging: \`imobfy-specialist-agents\` v1 ativa com verificação JWT; como staging não possui contas Auth de teste, ainda falta validação HTTP autenticada e resposta Gemini real.

## Próximas fases necessárias
1. Testar com duas contas Auth emitidas no Supabase de testes e dados sintéticos. Verificar que nenhum usuário consegue consultar os registros de outro via RPC/Edge; testar invalid JWT, token expirado, fallback quota, custo e erros Gemini.
2. Implementar a conexão oficial WhatsApp/Instagram (verificação HMAC e challenge, associação explícita de canal/tenant, janela de 24 h e templates quando exigidos, consentimento/opt-out, handoff humano, eventos idempotentes e filas de reenvio).
3. Implementar Meta Marketing API OAuth/Insights e CAPI, token criptografado no servidor, reconciliação de métricas/atribuição, evento real qualificado e teste de correspondência. Acesso Meta via ChatGPT não dá token ao app IMOBFY.
4. Coordenador com relatórios assinados por versão, janela/campanha/lead comprovado; sem alucinar cruzamento entre anúncios e vendas. Somente após isso discutir agentes que executam ações com fila de aprovações e limites de gastos.
5. Realizar teste autenticado desktop/mobile, checar a release Lovable por commit, rever Advisor Security e publicar somente após aprovação separada.

## Critério de aceite desta fase
- Os quatro agentes constam na UI e em contrato, cada um consulta sua própria fonte por JWT RLS; números auditáveis; nenhuma escrita.
- Bun tests + typecheck + build + Cloudflare runtime + migrations regressions passam.
- Teste Deno de compilação e implantação da Edge em staging não equivale a E2E Auth/Gemini; registrar limitações.
- Sem credenciais Meta/WhatsApp, somente recomendação/manual, não promessa de aquisição garantida.
