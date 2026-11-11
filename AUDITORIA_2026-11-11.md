# Storm Códex IA — Auditoria técnica de 11/11/2026

## Escopo
Base: `main` no commit `27e9a20f47a3b2b0f7953a756ed5c8343ca815ca`, atualizada na ramificação `fix/auditoria-geral-20261111`.

Inspeção estática de `index.html` (4.472 linhas na base original, 23 scripts JavaScript inline), além das regras da fonte Biquote/Binance, do Clássico Precision, Turbo Equilibrado e Copy Trade fictício. As cópias históricas em `versoes/` não foram reescritas, para manter a rastreabilidade.

## Defeitos identificados e corrigidos

1. **Timestamps OHLC numéricos como texto:** o parser de velas aceitava números Unix como number e ISO string, mas descartava segundos/milissegundos Unix serializados em string. Corrigido.
2. **Descarte de temporizador após abort antecipado:** o helper de requisição criava timer antes de detectar sinal AbortSignal já cancelado. Pré-checagem movida antes da criação do timer.
3. **Sinal retido após erro HTTP:** se um refresh falhava após uma consulta válida, o snapshot retido podia continuar com `providerStale:false`. Agora é sinalizado como desatualizado, evitando aparentar confirmação atual.
4. **Confluência MTF não estritamente causal:** o Turbo considerava timeframe auxiliar recente mesmo com `closedAt` posterior ao candle do sinal. Agora só conta velas auxiliares encerradas até `data.state.closedAt`.
5. **Resultado pendente eterno no Clássico:** quando a vela de entrada saía da janela histórica e o horizonte já terminara, o registro ficava pendente. Agora passa a `incomplete`, sem atribuir take ou stop.
6. **Resultado pendente eterno no Turbo:** mesma condição no livro Turbo; agora marca `incompleto`.
7. **Resultado pendente eterno no Copy Trade:** mesma condição no simulador; agora marca `incompleto`.
8. **Operação Copy em OHLC com lacunas:** `qualityCheck.fresh` não implicava continuidade temporal; a elegibilidade agora exige `valid` e ausência de `gaps`.
9. **CSV vulnerável a fórmula de planilha:** exportação do Copy agora prefixa valores potencialmente executáveis quando importados como células.
10. **Service worker ausente:** `/sw.js` era registrado sem existir no projeto. Foi incluído service worker mínimo, sem cache de cotações e sem lógica de negociação. Push segue opcional e depende de backend autorizado e credenciais configuradas.
11. **Documentação divergente:** README ainda descrevia a regra revogada 78/65. Corrigido para `Turbo >83/100`, sem segundo score do Clássico.

## Preservado

- Clássico Precision, Elliott e regras de segurança.
- Turbo contextual/seletivo com score heurístico 0–100 e bloqueios do seu painel.
- Copy Trade fictício somente para XAUUSD, EURUSD, USDJPY e AUDUSD: entrada com score Turbo **estritamente superior a 83/100**, mais requisitos técnicos de integridade de dados, direção e níveis coerentes.
- Lotes XAUUSD 0,10; outros 0,15. Não há execução de ordens reais.
- Identidade visual, chuva, raios, gráficos e históricos persistentes.
- Versões legadas em `versoes/` para comparação.

## Testes de regressão

Executar na raiz: `node --test tests/auditoria.test.cjs`

Os 11 testes cobrem: sintaxe dos 23 scripts, timestamps ISO/Unix, rejeição de vela aberta/invalidada, reconstrução H1 apenas com quatro M15, causalidade MTF, take/stop ambíguo e perda do candle inicial em Copy/Turbo/Precision, atualização de stale após falha, limiar de 83 e bloqueio de gaps, proteção CSV e sintaxe do service worker.

Workflow: `.github/workflows/auditoria.yml` (GitHub Actions no branch/PR).

## Limitações e riscos residuais

- Passar nos testes não prova ausência de bugs. Não foi possível validar neste ciclo uma sessão real completa em navegador com feed Biquote/Binance vivo durante fechamentos de vela.
- Serviços gratuitos externos e CORS podem falhar, atrasar, limitar requisições ou revisar candles após sua publicação.
- O score é **heurístico**, não uma probabilidade de acerto estatisticamente demonstrada.
- O Copy Trade é **simulação sem execução real**, com saída idealizada em TP/stop pelos extremos OHLC; custos, spread, slippage, latência e ambiguidade intravela podem diferir da realidade. Resultados devem ser interpretados como estimativa fictícia.
- Os históricos são locais no navegador, salvo configurações adicionais do Supabase. Não há sincronização automática garantida entre dispositivos.
- A funcionalidade push exige serviço Netlify/backend e configuração; `sw.js` isoladamente não ativa alertas remotos.

## Publicação

Para Netlify Drop, usar pacote `Storm_Codex_IA_AUDITADO_NETLIFY.zip` contendo `index.html`, `sw.js` e `LEIA_ME.txt` na raiz. Reutilizar a versão antiga sem estes arquivos não aplica a correção.
