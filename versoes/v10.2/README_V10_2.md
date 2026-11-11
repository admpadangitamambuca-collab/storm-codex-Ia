# Storm Códex IA v10.2 — Turbo Signal Audit

Base: v10.1, preservando os dois motores, Clássico Precision, Elliott, Copy Trade fictício e os módulos de chuva/raios.

## O que muda no Turbo
- Auditoria causal, por velas OHLC fechadas, de distância à EMA21, impulso recente, pavios de rejeição e barreiras de pivôs recorrentes antes do TP1.
- A auditoria reduz componentes existentes do score sem duplicar bônus de indicadores correlacionados.
- Bloqueio de sinal quando há barreira recorrente relevante muito próxima antes do TP1, ou entrada excessivamente esticada após impulso.
- Diagnóstico visível no painel do Turbo, mantendo a identidade visual da tempestade e sem copiar o design de serviços externos.
- Mantidas RSI, MACD, Bollinger, Wyckoff OHLC, SMC aproximado, FVG, Fibonacci, AB=CD, regime e análise multi-timeframe.

## Regras preservadas
- XAUUSD: Clássico e Turbo só sinalizam COMPRA/VENDA com projeção mínima de US$ 4,00 inclusive; senão AGUARDAR.
- Copy Trade é simulado, e seu limiar permanece **score Turbo >83/100** (estritamente; 83 não entra), sujeito à integridade dos candles e níveis coerentes. Não executar ordens reais.
- MetaTrader 5 fica fora deste pacote.
- Interface antiga preservada, com seção de diagnóstico adicional dentro do painel técnico.
- `index.html` na raiz do ZIP funciona diretamente no Netlify sem arquivos de versões antigas.

## Limitações
A análise é uma implementação independente de conceitos publicamente descritos no site da VTX Trade IA (https://vortextradeia.com/). Não há acesso à implementação privada, aos pesos ou aos modelos proprietários dela. Pivotamentos, liquidez e Wyckoff são inferências a partir de OHLC; não são fluxo de ordens institucional.

O score é **heurístico, não uma probabilidade calibrada**. A auditoria pode rejeitar sinais que teriam dado lucro e não garante taxa de acerto. Testes automatizados verificam invariantes e cenários sintéticos, não rentabilidade. Antes de usar: testar feed ao vivo, mercados diferentes, histórico com walk-forward e conta demo; comparar sinais antes/depois, incluindo falsos negativos.

## Arquivos
- `index.html`: aplicativo completo independente.
- `engine/v10_dual_core.js`: fonte legível do motor evoluído, também embutido no HTML.
- `engine/v10_comparison_ui.js`: painel de avaliação.
- `tests/`: testes Node de integridade, filtros de ouro, regressão e auditoria v10.2.

Release na ramificação `feature/v10-2-vtx-signal-engine-20261111`; `main` permanece sem alterações.
