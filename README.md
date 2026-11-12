# Storm Códex IA v11.2 — Nasdaq Yahoo ^NDX + Precision Clássico/Turbo (12/11/2026)

## Nova fonte exclusiva do Nasdaq-100
- O símbolo **NASDAQ** do app deixa de usar Biquote e passa a consultar o **Nasdaq-100 Index `^NDX`** (Yahoo Finance Chart v8; fonte pública não oficial, gratuita, sem chave e sem login).
- No Netlify com integração Git, a chamada passa pela função serverless `/.netlify/functions/nasdaq-ohlc?tf=M5`, que responde OHLC fechado com identidade `^NDX` e timeframes M1/M5/M15/H1. Hospedagem Netlify pode exigir uso dentro das cotas do plano; o provedor pode limitar/alterar a API.
- Quando o deploy for um **ZIP puramente estático**, sem função Netlify publicada, o app tenta em seguida o **proxy público gratuito cors.dev** para a mesma rota Yahoo `^NDX`, sem enviar credenciais. Esse proxy de terceiros **não oferece garantia de disponibilidade, rapidez ou privacidade de metadados de acesso**. O caminho recomendado é publicar o repositório via conexão Git no Netlify, com funções ativadas.
- Não substitui `^NDX` por CFD NAS100, índice Nasdaq Composite, futuros `NQ=F`, ETF QQQ, dados sintéticos nem candles abertos. Se o Yahoo responder errado ou estiver bloqueado, mostra o diagnóstico e evita sinal falsamente atualizado.
- **O dado do índice pode ter atraso de 15 minutos ou mais.** Com OHLC defasado, o painel mostra histórico/diagnóstico, mas não libera sinal seletivo de execução. `^NDX` não representa o preço exato de um CFD NAS100 da corretora.
- Apenas **NASDAQ** mudou de fonte. **XAUUSD, Forex, BTCUSD e S&P500** continuam com Biquote; BTCUSDT usa Binance Spot; WIN/WDO continuam com a consulta B3/Biquote.

## Motor Clássico — qualidade v11.2
- Complemento causal de **EMA 9/21/50**, eficiência direcional (20 velas), Choppiness 14, ATR14 relativo ao regime, RSI14, histograma MACD, força de fechamento, rompimento confirmado e varredura/liquidez.
- Ajuste limitado do score técnico **-6 a +4 pontos** e vetos de volatilidade anômala, entrada esticada e varredura contrária. Não muda o histórico, nem inventa candles ou confiança estatística.
- **XAUUSD Clássico mantém obrigatoriamente a projeção mínima de US$4 em UMA vela para COMPRA/VENDA**. Quando o gate falha, permanece em AGUARDAR; o novo complemento não pode reverter esse bloqueio.

## Motor Turbo — plano XAU independente, inclusive abaixo de US$4
- A análise Turbo **não herda mais automaticamente o gate de US$4 do Clássico**. Recebe um snapshot das métricas de base pré-gate, sem alterar o retorno do Clássico.
- O Turbo estima **TP1 e Stop por ATR14/estrutura do próprio timeframe**, com confluência EMA, momentum, regime, varreduras, Choppiness, volatilidade e checagens adicionais. O TP1 pode ser **US$1–US$3**, por exemplo, se existir estrutura válida e proporção risco/retorno suficiente.
- A interface mostra o alvo do Turbo e explica quando é menor que US$4, junto com confluência/100, entrada e stop. Não significa que qualquer leitura será aprovada: OHLC atrasado, risco excessivo, macro não verificada, gatilho ausente e MTF contrário continuam bloqueando.
- O Turbo continua com seu cálculo próprio, filtros seletivos, ajustes por ativo, memória adaptativa e histórico; sua memória aprende apenas resultados futuros observados em velas válidas.
- **Copy Trade permanece fictício e somente usa aprovações do Turbo com confluência estritamente acima de 83/100.** Lotes anteriores preservados. Sem ordens reais.

## Testes e publicação
- Testes de sintaxe nos **29 scripts inline** e módulos externos; arquivo `tests/v112-smoke.test.js` executável com `node --test tests/v112-smoke.test.js` (Node 18+).
- Os testes unitários usam **candles sintéticos para validar a lógica**, sem simular acurácia financeira. A conectividade real, limites e atraso de `^NDX` no Netlify ainda exigem validação com o site publicado.
- Para publicar a versão integral: use a **raiz completa do repositório** e preserve `index.html`, `storm-nasdaq-v112.js`, `storm-precision-v112.js`, `netlify/functions/nasdaq-ohlc.js`, `learning-v108.js`, `b3-indices-v111.js` e `sw.js`.

---

# Storm Códex IA v11.1 — WIN e WDO integrados ao modo Índices (12/11/2026)

## Motor brasileiro de minicontratos

