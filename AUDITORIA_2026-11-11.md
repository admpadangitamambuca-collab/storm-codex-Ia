# Auditoria Storm Códex IA — 11/11/2026

Base: `main` (commit anterior `27e9a20f47a3b2b0f7953a756ed5c8343ca815ca`). Preservadas as versões históricas.

## Achados e correções

1. Conversão de timestamps Unix em strings.
2. Validação high >= low.
3. Rejeição de timestamp não positivo.
4. Requisição abortada sem vazamento do timeout.
5. Reconstrução H1 com verificação adicional de high/low.
6. Limites de risco do Precision reaplicados após learning.
7. Histórico Precision marca candle originário perdido como incompleto.
8. Falha de atualização marca snapshot como stale.
9. Turbo registra saltos extremos de preço.
10. Turbo fresh considera gaps, amostra e saltos extremos.
11. Copy histórico legado exclui timeframe futuro.
12. Copy Turbo exclui snapshot futuro.
13. Macro Copy isolado por ativo.
14. Copy utiliza contexto causal do scanner.
15. Copy histórico sem candle inicial vira incompleto.
16. Copy rejeita candle desalinhado ou OHLC inválido.
17. Copy CSV neutraliza células de fórmula.
18. Acrescentado `sw.js` para evitar 404 do registro de service worker; sem cache de mercado e sem execução de ordens.
19. Corrigida a documentação da regra vigente do Copy Trade: score Turbo estritamente maior que 83, sem exigir score do Clássico. Lotes preservados: XAUUSD 0,10; EURUSD/USDJPY/AUDUSD 0,15.

## Validação automatizada

- 23 de 23 blocos JavaScript compilaram sem erro de sintaxe.
- 17 de 17 verificações direcionadas aprovadas (OHLC, timestamps, H1, Copy Trade, gaps, look-ahead, notícias por ativo).
- Teste reproduzível: `node tests/qa_auditoria_20261111.cjs` (Node.js 20+; sem pacotes externos).
- Os patches não alteram intencionalmente o design principal, os critérios seletivos do Turbo nem a regra de entrada >83 do Copy.

## Limitações importantes

- Sem teste de navegação completo em Chrome/Safari e sem teste ao vivo de CORS, rate limit ou disponibilidade da Biquote/Binance nesta execução. A fonte pública pode mudar.
- O Copy Trade é uma simulação com OHLC e não reflete custos reais, spreads variáveis, slippage, fills ou risco de execução.
- A nota Turbo 0–100 é heurística; não representa probabilidade estatística comprovada de lucro.
- Push em segundo plano continua dependente da configuração de serviço `/api/push`, chave VAPID e autenticação. `sw.js` sozinho não habilita envio de alertas.
- A auditoria não garante ausência de falhas restantes; fazer validação com feed real e teste contínuo antes de usar dados em decisões financeiras.

## Implantação Netlify

Extraia o arquivo ZIP de distribuição e publique seus arquivos de raiz (`index.html` e `sw.js`). O aplicativo é estático; fontes de preços exigem Internet no navegador.
