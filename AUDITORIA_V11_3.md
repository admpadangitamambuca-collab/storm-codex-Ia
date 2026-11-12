# AUDITORIA STORM CÓDEX IA 11.3 — 12/11/2026

## Escopo e método
- Árvore integral da `main` 11.2 inspecionada: 56 objetos Git, incluindo HTML, scripts JS, Functions Netlify, testes, fluxos CI e artefatos legados.
- Revisão estática e sintática dos **29 blocos JS inline** em ~6.000 linhas de HTML, mais módulos isolados e testes de integrações afetadas.
- Regressões com candles e respostas HTTP **simulados**; sem acesso validado ao feed de uma corretora, sem teste no Netlify publicado e sem backtest estatístico de lucratividade.
- Cobertura focalizada: seleção/rolagem de WIN/WDO, distinção entre OHLC intradiário versus fim de pregão, completude do ZIP, preservação dos motores Clássico/Turbo, Nasdaq, Copy Trade fictício e memória.

## Achados

| Gravidade | Achado | Consequência | Resolução |
| --- | --- | --- | --- |
| **Alta** | Workflow `netlify-package.yml` ainda criava ZIP 10.8 só com `index.html`, `sw.js` e `learning-v108.js` | Novos scripts, WIN/WDO, Nasdaq e Functions faltavam na distribuição | **Corrigido**: pacote 11.3 inclui todos os arquivos ativos e verifica presença no ZIP |
| **Alta / aberta** | Não foi comprovado fornecedor de candles WIN/WDO **em tempo real, gratuito e sem login** | Sem dados M1/M5/M15/H1 atuais, sinais precisam permanecer bloqueados | **Não resolvido pelo software**; não trocar por D-1, IBOV à vista, dólar comercial ou gráfico atrasado |
| **Média** | B3 primeiro consultava catálogo de símbolos mesmo com ticker vigente conhecido | Atraso/timeout em cada leitura quando o catálogo falhava | **Corrigido**: consulta ticker exato primeiro; catálogo somente em caso de falha |
| **Média** | A aba WIN/WDO não tinha referência verificável de preço quando faltava feed intradiário | Parecia vazia mesmo com informação oficial diária disponível | **Corrigido parcialmente**: exibe fechamento/ajuste e data via brapi, com contrato exato e indicação EOD |
| **Média** | Pacote ZIP estático não instala automaticamente funções Netlify | Nasdaq com proxy público e painel B3 sujeitos a CORS/indisponibilidade | **Mitigado/documentado**: recomendar deploy conectado ao GitHub, publicar as Functions |
| **Média / aberta** | Fonte Yahoo `^NDX` para Nasdaq pode ter atraso, rate limit ou bloqueio | O motor Nasdaq não terá sinal intradiário em tempo oportuno | **Mantido bloqueio de dado stale**; requer validação em produção |
| **Média / aberta** | Histórico prospectivo usa `localStorage`, navegador fechado não executa monitoramento | Memória não é compartilhada entre dispositivos nem roda continuamente | **Não corrigido**; evolução futura exige backend |
| **Baixa / estrutural** | `index.html` monolítico, muito JS inline e dezenas de atribuições `innerHTML` | Maior custo de manutenção/testes e superfície de risco se texto não for escapado | **Não refatorado** nesta correção; sugerida extração em módulos e análise de sanitização |
| **Baixa** | BINÁRIOS ZIP antigos no repositório | Confusão operacional para quem publicar arquivo legado | **Não excluídos** para preservar histórico; usar exclusivamente ZIP de `main` 11.3 |

## Integridade dos motores
- **Clássico** continua com filtro XAUUSD de US$4 em uma vela e camada Precision 11.2.
- **Turbo** mantém plano ATR/estrutura independente do filtro de US$4 do Clássico e filtros MTF, macro, risco e memória. Não presume aumento de acerto.
- **Copy Trade** continua apenas fictício; limite estritamente `>83/100` mantido, sem execução em corretora.
- **Índices**: Nasdaq `^NDX` via Yahoo, S&P500 na Biquote; WIN/WDO mantêm o motor OHLC intradiário condicional. **A brapi é somente visualização EOD**, não alimenta `computeSnapshot` ou sinais.

## Critérios de aceitação e limites
1. JavaScript sintaticamente válido; módulos referenciados presentes na árvore.
2. Testes de identidade: `WINZ26`, `WDOZ26`, rejeição de ticker diferente e de dados sem timestamp confiável.
3. OHLC aberto, incompleto ou de outro ativo não autoriza entrada.
4. ZIP integra `netlify/functions/nasdaq-ohlc.js`, `netlify/functions/b3-quote.js`, scripts v11.1/11.2/11.3, `netlify.toml` e arquivos de base.
5. **Não foi realizado teste de latência/continuidade de WIN/WDO em tempo real**, pois não existe feed sem login verificado. Sem essa evidência, NÃO declarar o recurso operacional para scalping.

## Fonte e conformidade
- B3 Market Data: https://b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/distribuidores/perguntas-frequentes/
- TradingView B3 widgets (15 min delay): https://www.tradingview.com/blog/en/b3-data-available-in-tradingview-widgets-41743/
- brapi WIN/WDO, EOD: https://brapi.dev/docs/futuros/cotacao

**Conclusão:** versão técnica e empacotamento revisados; status de WIN/WDO como motor em tempo real **pendente de fonte de mercado apropriada**.