- Novos ativos **WIN (mini índice)** e **WDO (mini dólar)**, exclusivos dos botões do modo Índices. Nenhum dos dois foi adicionado ao Copy Trade.
- Motor B3 independente de Clássico e Turbo: EMA 9/21, rompimento da faixa recente, ATR 14, razão de volatilidade, posição de fechamento, inclinação do preço e VWAP estimada de candles. Score /100 é técnico, não probabilidade estatística calibrada.
- WIN: R$ 0,20 por ponto e ticks de 5 pontos. WDO: R$ 10 por ponto e ticks de 0,5 ponto, por minicontrato. Quantidade mínima visual para estudo: 1 contrato.
- Fonte de consulta sem chave/login: **Biquote REST**, catálogo público de símbolos e OHLC M1/M5/M15/H1. O provedor precisa realmente oferecer o ticker B3 exato (ex.: WINZ26 e WDOZ26). O sistema verifica ticker, série de vencimento, OHLC, candles fechados e defasagem. **Se a fonte não disponibilizar WIN/WDO intradiários, o motor não emitirá sinais e exibirá diagnóstico.** Não mistura Ibovespa spot com WIN nem USD/BRL spot com WDO.
- Seleção por calendário B3: WIN vence nos meses pares na quarta-feira mais próxima de 15 (ou sessão seguinte); WDO vence no primeiro dia útil do mês, com último pregão na sessão anterior. Não há contrato novo todo dia. A aplicação verifica mudança do contrato esperado a cada 20 segundos enquanto a aba Índices estiver ativa e manda atualizar as leituras.
- Dias úteis incluem finais de semana e principais feriados B3 recorrentes; calendário extraordinário deve ser conferido com a bolsa e com o catálogo do provedor. Disponibilidade de contrato e liquidez não podem ser presumidas.
- Memória adaptativa distingue o ticker vigente de contratos anteriores na calibração B3; acompanha resultados pendentes com os mesmos dados públicos, quando disponíveis. Sem backfill inventado, sem ordens reais.
- **Teste com resposta real do provedor não foi possível neste ambiente.** Antes de usar sinais, valide a disponibilidade efetiva de WIN/WDO no painel e confirme cotações na corretora.

Fontes B3 (regras): https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/renda-variavel/mercado-de-acoes/futuro-de-ibovespa.htm e https://b3.com.br/pt_br/produtos-e-servicos/negociacao/moedas/futuro-mini-de-taxa-de-cambio-de-reais-por-dolar-comercial.htm

## Publicação completa

A versão exige publicar **todos os arquivos** do diretório raiz, incluindo `index.html`, `b3-indices-v111.js`, `learning-v108.js` e `sw.js`. O código foi preparado para ser integrado à ramificação principal `main`, não como patch isolado. O Netlify estático não executa Javascript enquanto a aba estiver fechada.

---

# Storm Códex IA v11.0 — NAS100 corrigido e memória adaptativa em todos os ativos (12/11/2026)

## NAS100 / Nasdaq-100

- Primeiro consulta `https://biquote.io/api/NAS100/ohlc` no período selecionado.
- Caso não haja candles reais válidos, consulta o catálogo `/api/symbols/search` e verifica aliases estritamente relacionados ao Nasdaq-100 (`US100`, `USTEC`, `NASDAQ100`, `NDX`, ou códigos explicitamente identificados), sem ações/ETFs ou ativos não relacionados.
- O símbolo real confirmado aparece no painel e na ponte de leitura; sem feed verificável, sinal é bloqueado e há diagnóstico do erro.
- Dados defasados, mercado fechado, falhas HTTP e candles abertos são sinalizados, não geram operações fictícias.
- Não foi possível validar a cotação NAS100 ao vivo nesta sessão. Testar diretamente no Netlify com rede e mercado disponíveis antes de publicar na principal.

## Memória adaptativa — todos os mercados

Ativos: `XAUUSD`, `BTCUSD`, `BTCUSDT`, `EURUSD`, `USDJPY`, `USDCAD`, `USDCHF`, `AUDUSD`, `NASDAQ`, `SP500`.

- Memória individual por **ativo + timeframe + motor**: Clássico para metais/Forex/Bitcoin; Índices para Nasdaq/S&P 500; Turbo para análises em que o motor Turbo efetivamente emite leituras.
- Apenas sinais novos observados prospectivamente com confluência **estritamente maior que 78/100**, OHLC público e entrada/stop/alvo válidos.
- Captura resultados mesmo quando há outras leituras pendentes, mas **desconta a dependência estatística de sinais sobrepostos** na calibração.
- Motor de aprendizado em camadas: características de preço/volatilidade/sessão, taxa de acertos observada, retorno em R, confiança Wilson, regularização por recência, detecção de deterioração e validação cronológica 70/30 com embargo.
- Ajuste conservador: até +3 ou −4 pontos do score apenas após amostra independente suficiente. Score heurístico não é chance garantida de lucro.
- Reconciliador de resultados pendentes: enquanto a aba estiver aberta/visível, revisa até seis conjuntos por ciclo de 95 segundos usando os feeds existentes, inclusive de outros ativos e períodos. **Não cria sinais retrospectivos nem aprende novos sinais quando o app está fechado.**
- Painel mostra memória dos dez ativos e permite backup JSON/restauração manual. Histórico anterior v10.8 é preservado; não transfere automaticamente entre aparelhos.
- Copy Trade fictício mantém regra anterior do Turbo, exigindo score **>83/100** para entrada, sem ordens reais.
- Testes estáticos de sintaxe dos scripts e testes unitários sintéticos aprovados. Não é validação de desempenho financeiro e não comprova disponibilidade do NAS100 ao vivo.

