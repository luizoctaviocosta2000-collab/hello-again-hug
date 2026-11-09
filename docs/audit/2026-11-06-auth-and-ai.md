# Autenticação e funções de IA — 6 a 9 de novembro de 2026

## Falhas reproduzidas

- Sem sessão, `/ia` e `/comissoes` ficavam carregando, `/vgv` ficava vazia e `/configuracoes` mostrava um formulário desabilitado.
- Ao abrir/recarregar uma página autenticada, o servidor renderizava a estrutura sem usuário e o navegador usava o perfil do armazenamento local, provocando erro de hidratação.
- No serviço remoto, descrição respondeu HTTP 502 após aproximadamente 127 segundos; fotos e áudio também responderam HTTP 502. Os logs administrativos confirmaram HTTP 503 por alta demanda do Gemini nas chamadas de áudio e descrição. A aplicação convertia esses erros em HTTP 502.
- No teste sintético em português, o modelo Lite confundiu dados de áudio; o modelo Flash reconheceu corretamente os sete campos verificados. A configuração final de áudio mantém o modelo validado durante todas as tentativas.
- A descrição podia omitir a cidade mesmo quando informada; o resultado agora preserva cidade e bairro a partir dos dados validados.
- O assistente flutuante não enviava o identificador da conversa anterior.
- A interface descartava a mensagem útil das funções em alguns fluxos. A falha de geração manual de descrição também podia produzir uma rejeição de Promise sem tratamento.

## Correções

- Verificação de sessão centralizada antes de renderizar páginas privadas, com o mesmo estado inicial no servidor e navegador. Login e compartilhamento público permanecem acessíveis sem sessão.
- Continuidade da conversa no assistente flutuante, mensagens de erro legíveis e prazo máximo de espera no cliente.
- Transporte Gemini compartilhado: limite de 25 segundos no provedor, até três tentativas com limite de 8 segundos cada e tratamento legível de indisponibilidade. Fotos/descrição permitem modelo alternativo após falhas; áudio mantém o modelo configurado (Flash por padrão) para preservar a qualidade validada em português. Erros de autorização e de entrada não são repetidos.
- Implementação versionada da função de descrição, que faltava no repositório, preservando o contrato `property` → `description` e o formato de anúncio recuperado da função em produção. Entrada limitada aos fatos do imóvel, autenticação obrigatória e cota de texto existente.
- Validação de índices únicos na classificação e aplicação dos resultados pelo identificador da foto. Fotos adicionadas durante a análise são preservadas; fotos removidas ou de outra galeria não são restauradas por uma resposta antiga.

## Validação local

- 39 testes Bun aprovados, incluindo falhas transitórias, modelos indisponíveis, limites de tempo, preservação das fotos e validação dos dados da descrição.
- TypeScript e build aprovados.
- Deno verificou as três funções de mídia/descrição.
- 12 verificações de acesso sem sessão passaram; as dez páginas privadas encaminharam para login.
- As quatro páginas anteriormente afetadas abriram e recarregaram com uma sessão real, sem erro de hidratação.
- Cinco verificações de interface com respostas de IA simuladas confirmaram continuidade do assistente flutuante, mensagens úteis e ausência de exceção após falha de descrição. Essas verificações não consomem cota e não substituem testes reais das funções implantadas.

## Implantação e verificação remota

As funções foram implantadas no projeto `zenzuialkjalkabenbtv`, com autenticação JWT mantida:

| Função | Versão final |
| --- | --- |
| `imobfy-parse-property-audio` | 8 |
| `imobfy-sort-property-photos` | 5 |
| `imobfy-generate-property-description` | 5 |

- As 18 verificações remotas iniciais passaram: respostas reais de descrição, áudio e fotos; entradas inválidas; bloqueio sem sessão; CORS; navegação e recarga sem erro de hidratação.
- No navegador, o assistente flutuante respondeu duas perguntas relacionadas, reutilizou a conversa e persistiu as quatro mensagens da conta de teste.
- A captura de voz pelo navegador, alimentada com fala sintética em português brasileiro, preencheu corretamente quartos, banheiro, vaga, área, preço, cidade e bairro com `gemini-3.5-flash`.
- A galeria classificou as duas imagens selecionadas e manteve ambas para revisão.
- A descrição final apareceu no formulário, preservou a cidade e pôde ser revisada antes de salvar. A primeira tentativa desta última verificação parou por timeout de login; a repetição recebeu HTTP 200 no login e na descrição, sem exceções no navegador.
- Os formulários foram cancelados: nenhum imóvel, foto armazenada ou compromisso foi criado nesses testes. As conversas de teste foram mantidas.

A mídia utilizada é sintética: esses testes verificam integração e os campos descritos, sem medir precisão em todas as gravações ou fotografias reais. A interface pede revisão antes de salvar.

A `main` está conectada ao Lovable. O GitHub não retornou URL de deployment/preview para esta integração; os testes de navegador usaram o frontend local com o Supabase real. O sucesso do push não comprova a conferência visual no editor do Lovable. Consulte o README para reproduzir a implantação sem incluir credenciais em arquivos ou commits.
