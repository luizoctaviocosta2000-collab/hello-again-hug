# Segunda entrega: jornada comercial e indicadores

## Comportamento

- Agenda e Negócios usam RPC transacional para visita, roteiro e vínculos. RLS e validação de proprietário permanecem ativas. Cliente e negócio devem corresponder.
- Edição preserva metadados dos imóveis mantidos. RPC não edita visitas encerradas.
- Conclusão pede seleção explícita dos imóveis apresentados, em diálogo com foco controlado. Só os selecionados ficam elegíveis para proposta. Cancelamento não registra visitação. Repetir conclusão não duplica vínculos.
- Remove leitura/escrita de `deal_properties.visited_at`, inexistente no banco.
- “Fechado” abre registro de venda após proposta aceita. Banco rejeita estágio fechado com status ainda aberto. Funções existentes continuam gerando VGV/comissão; fórmulas não foram alteradas.
- Dashboard/Financeiro compartilham cálculo baseado em recibos. Caixa usa data do recebimento; saldo é total e explicitamente rotulado. Status recebido sem recibos suficientes gera aviso, não dinheiro presumido.
- Períodos excluem meses futuros. Gráfico histórico inclui meses com registros e ano no rótulo. Meta mensal compara o mês atual. Funil usa stage; próximos eventos mostram visitas da Agenda. Datas de visitas usam calendário local.
- Exclusão da comissão usa uma operação com cascade existente; não apaga recibos em requisição separada.
- Previsão avisa sobre pendências sem vencimento. Falha no carregamento bloqueia indicadores, evitando zeros incompletos.

## Verificação e limites

`tests/database/journey_schema.sql` contém somente estrutura pública obtida por leitura em 22/10: tabelas, constraints, índices, funções, triggers e RLS. Não contém registros reais. Auth/grants são simulados; não reproduz os serviços Auth, Storage ou PostgREST. Executar somente em banco local descartável.

Regressão com usuários sintéticos percorre visita → proposta → aceite → venda → VGV/comissão → recebimento. Inclui rejeições entre contas, proposta prematura, venda sem aceite, preservação de metadados, repetição, cancelamento e fórmula financeira existente. PostgreSQL 17 no CI complementa PGlite local. Testes TypeScript cobrem caixa, saldo, centavos, datas e períodos.

Não reconcilia histórico. Chamadas REST legadas continuam fora da transação das novas RPCs. Idempotência de criação após perda de resposta, paginação de grandes volumes, tarefas de IA na Agenda e meiação configurável continuam pendentes. Não houve teste visual autenticado.

## Publicação

Luiz autorizou implementar, testar e publicar esta entrega. Aplicar migration antes do frontend dependente das RPCs e verificar funções/privilégios/trigger/advisors. Migration transacional sem reescrita de registros. GitHub continua fonte da verdade; merge sem reescrever histórico. Conferir site público separadamente do merge, sem comandos à IA do Lovable.
