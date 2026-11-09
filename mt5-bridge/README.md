# Storm Códex IA — ponte opcional para MetaTrader 5 (Windows)

**Estado:** implementação experimental isolada. **NÃO instalada, não conectada a uma corretora e não validada com MT5 real.** A versão principal do aplicativo permanece intocada enquanto esta ramificação estiver em revisão.

## O que foi feito

- A v9.9 Turbo contextual / Copy Trade >83 continua com Clássico, Turbo, histórico e simulação.
- Novo cartão **Conectar MetaTrader 5** somente na aba Copy Trade. Ele verifica, no próprio PC, o estado do serviço local, mas não recebe login nem senha.
- API pública do simulador recebe apenas o método adicional \`scanScheduled()\`; nenhuma regra de sinal, score ou lote foi modificada.
- Ponte local com Node.js + Chromium/Playwright, que abre uma sessão própria do aplicativo no computador, chama o analisador já existente e lê **somente registros prospectivos do simulador**.
- Candidato precisa ter origem conhecida, Turbo estritamente >83, fechamento e OHLC coerentes, stop/alvo coerentes, feed válido e carimbo recente. Identificador único e fila persistente evitam reenvios normais.
- Robô **StormCodex_LocalBridge.mq5** recebe sinais apenas do serviço local por WebRequest e confere preço da corretora, spread, stops, símbolo, conta, risco via OrderCalcProfit, máximo de posição, número de operações e perda diária desde o início do dia observado no terminal. Só usa **lote calculado pelo risco**, jamais o lote fictício do aplicativo.
- Travas padrão: \`executionEnabled=false\` na ponte, \`InpEnableTrading=false\` no MT5 e \`InpAllowRealAccount=false\` no MT5.
- Porta HTTP restrita ao loopback \`127.0.0.1\` e token secreto em arquivo local ignorado pelo Git.

## Instalação inicial para **apenas testar conexão**

1. No PC Windows que ficará ligado, instale **MetaTrader 5**, **Node.js 20 ou superior** e abra esta pasta \`mt5-bridge\` da ramificação.
2. Num Prompt de Comando aberto nessa pasta, execute:
   \`\`\`bat
   npm install
   npx playwright install chromium
   copy config.example.json config.json
   \`\`\`
3. Gere um segredo aleatório **no seu computador**, sem enviar a ninguém:
   \`\`\`bat
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   \`\`\`
   Copie o resultado e substitua o campo \`secret\` em **config.json**. Mantenha esse arquivo somente no PC.
4. Substitua \`appUrl\` pelo endereço **HTTPS do seu Storm Códex IA publicado**. Use a versão deste ramo no seu ambiente de teste; o site principal não recebe estes arquivos automaticamente. Se o login do site aparecer, autentique-se manualmente na janela aberta pela ponte. **Nunca forneça senha da corretora ao site ou à ponte.**
5. Ajuste \`symbolMap\` aos nomes reais **da sua corretora** no MT5, por exemplo \`XAUUSD\` ou um símbolo com sufixo. Não invente ativos.
6. Execute \`npm start\`. O Chromium separado abrirá e a ponte anunciará \`127.0.0.1:8765\`. No mesmo computador, abra **http://127.0.0.1:8765/status**. A ponte ainda estará com execução desligada.
7. Se o app exigir login, conclua-o uma vez com \`headless:false\`. Depois, poderá trocar para \`headless:true\` e reiniciar para manter somente o **processo da ponte** e seu navegador controlado em segundo plano. Não é necessário deixar o navegador do celular aberto. **Não feche o processo Node nem desligue o Windows.**

## Conectar o MT5 em conta demonstrativa

1. No MetaTrader 5 Windows, entre em sua **conta demo**. Abra o MetaEditor (\`F4\`) e crie/abra \`MQL5/Experts/StormCodex_LocalBridge.mq5\` com o conteúdo do arquivo deste ramo. Compile com \`F7\`. **A compilação MQL5 ainda precisa ser confirmada no Windows.**
2. Em **Ferramentas → Opções → Expert Advisors**, inclua \`http://127.0.0.1:8765\` em **Permitir WebRequest para as URLs listadas**. Ative negociação algorítmica somente quando decidir testar ordens demo.
3. Anexe o EA a um gráfico, configure \`InpBridgeToken\` com o **mesmo token secreto** do \`config.json\`. Deixe \`InpEnableTrading=false\` e \`InpAllowRealAccount=false\` para testar primeiro a conexão.
4. No PC, no Copy Trade, clique **Conectar MetaTrader 5 → Verificar ponte neste computador**. Ou consulte o JSON \`/status\` local. A presença de \`mt5Connected=true\` significa somente que houve comunicação; **não significa que o robô já tenha operado**.
5. Só depois de confirmar conexão, dados e filtros em demo, altere \`executionEnabled\` para \`true\` em seu \`config.json\`, reinicie o Node e reanexe o EA com \`InpEnableTrading=true\`. A conta deve continuar **DEMO**. A conta real permanece proibida pelo segundo interruptor \`InpAllowRealAccount=false\`.
6. Confira manualmente no MT5 os resultados, o stop, o take e o diário do robô. Sinais podem ser rejeitados por risco, preço diferente do feed público, mercado fechado ou volume mínimo. **Rejeitar é intencional, não corrigir stops ou aumentar lote automaticamente.**

## Conta real — somente após validação

A estrutura prevê uma segunda autorização local \`InpAllowRealAccount\`, além de \`executionEnabled\` e \`InpEnableTrading\`. **Não recomendamos ativá-la antes dos testes completos, de revisão humana do código MQL5, de simulação de quedas/reconexões e de validação com a corretora escolhida.** Não existe autorização remota no site para liberar dinheiro real.

## Segurança e limites conhecidos

- Não há garantia de lucro. Score de confluência >83/100 **não é probabilidade de ganhar**.
- A execução depende de Windows/Node, browser Playwright ativo em segundo plano, internet, feed público, sessão válida e MT5 Windows aberto com sua corretora. Falhas de autenticação, atraso do feed ou indisponibilidade impedem novas entradas. O histórico do simulador do site **não se transforma retroativamente** em ordens.
- O serviço não aceita ordens enviadas pelo site: usa apenas o registro local do Copy Trade da sessão controlada. Ele também **não envia credenciais de MT5 para Netlify/GitHub**.
- Se PC ou ponte pararem, **não abre novas ordens**. Stops e takes aceitos no servidor da corretora geralmente permanecem, mas confirme sua execução no MT5.
- A proteção contra duplicidade usa fila persistente, identificadores globais do terminal e histórico de corretora. Mesmo assim, interrupções na janela exata entre ordem e confirmação precisam de **testes reais em demo**. Não existe garantia absoluta contra duplicidade.
- O navegador do celular não enxerga \`127.0.0.1\` do PC. A verificação de status no site só é confiável no mesmo computador; para observar operações de longe, use o aplicativo MT5 Mobile.
- Os testes automáticos cobrem somente validação e persistência da fila em Node. Não substituem compilação MQL5, teste de operação com conta demo e verificação de deploy.
- Alguns brokers adicionam sufixos e alteram mínimos de stop, spreads e lotes. Ajuste apenas após ver valores reais em \`Especificação\` no MT5.

## Testes no PC

\`\`\`bat
npm test
node --check bridge-core.mjs
node --check bridge-server.mjs
\`\`\`

## Voltar à versão anterior

Não ative a ponte nem o EA; o site funciona normalmente. Se estiver usando uma versão de teste, retorne ao \`index.html\` do ramo \`main\` ou use a cópia da versão anterior no histórico. Nenhuma migração de dados é exigida.
