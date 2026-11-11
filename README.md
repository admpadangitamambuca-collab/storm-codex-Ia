# Storm Códex IA — código-fonte completo e versionado

## Versão 10.4.1 — Monitor Copy Trade revisado (11/11/2026)

- Integra as mudanças da 10.4 (Refresh analítico independente do fechamento) sem apagar o Clássico ou Turbo.
- Corrige o fechamento que ocorre durante a primeira consulta após iniciar o monitor: registra a operação somente se a vela fechar **depois** de o monitor ter sido iniciado e a confluência Turbo for estritamente >83, com OHLC fresco, direção e níveis válidos. Não cria backfill.
- Refresh do Copy e Refresh principal passam a refazer as leituras; sem novo fechamento, a pontuação é atualizada no diagnóstico, **não** cria entradas duplicadas.
- Exibe a situação de todos os 16 pares de ativo/período para distinguir score inferior a 83, falta de OHLC e fonte atrasada.
- Evita perder cliques de Refresh durante uma varredura; usa dois ativos por vez para limitar a espera.
- Testes de regressão automatizados em `tests/copy-trade-smoke.cjs`, com workflow `copy-trade-regression.yml`; fixtures locais passaram no GitHub Actions. **Ainda não há teste end-to-end confirmado com cotação Biquote em tempo real nem validação do site Netlify publicado.**
- Para carregar uma versão nova em site hospedado via Netlify Drop manual, é preciso publicar novamente o `index.html` e o `sw.js` desta versão.


## Versão principal 10.3.1 — Copy Trade corrigido (11/11/2026)

- O simulador fictício inicia o monitor automaticamente com a abertura do site; não exige primeiro entrar na aba Copy Trade.
- Lê XAUUSD, EURUSD, USDJPY e AUDUSD em M1/M5/M15/H1, com consultas de períodos em paralelo por ativo.
- Corrige o descarte indevido de sinais nos períodos M15/H1: a janela de observação agora respeita a duração do timeframe.
- Permite recuperar uma vela fechada inicialmente recebida com atraso, sem inventar operações retroativas.
- Único critério de pontuação do Copy: **score Turbo >83/100**; são obrigatórios OHLC real recente e contínuo, direção e níveis coerentes para simulação; o filtro seletivo do Turbo não é um segundo veto.
- O painel exibe diagnóstico por ativo/período para explicar ausência de operação.
- Histórico fictício local, banca inicial US$ 100,00, lotes XAU 0,10 / Forex 0,15, stop e TP1 mantidos.
- Testes: `node tests/copy-trade-smoke.cjs` (sintaxe dos módulos + cenários de operação, recuperação da fonte e deduplicação). Não houve prova com feed externo em tempo real nem operação na corretora.
- Netlify: use o ZIP completo `Storm_Codex_IA_v10_3_1_COPY_TRADE_NETLIFY.zip` quando publicado ou envie somente `index.html` e `sw.js` na raiz.

## Histórico das versões anteriores

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
- A simulação Copy Trade atual opera com score Turbo >83 e níveis/dados válidos, em vela fechada; o histórico antigo tinha outra regra.
- Quatro ativos monitorados com gráfico individual selecionável: XAUUSD, EURUSD, USDJPY e AUDUSD.
- Banca inicial fictícia de US$100, atualizada por takes e stops encerrados de operações prospectivas.
- Sem ordens reais ou integração com corretora. Nenhuma promessa de lucro, probabilidade estatística ou acurácia validada.
- Feed público e navegador aberto necessários para registrar operações. Observações locais não migram automaticamente entre dispositivos.
- Preservar as versões anteriores na árvore GitHub; criar novas versões sem sobrescrever backups.

## Validação efetuada (v9.6)

Compilação de sintaxe dos scripts; verificação de não modificação dos 20 scripts originais e testes isolados da regra de dupla confirmação, incluindo limites 78 e 65, e evolução da banca. Navegador real e feed Biquote ao vivo não foram validados na entrega.
