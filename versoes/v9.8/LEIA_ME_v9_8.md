# Storm Códex IA 9.8 — 06/11/2026

Base: v9.7, mantendo Clássico Precision, Turbo Equilibrado, Copy Trade fictício, dados públicos, gráficos e chuva.

## Alterações
1. Copy Trade: XAUUSD 0,10 lote. EURUSD/USDJPY/AUDUSD 0,15 lote. São tamanhos apenas da simulação, NÃO executam ordens.
2. Operações já registradas com 0,01/0,04 continuam no histórico com seus lotes e P&L originais; registros novos usam 0,10/0,15.
3. Ícone ⚡ no botão Turbo. Quando o Turbo é ativado, brilho pulsante no botão e eletricidade decorativa nos quatro cantos; ao desativar, cessa. Respeita reduced-motion.
4. Motor Clássico Precision PA 9.8: 40 pontos para price action causal no timeframe selecionado, 15 tendência, 15 candle, 10 regime, 15 risco, contribuição MTF ±5. Reconhece rompimento, reteste, varredura, rejeição, engolfo e continuação por pivôs confirmados. Sem gatilho local, não aprova entrada. Mantém veto do motor original, ATR, qualidade de OHLC, R:R, armadilhas, modo demo e filtro do XAUUSD > US$3/vela.
5. Aprendizado/histórico das regras antigas preservado no armazenamento local de v9.3; nova versão usa chave v9.8 independente para não contaminar estatísticas.

## Instruções
O ZIP contém index.html autossuficiente, pronto para upload manual no Netlify. Não é um patch.
O Copy Trade é apenas simulação local com OHLC público, requer página aberta, não há integração com MT5.
O capital inicial fictício continua US$100, sem limite artificial para P&L; lotes maiores elevam bastante risco de saldo negativo. Não inclui custos reais.

## Verificações
Sintaxe dos scripts inline: 22 analisados, sem falhas. Testes isolados: novo score PA, ausência de leitura futura, integração do Precision e preservação dos critérios 78/65.
Teste de navegador em tempo real e integridade de provedores externos não executados.
