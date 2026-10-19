# IMOBFY

IMOBFY é um copiloto comercial para profissionais do mercado imobiliário. O projeto reúne gestão de imóveis, clientes, captações, visitas, propostas, negociações, vendas, comissões, VGV e recursos de IA.

## Stack

- React + TypeScript + Vite
- TanStack Router
- Supabase (PostgreSQL, Auth, Edge Functions)
- Gemini para recursos de IA
- Bun para instalação, testes e build

## Desenvolvimento local

Requisitos: Bun 1.3.5 ou versão compatível.

```sh
git clone https://github.com/luizoctaviocosta2000-collab/hello-again-hug.git
cd hello-again-hug
bun install
bun run dev
```

## Qualidade

```sh
bun run test
bun run typecheck
bun run build
```

Os testes de `src/lib/finance.ts` documentam a regra de cálculo esperada; eles **não** executam o trigger SQL. O cálculo efetivo das comissões é feito no banco por `generate_sale_commission`, e precisa de testes de integração próprios para ser validado ponta a ponta.

## Supabase

As migrations ficam em `supabase/migrations/`. As Edge Functions estão em `supabase/functions/`. Configure as variáveis secretas no ambiente do Supabase — nunca as coloque no código do frontend. As funções de IA usam `GEMINI_API_KEY`; os modelos podem ser configurados com `GEMINI_MODEL`, `GEMINI_AUDIO_MODEL` e `GEMINI_VISION_MODEL`.

Antes de implantar uma versão de Edge Function que depende de uma migration, aplique e verifique a migration correspondente no projeto Supabase. Mantenha `verify_jwt` habilitado nas funções que exigem usuário autenticado.

## Lovable

Projeto: https://lovable.dev/projects/164569e4-d960-4f0e-a3bb-4d5609dc50f3

O repositório é sincronizado com o Lovable. Alterações no código podem aparecer na prévia do projeto após a sincronização; confirme o comportamento visual e os fluxos no navegador antes de considerar uma mudança totalmente validada.
