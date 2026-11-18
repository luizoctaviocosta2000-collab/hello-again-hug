# Comprovação da versão publicada

O marcador estático anterior era igual entre commits e permitia falso verde. Agora o plugin de build `build/release-marker.ts` gera `.output/public/imobfy-release.json` com `commit_sha`, origem e estado de verificação. Nenhum marcador estático é usado como fallback.

Checkout Git limpo: SHA do HEAD. Alterações locais (inclusive arquivos não rastreados), SHA conflitante ou origem ausente: commit null, unverifiable. Em build por arquivo exportado sem Git, o pipeline pode fornecer `IMOBFY_BUILD_COMMIT_SHA` com 40 hexadecimais; é declaração do pipeline, não assinatura criptográfica. Nunca preencher com main ou inventar SHA. Não colocar tokens nessa variável.

O quality gate compara o artefato com GITHUB_SHA. O smoke público compara o SHA servido com o commit esperado. Enquanto Lovable não publicar o novo build, o smoke deve falhar: essa falha indica versão não comprovada, não necessariamente indisponibilidade do site. A verificação não substitui Auth/Storage/Edge/Gemini E2E.

Validação local: 116 testes, 365 assertions; TypeScript e build passaram. Build de árvore alterada emitiu unverifiable como esperado. Validar build após commit para identidade exata. Mudança não toca banco ou Auth; rollback por revert do PR, observando que restaurar marcador estático reintroduz a limitação de verificação.

Ativação dos agentes ainda depende de Auth A/B: em 18/11/2026, GET público de /auth/v1/settings em staging confirmou disable_signup=false e mailer_autoconfirm=false. Não criamos contas via signup para evitar envio de confirmação e contas inutilizáveis; confirmação por e-mail não foi desabilitada. A alternativa administrativa temporária foi rejeitada anteriormente e não foi contornada. É necessário usar administração Auth existente para provisionar contas confirmadas e suas credenciais seguras.
