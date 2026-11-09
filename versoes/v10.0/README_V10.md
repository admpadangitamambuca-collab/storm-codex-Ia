# Storm Códex IA v10.0 — Clássico + Turbo, versão autossuficiente
Data: 09/11/2026

## Para executar no Netlify
Use o arquivo ZIP v10 com index.html na raiz. Não depende de versões anteriores para renderizar e executar os motores com as fontes públicas já existentes. A disponibilidade de feeds públicos, login e acesso à internet continua sujeita a serviços externos. Para execução local, abra o index.html no navegador.

## Melhorias
- Clássico: estrutura de pivôs confirmados, região/taxa de retestes, falsa ruptura e direção causal; ajuste limitado na pontuação Price Action/Elliott, preservando os filtros já existentes.
- Turbo: revisão contextual de evidências de estrutura, médias, Fibonacci e zonas OHLC; desconto quando indicadores duplicam sinal; direção independente não é veto adicional ao Copy.
- Comparativo prospectivo: desempenho por setup, regime e período; R e win rate observados, 70/30 temporal para análise descritiva; custo estimado opcional em R, não a comissão real do broker.
- Auditoria: sem candles futuros no cálculo; trades observados sem criar histórico artificial; status ambíguo/expirado não é vitória.
- Copy Trade permanece SIMULADO, acionado com score Turbo estritamente >83 e dados válidos, sem pontuação mínima extra do Clássico.
- MT5 e ponte local permanecem fora desta versão.

## Integridade
- v9.9 e versões anteriores não apagadas.
- Históricos de v10 separados das regras anteriores para evitar misturar estatísticas de algoritmos diferentes.
- O score 0–100 é índice heurístico, não probabilidade calibrada.
- Fonte pública Biquote/Binance sujeita a indisponibilidade e atraso.
- Testes automatizados offline de sintaxe, causalidade, isolamento e regra de Copy >83 aprovados. Não houve backtest ao vivo ou prova de rentabilidade.
- A versão não contém execução real de ordens nem integração com corretora.

## Organização
- index.html — aplicativo autônomo, pode ser enviado sozinho ao Netlify Drop.
- engine/v10_dual_core.js — fonte do complemento de estrutura e pontuação.
- engine/v10_comparison_ui.js — fonte do painel de comparação.
- tests/ — testes de regressão e causalidade.
- README_V10.md / LEIA_ME.txt — instruções.
