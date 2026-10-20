# IMOBFY — identidade visual

Direção aprovada em 20/10/2026: grafite, champagne e superfícies claras.
Assinatura: **Clareza para o próximo passo.**

## Paleta
| Papel | Cor |
| --- | --- |
| Grafite: marca, navegação, ação primária | #1C1F26 |
| Grafite hover | #2D323C |
| Champagne: símbolo, detalhes sobre fundo escuro | #C7AB78 |
| Champagne escuro: texto e ícones sobre fundo claro | #80602D |
| Fundo | #F7F6F2 |
| Superfície | #FFFFFF |
| Texto secundário | #5B606B |

Não usar champagne claro para texto pequeno sobre branco. Verde, vermelho e amarelo continuam reservados aos estados semânticos. Não substituir sucesso por cor de marca.

## Marca
- Símbolo geométrico de três planos ascendentes, traduzido do conceito aprovado para SVG.
- `public/imobfy-logo.svg` e `imobfy-logo-compact.svg`: assinatura clara para fundo grafite.
- `public/imobfy-logo-dark.svg`: assinatura escura para fundo claro.
- `public/imobfy-icon.svg`: símbolo sobre grafite para favicon e aplicativo.
- Letras em paths: o logo não depende de fontes instaladas.
- Não distorcer, aplicar filtros ou acrescentar efeitos metálicos.
- A prancha conceitual não é uma especificação de rotas ou funcionalidades.

## Tipografia e componentes
Inter no produto, carregada com display=swap e fallback de sistema.
Tokens canônicos em `src/imobfy-design.css`; regras legadas de marca foram alinhadas em `src/imobfy-premium-system.css`.
Novos estilos devem reutilizar tokens, sem gradientes ou novos `!important`.
Um H1 por tela, H2 no conteúdo. Ações primárias em grafite.
Cabeçalho compacto, navegação preservada, foco visível e contraste.
Valores monetários usam algarismos tabulares; nunca truncar o valor silenciosamente.
Em telas pequenas os KPIs usam uma coluna para dar espaço a valores longos.
Não confundir estado vazio com erro de carregamento.
Assistente flutuante oculto na própria rota /ia.

## Validação antes de merge
- Testes, typecheck e build no commit final.
- Revisão no navegador em 390 px e desktop: login, dashboard, imóveis, clientes, negócios, agenda, comissões, VGV e IA.
- Teclado, zoom de 200%, movimento reduzido, valores longos, modais e estados de carregamento/erro.
- Confirmar legibilidade da marca e cores sem fonte externa carregada.
- Confirmar sincronização do Lovable após merge autorizado.

As mudanças de identidade não implementam o P1, não alteram fórmulas financeiras,
consultas, autenticação, migrations ou Edge Functions.
