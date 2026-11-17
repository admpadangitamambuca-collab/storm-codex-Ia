# Storm Códex IA 11.7 — Traders Intelligence

## O que foi implementado
Aba independente **Traders** na barra superior, ao lado de Turbo, Copy Trade e Índices. Interface responsiva azul-petróleo com painel de fontes externas, formulário de importação, parser de sinais em texto (XAUUSD/EURUSD/etc.), registro local, exportação CSV, validação dos níveis e comparação de direção com os motores Clássico e Turbo.

**Os sinais externos não são gerados pelo Storm Códex IA.** Cada registro entra exclusivamente por ato do usuário, com os rótulos `user_import` e `nao_auditado`. A aba não apresenta histórico, ranking, taxa de acerto nem posições de terceiros quando não foram verificados. Nada é executado em corretora.

## Integração com Global Traders Hub
Fonte investigada: https://hubglobaltraders.com/traders e https://hubglobaltraders.com/arena.

Na parte pública, a empresa descreve uma **arena de Traders IA** com ranking/histórico. Os sinais completos exigem login e desbloqueio mediante créditos. **Não foi comprovada a existência de uma API pública autorizada** para redistribuição dos sinais; por isso a versão 11.7 **não faz scraping de área autenticada, engenharia de APIs privadas, bypass de créditos ou cópia de estratégias privadas**.

Fluxo já disponível: abrir a arena, conferir um sinal a que o usuário tenha acesso, copiar os valores para a aba Traders e comparar tecnicamente. Integração automática real depende de autorização, documentação e credenciais oficiais do provedor; ainda não está ativa.

## Importar manualmente
1. Entre na aba **Traders**.
2. Opcionalmente cole uma mensagem com `XAUUSD BUY 4200 / SL 4195 / TP1 4210` e clique em **Identificar campos no texto**.
3. Confira nome da estratégia, ativo, direção, entrada, stop, TP1 (obrigatório), outros TPs, horário original e URL da fonte.
4. Clique em **Registrar sinal para análise manual**; a operação aparece no observatório como **não auditada**. Você pode filtrar, comparar novamente, excluir ou exportar CSV.

Se for uma faixa de entrada (ex.: 4178–4181), o parser informa ambiguidade e exige uma escolha consciente do preço. Stop e TP na direção errada são rejeitados. O horário original não é criado automaticamente.

## Como é feita a comparação
- Utiliza o estado de leitura **somente leitura** de `Vortex83Bridge` e o plano Turbo de `Vortex83Turbo.current()`.
- **Sem candle OHLC real, fechado e recente, nenhuma confluência é liberada**. Preço spot de referência não vira candle e não substitui entrada.
- Direções são consideradas apenas quando a avaliação do motor está apta; cenários `EVITAR`/bloqueados não contam como confirmação.
- A confluência é degradada se horário de origem ausente/antigo, se o preço ultrapassou nível ou está mais de 0,65R longe da entrada, ou se TP1 tiver R/R abaixo de 1:1,2.
- A comparação de nota do Turbo `/100` **não é probabilidade estatisticamente calibrada de sucesso**, e a concordância de dois modelos correlacionados não garante resultado.

## Dados, segurança e deploy
- Registros ficam somente no **localStorage do navegador** atual; limpar dados do navegador os apaga. Não há armazenamento remoto, credenciais do Hub nem sincronização entre computadores.
- Não é uma recomendação operacional automática; cada pessoa deve conferir origem, cotação executável, spread, risco e horários.
- O ZIP da release 11.7 contém o projeto-fonte completo, com Netlify Functions, testes e arquivos estáticos. Para manter Functions e o agendamento do monitor, usar implantação do **repositório GitHub no Netlify**, não apenas drag-and-drop estático.
- Executar `npm test` e `node --check storm-traders-v117.js` antes de publicar.

## O que ainda não existe
Feed automático autorizado do Global Traders Hub; acompanhamento em tempo real de operações de terceiros; ranking próprio dos “melhores do mundo”; certificação independente das operações publicadas; aumento comprovado de assertividade do ouro. Essas características exigem dados verificáveis e validação estatística fora da amostra.
