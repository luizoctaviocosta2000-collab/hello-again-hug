# F0 / R2 — testes em PostgreSQL descartável

Este diretório contém o harness que valida as migrações:

- `supabase/migrations/202609090002_f0_baseline_reconciliation.sql` (F0-A)
- `supabase/migrations/20261120090000_f0_ai_read_functions.sql` (F0-B)
- `supabase/migrations/20261120091000_r2_status_indicators.sql` (R2)

Nada aqui toca Supabase remoto. O script cria um cluster PostgreSQL local,
aplica a cadeia inteira e o destrói ao final.

## Pré-requisitos

- PostgreSQL 17 (binários com `initdb`, `pg_ctl`, `psql`, `pg_isready`,
  `createdb`). Não precisa de Docker.
- Windows PowerShell 5.1 ou superior.

## Como rodar

```powershell
powershell -ExecutionPolicy Bypass -File tests/database/f0/run.ps1 `
  -PgBin "C:\caminho\para\pgsql\bin"
```

Parâmetros opcionais: `-Port 55439`, `-WorkDir "C:\temp\imobfy-f0"`.

O script copia `supabase/migrations` e este diretório para um caminho ASCII
antes de chamar o `psql` (caminhos com acento não abrem em `psql -f` no
Windows) e usa dois bancos:

| Banco | Conteúdo |
|---|---|
| `imobfy_preserve` | baseline canônico + fixtures + F0-A + reexecução + rollback |
| `imobfy_replay` | cadeia completa (exceto `20260908`) + F0-B + captura F0 + R2 |

## Resultado esperado

```
PASS lines: 33
ALL SUITES PASSED
```

Inclui 1 `BUG-REPRO` **intencional**: com F0 sozinho o indicador continua
errado (`total_received = 2050`); ele só passa a 2750 depois do R2.

Números de referência (2 usuários, 14 comissões, 2 recibos):

| Fase | total_received | total_open | total_forecast | total_cancelled | NULL |
|---|---:|---:|---:|---:|---:|
| F0 | 2050 | 6000 | — | — | — |
| R2 | 2750 | 6000 | 1500 | 11100 | 1 |

Isolamento: usuário B vê 1 comissão e `total_open = 5000`, sem totais do A.

## Cobertura

- preservação exata de valores, incluindo zero, fração/arredondamento e NULL;
- checksum NULL-safe (`IS DISTINCT FROM` + censo de NULL + contagem de linhas);
- idempotência (F0-A rodado duas vezes);
- rollback rename-only restaurando colunas geradas e histórico;
- alargamento dos CHECKs de status (aceita união, rejeita fora);
- `search_path = ''`, `SECURITY INVOKER`, EXECUTE negado para `anon`;
- `sync_closed_deal_financials` ausente e sem trigger (deferida);
- status desconhecido reportado em `unknown_open_amount`, nunca contado como ativo.

## Limites

- Não prova estado de staging/produção, nem RLS com usuários reais.
- Não substitui `supabase db reset`, security advisors ou teste integrado.
- As pendências `deal_properties.visit_status` e `appointments.status`
  **continuam abertas**; não são resolvidas por F0/R2 e exigem migração e
  testes próprios.
