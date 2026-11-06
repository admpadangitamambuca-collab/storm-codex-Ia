# Storm Códex IA — v9.5 | Gráfico Turbo + Copy Trade fictício

## Entrega Netlify autossuficiente
- O ZIP abre no Netlify Drop: `index.html` **contém todo o CSS e JavaScript necessários**, sem arquivos de versões anteriores.
- O HTML `STORM_CODEX_IA_v9_5_GRAFICO_TURBO_COPY_TRADE_EDITAVEL.html` é o mesmo aplicativo standalone, distribuído individualmente para edição.
- `src/` preserva em arquivos separados o complemento CSS/JavaScript da v9.5; `backup/` mantém a base completa 9.4 que originou esta versão, permitindo rollback.
- **Sem execução real de trades**. Não há autenticação ou ligação com corretoras na função Copy Trade.

## Mudanças de interface
1. Abaixo de `Entrada / Stop Loss / Take Profit` no Turbo, aparece um segundo gráfico das velas já fechadas do ativo/timeframe selecionado, com EMA9, EMA21, zonas OHLC indicativas, Entrada, Stop e TP1. O gráfico original e a interface da versão 9.4 continuam disponíveis.
2. Um botão **Copy Trade** é adicionado ao lado do botão **Turbo** no cabeçalho. Sua aba mostra 4 gráficos simultâneos: EURUSD, XAUUSD, USDJPY e AUDUSD; as abas M1/M5/M15/H1 alternam apenas a visualização e não interrompem o monitor dos quatro períodos.
3. O rodapé da aba contém tabela de registros (direção, índice de confluência, preço, stop, TP1, lote e resultado) e soma de lucro/prejuízo fictício em USD. Há exportação CSV local.

## Regra do monitor de sinais
- Fonte pública `SGV78Data` Biquote, incluindo recuperação H1 do ouro exclusivamente com OHLC da mesma fonte quando disponível.
- Busca velas dos quatro ativos em M1/M5/M15/H1, enquanto a página está aberta. As consultas são limitadas para evitar sobrecarregar o serviço gratuito.
- O sinal só é incluído se o **motor Turbo Equilibrado 9.4 efetivamente aprovar** o cenário, com **score estritamente maior que 80/100**, níveis válidos (Entrada, Stop e TP1), fonte atual e vela encerrada.
- A primeira consulta apenas estabelece o ponto de partida. Não importa candles antigos como trades executados. Se o navegador permanecer fechado ou a fonte estiver indisponível, não são inventadas operações.
- Um toque futuro no TP1 encerra a posição fictícia integralmente; o toque no stop encerra com prejuízo. Se stop e TP1 caírem no intervalo da **mesma** vela, o registro vira ambíguo (desconhecemos a ordem intravela). Falta de velas consecutivas torna o resultado incompleto. 6 velas futuras sem toque geram status "Expirado", sem P&L.
- Os registros ficam no armazenamento local do navegador, isolados do histórico do Clássico/Turbo legado.

## Lotes e cálculo do P&L estimado
| Ativo | Volume | Contrato padrão suposto | P&L em USD |
|------|--------|-------------------------|-----------|
| XAUUSD | 0,01 lote | 100 oz/lote | diferença em USD por oz × 1 oz |
| EURUSD | 0,04 lote | 100.000 EUR/lote | diferença em USD por EUR × 4.000 EUR |
| USDJPY | 0,04 lote | 100.000 USD/lote | diferença em JPY × 4.000 USD, convertida pela cotação de saída (USD/JPY) |
| AUDUSD | 0,04 lote | 100.000 AUD/lote | diferença em USD por AUD × 4.000 AUD |

Valores são **hipotéticos** e excluem spread, slippage, comissão, execução parcial, impostos, swap e diferença de especificações contratuais entre corretoras. Não representam saldo real de corretora, nem garantem rentabilidade.

## Preservação e limitações
- Partida da v9.4 Turbo Equilibrado do repositório `admpadangitamambuca-collab/storm-codex-Ia`, derivada da 9.3.1 com correção H1 de XAU.
- Regras, portões, armazenamento e estrutura dos motores Clássico Precision e Turbo Equilibrado **não foram alterados**. Para avaliação isolada dos quatro ativos, foram adicionados dois pontos de extensão de leitura: um contexto de snapshots MTF e um construtor de contexto no objeto público Turbo. Os caminhos do painel original não passam esses novos parâmetros.
- Controles estéticos e novos registros são código isolado (`storm-v95-copy-trade`).
- A monitorização exige navegador **aberto** e conectividade. O Netlify estático não cria execução em segundo plano nem conta compartilhada; em outro dispositivo os registros locais não aparecem automaticamente.
- A obtenção de velas reais pela Biquote não pôde ser comprovada nos testes offline desta entrega. Valide no Netlify, acompanhe os avisos de integridade do feed e compare com uma cotação confiável antes de dar valor às estatísticas.

## QA local concluído
- Análise de sintaxe de todos os scripts JS embarcados, sem erros.
- Chromium 390×844 e 1440×900: botão Copy Trade, painel gráfico Turbo, 4 gráficos, navegação e renderização sem erros de página nos testes offline.
- Testes unitários de TP, SL, ambiguidade intravela, lacunas, expiração e conversão USDJPY/EURUSD/AUDUSD; resultados esperados aprovados.
- Teste de integração com fonte OHLC e motor aprovador simulados: primeira consulta não criou trades; novas velas geraram registros no armazenamento simulado. Este teste é deliberadamente artificial, **não valida qualidade dos sinais nem acesso público ao feed**.
