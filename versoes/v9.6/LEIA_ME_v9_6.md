# Storm Códex IA v9.6 — Tempestade + Copy Trade com dupla confirmação e patrimônio fictício

Base: v9.5 no commit b69bc7bd8f77647f0f66ccce74caf5ec7b8a6bb7 (06/11/2026).
Arquivo único `index.html`, CSS e JS embutidos: hospedagem estática no Netlify.

## Mudanças
- Logo refinada com brasão dourado; topo com nuvens, chuva e raios em CSS, sem dependências de imagens externas.
- Copy Trade inicia somente se o score Turbo for >=78 e o score do motor original >=65 na vela fechada, **ambos** com números válidos. Bloqueios essenciais, integridade e atualização de fonte do Turbo seguem necessários.
- Não muda as funções do Clássico Precision nem do Turbo Equilibrado. A regra nova é exclusiva da simulação Copy.
- Seletores independentes de ativo e período: XAUUSD, EURUSD, USDJPY e AUDUSD; M1, M5, M15, H1. Os demais ativos continuam monitorados ao visualizar apenas um deles.
- Gráfico do ativo com EMA9/EMA21, OB ativos calculados a partir do OHLC disponível e retrações Fibonacci com referências 0, 23.6, 38.2, 50, 61.8, 78.6 e 100%; marcações dependem dos candles e condições de detecção.
- Carteira fictícia iniciada em US$ 100. Gráfico da evolução realizada por data de encerramento: ganhos de takes e perdas de stops. Posições pendentes, ambíguas, expiradas e incompletas não entram no valor da carteira.
- Preservação do storage local v9.5; novas operações indicam score original e versão 9.6. Exportação CSV com dupla pontuação.
- Lotes preservados: 0,01 XAUUSD, 0,04 EURUSD/USDJPY/AUDUSD. Cálculos não incluem custos, spread, swap, impostos etc.

## Verificação
- Código JS embarcado analisado sintaticamente (compilação sem execução).
- Todos os blocos de script da versão anterior exceto complemento v9.5 têm código byte-a-byte preservado.
- QA com feed ao vivo e resultado de trade em mercado real **não foram realizados** por este agente. Não há execução de ordens nem backtest retroativo.
- Operações dependem da página aberta, acesso público a Biquote, tempo real do navegador e de todos os bloqueios de segurança existentes. Se a fonte atrasar ou ficar indisponível, não deve abrir simulação.
