# IMOBFY — guia de design

Identidade visual: grafite e champagne, com verde reservado a estados semânticos positivos.

## Tokens
- `--im-graphite`: ações primárias, navegação e texto forte.
- `--im-champagne`: destaques, progresso e estado selecionado.
- `--im-champagne-strong`: texto champagne sobre fundo claro.
- `--im-champagne-soft` e `--im-champagne-line`: fundos e bordas sutis.
- `--im-text-muted`: texto secundário legível.

CSS novo deve reutilizar tokens; evite cores soltas, gradientes e `!important`.

## Regras de interface
1. Um único H1 por página; títulos de conteúdo usam H2.
2. Uma ação primária por tela; ações secundárias devem ter hierarquia visual inferior.
3. Estados vazios explicam o próximo passo e, quando aplicável, oferecem uma ação.
4. Valores monetários devem permanecer legíveis e não quebrar em linhas inesperadas.
5. Respeitar `prefers-reduced-motion` e exibir foco visível em controles interativos.
6. Validar layout em 390 px sem rolagem horizontal e contraste WCAG AA.
7. O botão flutuante de IA não deve cobrir conteúdo nem aparecer na própria tela de IA.
