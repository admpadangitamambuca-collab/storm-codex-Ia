# Storm Códex IA — código-fonte completo e versionado

**Versão atual: v9.7 — Chuva realista e peso moderado de estrutura/price action no Turbo.**

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
- A simulação Copy Trade opera com dupla pontuação: Turbo >=78 e motor original >=65, em vela fechada válida.
- Quatro ativos monitorados com gráfico individual selecionável: XAUUSD, EURUSD, USDJPY e AUDUSD.
- Banca inicial fictícia de US$100, atualizada por takes e stops encerrados de operações prospectivas.
- Sem ordens reais ou integração com corretora. Nenhuma promessa de lucro, probabilidade estatística ou acurácia validada.
- Feed público e navegador aberto necessários para registrar operações. Observações locais não migram automaticamente entre dispositivos.
- Preservar as versões anteriores na árvore GitHub; criar novas versões sem sobrescrever backups.

## Validação efetuada (v9.6)

Compilação de sintaxe dos scripts; verificação de não modificação dos 20 scripts originais e testes isolados da regra de dupla confirmação, incluindo limites 78 e 65, e evolução da banca. Navegador real e feed Biquote ao vivo não foram validados na entrega.