## Deploy

Baixe o ZIP da ramificação `feature/indices-live-and-adaptive-memory-v110-20261112` e publique o conteúdo inteiro no Netlify, mantendo `index.html`, `learning-v108.js`, `sw.js` e demais arquivos da raiz juntos. Se houver cache no navegador, faça recarga forçada; nunca publique apenas o HTML.

---

# Storm Códex IA v10.8 — Aprendizado por resultados prospectivos (12/11/2026)

- Os três motores **Clássico, Índices (Nasdaq-100 e S&P 500) e Turbo** passam a avaliar um histórico local isolado por motor, ativo e timeframe. Um resultado não contamina outro.
- Novos parâmetros OHLC: EMA 9/21 normalizadas pelo ATR, RSI 14 informativo, eficiência direcional, posição de fechamento no candle, expansão/contração de ATR, rompimento de faixa, regime lateral/tendência e sessão UTC.
- Registra somente **novos sinais observados** no navegador, com confluência **estritamente maior que 78/100**, direção e plano de entrada/stop/alvo válidos e dados OHLC recentes, evitando duplicatas em Refresh e histórico retroativo.
- Verifica até seis velas futuras, sem lacunas e sem inventar ordem dos preços. TP e SL atingidos na mesma vela são **ambíguos** e não entram na amostra. Expirados e dados insuficientes também não contam como vitórias/derrotas.
- Ajustes técnicos são pequenos (até ±3 pontos); ajustes por resultados são limitados (−4 a +3), ativados somente após **40 operações resolvidas**, com divisão temporal 70/30 e amostras mínimas de treino/validação. Resultados futuros não são usados para calcular o sinal já emitido.
- A análise de Índices continua separada; **Copy Trade fictício segue exclusivo do Turbo com score >83/100** e lotes anteriores. O índice técnico /100 **não é probabilidade estatisticamente calibrada**.
- Nova seção recolhível de diagnóstico de aprendizado. O aprendizado é salvo em localStorage apenas neste navegador; sem execução em corretora, sem treinamento em servidor e sem aprendizado enquanto a aba estiver fechada. Testes de regressão usam OHLC sintético; exigem validação com feed real antes de atribuir eficácia.

## Publicação manual Netlify
O ZIP v10.8 contém `index.html`, `sw.js`, `learning-v108.js` e `LEIA_ME.txt` na raiz. Todos devem ser publicados juntos; arrastar o ZIP inteiro no Netlify Drop.

---

# Storm Códex IA v10.6 — monitor Copy Trade com log de leituras (12/11/2026)

- Registra no navegador as **leituras técnicas** por ativo/timeframe/vela fechada, inclusive quando nenhuma operação é autorizada. Exibe contagem de leituras, notas acima de 83/100, elegíveis e horário da última leitura.
- O botão **Refresh** consulta novamente os quatro ativos e os quatro períodos e reavalia todos os itens de confluência sem precisar de nova vela; não cria operações repetidas no mesmo fechamento.
- Monitor tenta retomar automaticamente as consultas após voltar de uma aba suspensa, reabrir uma página em cache, ganhar foco ou recuperar a conexão; varredura automática mais frequente, com limitação de consultas por fechamento.
- Mantém regra única de seleção **Turbo estritamente >83/100** e as verificações técnicas de OHLC, direção, stop e alvo para simular entradas nos próximos candles. Preserva os lotes XAUUSD 0,10 e Forex 0,15, o histórico anterior, a banca de US$100 e os dois motores.
- **Limite estrutural:** em um site HTML estático no Netlify Drop, o JavaScript não roda com a aba fechada nem enquanto o sistema operacional suspende o navegador. Esta atualização não promete operações simuladas 24 horas nem reconstrói operações passadas; para isso seria necessário um monitor de servidor com armazenamento persistente e implantação separada.
- As verificações de regressão usam dados artificiais. Ainda falta comprovar end-to-end o envio de OHLC ao navegador e uma entrada real na simulação do site Netlify publicado.

# Storm Códex IA v10.5 (12/11/2026)

Correção Copy Trade: continua usando Turbo estritamente >83/100 e candles OHLC reais fechados; não consome fechamento quando faltam níveis técnicos recuperáveis, permite reconsulta manual imediata e não duplica operações. Se o Turbo não trouxer stop/alvo mas houver direção legítima, estima níveis por ATR14 e extremos de oito velas *somente na simulação*.

Camadas específicas EURUSD (sessões UTC aproximadas, faixa asiática, EMA20/50, ATR em pips, falsos rompimentos) e XAUUSD (ATR em US$/oz, rejeições, faixa asiática, volatilidade). Peso de -4 a +4 pontos no score Turbo, visível em análise detalhada, sem garantia de acerto e sem afirmar acesso a DXY ou ordens institucionais.

O Copy exige a página aberta e ativa, e a fonte Biquote pode falhar. Testes automáticos não comprovam funcionamento end-to-end na Netlify.

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
