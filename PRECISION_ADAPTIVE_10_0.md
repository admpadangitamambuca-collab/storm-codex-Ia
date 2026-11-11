# Storm Códex IA — Precision Adaptive 10.0

Data: 11 de novembro de 2026.

## Objetivo
Nova camada causal de análise para Clássico Precision e Turbo Seletivo, sem alteração da identidade visual, sem MetaTrader 5 e sem ordens reais. É uma evolução experimental, não um ganho de acerto demonstrado.

## Melhorias implementadas
1. Estatística observada por ativo, período, direção e setup, usando apenas desfechos registrados antes do fechamento atual.
2. Regimes de mercado por eficiência direcional, volatilidade relativa, compressão, lateralização, tendência e rompimento.
3. Gatilhos causais de rompimento, reteste, retomada e continuação; o Turbo exige validação adicional de rompimento.
4. ATR dinâmico, bloqueio de choque de volatilidade, auditoria OHLC e diagnóstico de sessão.
5. Confluência multitemporal ponderada e veto para conflito forte.
6. Preservação dos filtros macroeconômicos existentes; NÃO adicionamos fontes novas de calendário ou spread executável.
7. Laboratório walk-forward disponível pela API StormAdaptive.walkForward; separação temporal 60/40 com lacuna de segurança, custos estimados, critério stop-primeiro e estatísticas em R.
8. Calibração prospectiva exibida separadamente do score técnico, intervalo Wilson 95% e divisão temporal diagnóstica 70/30.

## Comportamento preservado
- O Clássico mantém Price Action, Elliott, regras XAUUSD e seu score. O Adaptive apenas pode bloquear uma aprovação operacional.
- O Turbo mantém seus componentes, níveis, score e seletividade. O Adaptive apenas pode bloquear aprovações.
- Copy Trade fictício: mantém exclusivamente score Turbo estritamente maior que 83/100 como critério de seleção; a aprovação seletiva do Turbo não se torna um segundo veto. Dados OHLC, níveis e direção válidos seguem obrigatórios.
- Históricos observados Clássico e Turbo separados, sem usar desfechos posteriores ao momento avaliado.

## Instalação Netlify
Extraia o ZIP e envie index.html e storm-adaptive.js juntos na raiz. O ZIP inclui os dois arquivos e não depende das versões anteriores. O app utiliza feeds públicos e precisa da página aberta para registrar sinais prospectivos.

## Testes
Execute: node tests/adaptive.test.js
O GitHub Actions testa a sintaxe dos scripts, a causalidade temporal, a calibração, a avaliação walk-forward e a preservação do limiar Copy.

## Limitações
Não há evidência de aumento de assertividade. Sem validação operacional ao vivo no navegador, feeds, calendário oficial ou execução real nesta entrega. Spreads, slippage e taxas do walk-forward são parâmetros estimados. Mantenha main estável até homologar a ramificação experimental.
