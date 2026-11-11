# Storm Códex IA — código-fonte completo e versionado

> **Revisão de integridade (11/11/2026):** veja [AUDITORIA_2026-11-11.md](AUDITORIA_2026-11-11.md). As correções estão em uma branch de revisão; o histórico original permanece preservado.

**Versão principal atualizada em 07/11/2026: base v9.9 + revisão Turbo contextual / Copy Trade >83.**

- `index.html`: app autossuficiente na raiz, atualizado com o código da ramificação `feature/turbo-contextual-20261107`.
- [**Baixar ZIP Netlify — Turbo contextual + Copy >83**](https://github.com/admpadangitamambuca-collab/storm-codex-Ia/raw/refs/heads/release/turbo-contextual-copy83-20261107/Storm_Codex_IA_TURBO_CONTEXTUAL_COPY83_NETLIFY.zip) — contém `index.html` na raiz e `LEIA_ME.txt`.
- [Cópia HTML editável no histórico](versoes/turbo-contextual-copy83-20261107/Storm_Codex_IA_TURBO_CONTEXTUAL_COPY83_EDITAVEL.html).
- [Ramificação de distribuição do ZIP](https://github.com/admpadangitamambuca-collab/storm-codex-Ia/tree/release/turbo-contextual-copy83-20261107).
- A revisão aprimora a leitura contextual do Turbo (tendência, consolidação, rompimento e volatilidade), aumenta/preenche o raio e muda o Copy Trade para **score Turbo estritamente >83/100, sem segundo score do Clássico ou veto seletivo**. Mantém pré-requisitos técnicos de candles válidos, níveis coerentes e fonte recente; o Copy continua apenas simulado.
- O Clássico Precision, as animações, os históricos e os arquivos legados foram preservados. O app usa serviço público gratuito e **não envia ordens reais**.
- Foram verificados os 23 scripts do HTML quanto à sintaxe e a existência do pacote no GitHub. Não houve validação com mercado/feed real nesta revisão.

## Histórico anterior

- `index.html`: aplicativo autossuficiente, pronto para Netlify.
- `versoes/v9.7/Storm_Codex_IA_v9_7_NETLIFY.zip`: pacote autossuficiente do Netlify Drop.
- `versoes/v9.7/Storm_Codex_IA_v9_7_EDITAVEL.html`: cópia editável igual à raiz.
- `versoes/v9.7/LEIA_ME_v9_7.md`: alterações e ressalvas.
- `versoes/v9.6/Storm_Codex_IA_v9_6_NETLIFY.zip`: pacote completo com `index.html` e instruções, para Netlify Drop.
- `versoes/v9.6/Storm_Codex_IA_v9_6_EDITAVEL.html`: cópia editável, idêntica à raiz.
- `versoes/v9.6/LEIA_ME_v9_6.md`: documentação e limitações.
- `versoes/v9.5/`: cópia da v9.5 original com quatro gráficos e score acima de 80.
- `versoes/v9.4/`: cópia da v9.4 Turbo Equilibrado.

## Regras para manter a integridade do projeto

- Preservar o Clássico Precision e o Turbo Equilibrado e seus bloqueios de segurança.
- **Regra vigente (auditoria 11/11/2026):** o Copy Trade abre operação fictícia somente com **score Turbo >83/100**, vela fechada, dados frescos e níveis coerentes. A regra dupla 78/65 é apenas histórica.
- Quatro ativos monitorados com gráfico individual selecionável: XAUUSD, EURUSD, USDJPY e AUDUSD.
- Banca inicial fictícia de US$100, atualizada por takes e stops encerrados de operações prospectivas.
- Sem ordens reais ou integração com corretora. Nenhuma promessa de lucro, probabilidade estatística ou acurácia validada.
- Feed público e navegador aberto necessários para registrar operações. Observações locais não migram automaticamente entre dispositivos.
- Preservar as versões anteriores na árvore GitHub; criar novas versões sem sobrescrever backups.

## Validação efetuada (v9.6)

Compilação de sintaxe dos scripts; verificação de não modificação dos 20 scripts originais e testes isolados da regra de dupla confirmação, incluindo limites 78 e 65, e evolução da banca. Navegador real e feed Biquote ao vivo não foram validados na entrega.
