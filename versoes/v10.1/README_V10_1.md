# Storm Códex IA v10.1 — XAUUSD ≥ US$4 + Turbo VTX-style

Pacote autossuficiente para Netlify e estudo local, baseado na evolução Dual Engine v10.0 da ramificação de 09/11/2026. O `index.html` da raiz incorpora os 25 scripts; os dois módulos `engine/` são versões editáveis e testáveis dos scripts incorporados.

## O que mudou

**XAUUSD — Clássico e Turbo:** só sinalizar COMPRA/VENDA com projeção do preço de pelo menos US$ 4,00 na direção identificada. O valor **exatamente igual a US$ 4,00 é elegível**. A regra não mede o lucro nem garante que o mercado percorrerá a distância.

- Clássico: filtro de UMA vela do OHLC fechado, limitado por alvo técnico e estrutura; abaixo do mínimo o sinal final é AGUARDAR, não uma entrada. O aprimoramento Precision não restaura uma direção vetada.
- Turbo: gate adicional sobre a diferença de preço entre entrada e TP1, além dos filtros seletivos existentes. Apresenta AGUARDAR sem sinal operacional se a distância for inferior a US$ 4,00.
- Copy Trade simulado: preserva **score Turbo estritamente maior que 83/100** como seleção e respeita a viabilidade mínima de preço XAUUSD. Não usa nota do Clássico como veto. Não envia ordens.
- Pares de Forex e BTC permanecem com projeções nas unidades próprias; **não** se deve interpretar US$ 4 como limiar de EURUSD.

**Turbo mais próximo dos recursos públicos da VTX Trade IA:** acrescentados RSI(14) suavizado, MACD(12,26,9), bandas de Bollinger(20,2), pistas de spring/upthrust de Wyckoff por OHLC fechado, diagnóstico de sessão UTC e descontagem de indicadores correlacionados. Mantidos SMC, FVG, ordem de blocos, Fibonacci, timeframes, qualidade das fontes e freios de risco do app. Tudo é heurístico de OHLC; não copiamos algoritmo interno, modelos treinados ou sinais proprietários.

## Como usar

1. Para hospedagem, descompacte `Storm_Codex_IA_v10_1_NETLIFY_COMPLETO.zip` e publique a pasta (com `index.html` na raiz) na Netlify.
2. Para estudo local, abra `index.html` num navegador. Algumas fontes exigem HTTP(S) e podem não funcionar usando `file://`; use a hospedagem quando necessário.
3. Testes offline: `node tests/v10_dual.test.cjs`, `node tests/v10_verify.cjs`, `node tests/v10_1_gold_vtx.test.cjs`. Os testes provam regras e causalidade local, não desempenho real.

**Limitações:** nenhuma integração MT5 nesta versão, nenhum feed pago, nenhuma garantia de acerto, nenhum backtest independente validado em corretora e nenhuma promessa de reprodução exata da VTX Trade IA. Estratégias devem ser avaliadas em demo antes de quaisquer decisões financeiras.
