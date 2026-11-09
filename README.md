# Storm Códex IA v10.0 — Dual Engine Evolution

Base preservada: **v9.9 Turbo contextual e Copy Trade score estritamente superior a 83/100**.

## Entrega
- `index.html`: app Netlify autossuficiente com 25 scripts; Clássico e Turbo integrados.
- `engine/v10_dual_core.js`: funções causais/puras, pesquisa de pivôs confirmados e zonas, false breaks, pesos adaptativos e desconto de evidências correlacionadas.
- `engine/v10_comparison_ui.js`: painel comparativo com amostras prospectivas por ativo/timeframe, regime de mercado, custo opcional estimado em R, treino/teste temporal 70/30 e CSV.
- `tests/v10_dual.test.cjs`: testes de não lookahead, não mutação, treino separado, sintaxe e regra Copy >83.
- [ZIP Netlify completo v10.0](https://github.com/admpadangitamambuca-collab/storm-codex-Ia/raw/refs/heads/feature/v10-dual-engine-evolution-20261109/versoes/v10.0/Storm_Codex_IA_v10_DUAL_ENGINE_NETLIFY.zip): inclui `index.html` na raiz, fontes e instruções.
- [HTML v10.0 editável](versoes/v10.0/Storm_Codex_IA_v10_DUAL_ENGINE_EDITAVEL.html).
- [Descrição detalhada das mudanças](versoes/v10.0/README_V10.md).

## Clássico v10.0
Auditoria adicional de pivôs de 2 velas, zonas com idade/contagem, rejeição/reteste e falsos rompimentos. Penalidade por estruturas contraditórias e Elliott em conflito. Confirmações sensíveis ao timeframe. Mantidos filtro estrito XAUUSD >US$3 em 1 vela, R:R mínimo, fonte atual, candles fechados e EVITAR/operacional.

## Turbo v10.0
Desconta pontuação de EMA/estrutura e FVG/Fibonacci quando correlacionadas, altera relevância por regime, verifica direção por pivôs próprios, e reforça leitura de armadilhas com candles fechados. O gate original Turbo permanece. O **Copy Trade usa somente score Turbo >83/100** como critério de seleção, além de pré-requisitos técnicos de OHLC/níveis; não recebeu um veto do Clássico.

## Desempenho, limites e integridade
O comparativo só lê resultados observados após sinais, no armazenamento local do navegador, com motor de resultado OHLC anterior. Status pendente, ambíguo, expirado e histórico importado NÃO contam como acertos. Condições melhores são escolhidas apenas com os primeiros 70%; os 30% finais são avaliação cronológica descritiva. Métricas exigem ao menos 30 encerramentos válidos. Scores não são probabilidades calibradas e métricas de paper trading não representam lucro real. A versão inicia com histórico v10 vazio por conta de chaves próprias; dados v9.9 não foram excluídos.

Sem nova API, serviço pago, backend obrigatório, alteração de fontes, envio de ordens reais ou componentes da integração local MT5.

## Validação
`node tests/v10_dual.test.cjs` e GitHub Actions (quando disponibilizado). A sintaxe dos scripts pode ser validada offline; a experiência visual e o feed ao vivo requerem teste no navegador. Não alegar taxa de acerto melhorada sem amostras prospectivas.
