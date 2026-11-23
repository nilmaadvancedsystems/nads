# Proposta em fases: o nads exportando tudo pronto para o SCI

Cada fase só está **pronta** quando:
1. a regra está em `packages/core` com testes (vitest);
2. o arquivo gerado foi conferido contra o layout **e importado de verdade numa empresa de teste no SCI** (o usuário
   importa e diz o que o SCI respondeu);
3. `npm run verificar` passa.

Commit, push e publicação só com autorização. Telas novas entram primeiro no **modo desenvolvedor** (novidade `sci`).

## As regras do dono (mensagens de 23/11/2026)

1. **No SCI só entram importações.** Nada é lançado direto lá, e nenhuma tarefa é feita lá.
2. **Lá, o tratamento é só pelo balancete.** O balancete do SCI abre as contas, e dá para excluir ou alterar direto por
   ele. Exemplo do dono: fornecedor devedor porque o nads importou a mais → exclui por lá. O SCI é **conferência**.
3. **Planilha, muita planilha.** Para importar e para exportar: o SCI exporta o Contábil inteiro em planilha, e cada
   importação tem layout.
4. **Exportar todos os planos do SCI** (contas, históricos, contabilização, participantes...) e **ensinar a lógica do
   sistema** a partir deles, para aproveitar tudo.
5. **O intermediário não usa banco.** A peça nova é só um intermediário entre o nads e o SCI: arquivo entra, arquivo
   sai. Nada fica guardado no Firestore. Isso casa com a cota de leituras estourada.
   - **Leitura que fiz de "bancos"**: banco de dados.
   - Se a ideia era "não mexe com contas bancárias", a mudança é pequena: a fase 1 fica só com o que não é extrato. Ver
     a pergunta 14.

**O que isso muda no plano:**
- O intermediário vira uma **Ferramenta** do nads (`Ferramentas`, as telas que já trabalham só com arquivos). Ela:
  - **recebe** as planilhas exportadas do SCI (planos e balancete) e as linhas que o nads já tem (Lançatudo, Creditor,
    Cartões...);
  - **devolve** as planilhas de importação do SCI.
- O **de/para das contas** não é guardado no banco:
  - sai a cada vez do **plano exportado do SCI**, casando pela classificação e pelo nome;
  - o que não casar fica numa **planilha de de/para** que o escritório guarda (no Drive) e entrega à ferramenta junto.
- **O SCI roda em outro PC** (o usuário confirmou em 23/11/2026). Por isso a Ferramenta é aberta **no navegador do PC do
  SCI**: a planilha baixa ali mesmo e as exportações do SCI sobem dali mesmo, sem passar arquivo de um PC para o
  outro. Até a Ferramenta existir, os testes passam pelo Google Drive.
- O **robô que importa no SCI** (fase 3a) usaria a fila no banco, por isso **fica parado**. Quem importa é uma pessoa,
  com poucos cliques (a regra 1 já diz que só importações entram lá).
- **Nova fase 0.2**: exportar do SCI **todos os planos** e o balancete. Com eles, escrevo `06-logica-do-sci.md`: como o
  SCI liga empresa, plano de contabilização, plano de contas, históricos, participantes e contabilização. É o "ensinar a
  lógica". **Esses arquivos não entram no repositório** (têm dados de clientes); ficam fora, só o resumo da lógica entra.

## Fase 0: validar antes de programar (com o usuário, sem código no nads)

> **23/11/2026, à noite.** O SCI voltou, e outra sessão do Claude, no PC do SCI, cadastrou o gerador oficial
> **`nads` (código 13)**: linha inicial 2, descartar 1, colunas A a K como no doc 02, C, e L a O sem campo. Ela
> passou a planilha de teste na empresa 583. Na grade, o formato foi aceito inteiro: classificação, participante,
> acento e Total (detalhes no doc 02, C). **Gravou** as 3 linhas (F12) e depois **excluiu** pelo lote `NADS2611`;
> a exclusão pede a senha de master. A fase 0.1 está feita. Fica em aberto quais históricos de texto neutro usar
> (o texto do histórico vai antes do complemento).

| Passo | Quem | Resultado |
|---|---|---|
| 0.1 Cadastrar no SCI o **gerador da planilha SCI** (doc 02, C) e importar, numa empresa de teste, uma planilha de 3 linhas. Testar: conta pela classificação (além do código curto), colunas sem campo no meio (L a O), linha de total no fim, participante e acento no complemento | Eu gero a planilha e o passo a passo; você cadastra o gerador e importa | Saber exatamente o que o SCI aceita |
| 0.2 Exportar do SCI, em planilha, **todos os planos**: contas, históricos, centro de custo, troca, a configuração de contabilização e os participantes. E também **o balancete** e **o razão** de uma empresa | Você | A lógica real do SCI (doc 06), as colunas para os leitores (fases 2 e 5) e o de/para. Os arquivos ficam fora do repositório |
| 0.5 Responder as perguntas do fim deste arquivo | Você | As decisões que mudam as fases |

## Fase 1: a planilha SCI de lançamentos (o coração)

Formato escolhido pelo dono em 23/11/2026: **planilha .xlsx**, melhor para analisar.

> **Feito em 23/11/2026 (sem commit), sem o teste no SCI.** O SCI estava fora do ar, então o usuário pediu para seguir
> sem a fase 0.
> - Core: `packages/core/src/sci/`, com 10 testes:
>   - `lerPlanilhaDoNads` lê o .xls de 10 colunas que as telas já baixam;
>   - `lerDePara` lê a planilha de de/para: conta no nads, conta no SCI, nome;
>   - `lancamentosParaOSci` aponta os problemas de cada linha;
>   - `planilhaDoSci` monta as abas Importar e Conferir.
> - Tela: **Ferramentas › nads → SCI**, só no modo desenvolvedor (novidade `sci`). Nada é gravado no banco: soltam-se as
>   planilhas do nads (e o de/para, se houver), informam-se o CNPJ, o lote e o histórico padrão, e baixa-se a planilha
>   do SCI. Assim nenhuma tela existente precisou mudar.
> - **Botão direto nas telas** (23/11/2026, a pedido do usuário; só no modo desenvolvedor): o botão comum Lançamentos /
>   Baixar a planilha (`comum/BotaoImportarNoAlterdata.tsx`) ganhou **"Baixar para o SCI"**. Ele vale para Creditor,
>   Cartões, Honorários, INSS, FGTS, pró-labore, adiantamento, cheque especial, Extrator, Conferência e Lançatudo, e:
>   - usa a mesma planilha do Baixar;
>   - pede o CNPJ: o do Cadastro, com uma leitura no clique, ou o último usado neste navegador;
>   - pede o histórico das linhas sem código;
>   - põe o lote da tela (`CRED2611`, `CART2611`...) e baixa `sci_<CNPJ>_<mês>_<origem>.xlsx`.
>   Regra em `sci.planilhaDoSciDaTela`; a tela em `comum/useBaixarParaOSci.tsx`.
> - Falta: validar no SCI (fase 0.1) e os participantes (CNPJ do fornecedor), que a planilha do nads não traz.

- **Core** `packages/core/src/sci/`:
  - `planilhaDoSci(linhas, { cnpjDaEmpresa, lote, plano?, origem? })`: de `LinhaDeImportacao` para o .xlsx de 15
    colunas do doc 02, C, com a linha de títulos, a data como data de verdade, o valor com 2 casas, o nome das contas, a
    origem, a situação e a linha de total;
  - `limparComplemento` (sem quebra de linha);
  - `validarLancamentoSci`: data no período, D ≠ C, valor > 0, conta existe no plano, histórico preenchido,
    participante quando a conta pede. Linhas com problema saem marcadas na coluna Situação, em vez de sumir;
  - `nomeDaPlanilhaSci` (`sci_<código>_<origem>_<aaaa-mm>.xlsx`).
- **Testes**: um exemplo de cada aplicativo (Lançatudo, Creditor, Cartões), lendo de volta o .xlsx gerado e conferindo
  célula a célula.
- **Tela**: a **Ferramenta "nads → SCI"** junta as linhas do mês da empresa (Lançatudo, Creditor, Cartões...) e baixa
  uma planilha só, ou uma por origem. Ela não grava nada no banco. Um atalho "Planilha para o SCI" ao lado de "Baixar a
  planilha" nas telas que já existem chama a mesma regra.
- **No SCI**: o gerador é cadastrado uma vez (fase 0.1) e serve para todas as empresas.
- **O TXT** (doc 02, A) fica para depois, só se o SBS for contratado.
- **Pronto quando**: o usuário importa a planilha do mês de uma empresa de teste no SCI e o balancete do SCI bate com o
  do Alterdata nas contas tocadas.

## Fase 2: o de/para das contas e dos históricos, sem banco

> **Feito em 23/11/2026 (itens 1 e 2 da conversa, só no modo desenvolvedor), na Ferramenta nads → SCI:**
> - **De/para automático** (`sci.deParaPeloPlano`): escolhe-se o plano padrão do SCI (90113 ou 90011, que o ShadersCI
>   trouxe) e solta-se o plano da empresa exportado do Alterdata. Ele casa primeiro pela classificação (sem os zeros da
>   esquerda, com o nome parecido) e depois pelo nome. A "classificação igual, nome diferente" fica a conferir, nunca
>   automática. A planilha de de/para baixa para conferir e guardar no Drive, e a do escritório vale mais que o
>   automático. Com o plano escolhido, a planilha aponta a conta que não existe no SCI, a sintética e a que pede
>   participante.
> - **Balancete do SCI de volta** (`sci.lerBalanceteDoSci`, `saldosInvertidos`, `conferirComOBalancete`): solta-se o
>   CSV exportado do SCI e a Ferramenta mostra:
>   - as contas com o saldo contrário à natureza (fornecedor devedor, caixa credor; as redutoras ficam de fora);
>   - conta a conta, o que o nads mandou × o movimento no SCI (bate, faltou, a mais, fora do balancete).
>   **Conferido com o arquivo real** (balancete exportado pela sessão do PC do SCI, formato no doc 02, Q): CONTA =
>   código curto, saldos sem D/C com o sinal natural do grupo e parênteses quando ao contrário, Windows-1252.

- **Core** (nada é gravado no Firestore):
  - o leitor do plano de contas e do plano de históricos **exportados do SCI**;
  - `deParaDasContas(planoAlterdata, planoSci, planilhaDeDePara?)`: casa pela classificação e pelo nome, como a
    migração do SCI faz, e completa com a planilha de de/para do escritório;
  - `contaNoSci(codigoAlterdata)`;
  - a lista de **históricos padrão do escritório**.
- **Tela** (na Ferramenta): o escritório entrega o plano do SCI, vê o que casou e o que não casou, e baixa a **planilha
  de de/para** para completar e guardar no Drive.
- **Alternativa sem código**: usar o **plano de troca** do SCI (FAQ 6725) e mandar os códigos do Alterdata. Fica mais
  rápido, mas o de/para mora no SCI e o nads não confere.
- **Pronto quando**: todas as contas usadas no mês têm par no SCI, e a planilha da fase 1 sai com os códigos do SCI.

## Fase 3: importar no SCI sem ninguém mexer em arquivo

O SBS, que daria a API, é **pago à parte**, e o escritório não tem. Por isso há dois caminhos, nesta ordem:

> **Parada** pela regra 5 do dono: o intermediário não usa banco, e o robô precisaria da fila no banco. Por enquanto,
> quem importa é uma pessoa. Fica registrado aqui para quando o volume pedir.

**3a. Robô do nads no SCI (sem custo novo)**: o mesmo jeito do robô do Alterdata.
- **Robô** (servidor do escritório, pywinauto): `robo/sci_importar.py`. Ele copia a planilha para uma pasta local, abre
  *Integrações › Importações › Lançamentos contábeis via planilha*, preenche datas, gerador e arquivo, confirma (F12) e
  lê a tela de inconsistências ou a `naoimportados_`.
- **Fila**: o mesmo padrão dos pedidos do Alterdata (`importarNoAlterdata.ts` / `pedidosAlterdata`), com o tipo
  `sci-txt`.
- **Tela**: **"Mandar para o SCI"** ao lado de "Baixar para o SCI", com a situação na linha da empresa e do mês. Um
  documento por empresa e mês, sem ouvir coleção nova, por causa da cota de leituras.
- **Depende de**: o SCI rodar numa máquina onde o robô alcance (pergunta 0.3).

**3b. API do SBS (se um dia contratarem)**:
- `robo/sci-sbs.js` chama `POST api-sbs.sci.com.br/api/v1/lancamentos-contabeis` com os tokens de parceiro e de cliente
  e grava o resultado (enviado, substituído, já importado 422, erro). O SChIp importa sozinho (FAQ 3475).
- A API só aceita o **TXT** (doc 02, A), então aí entra o gerador de TXT, a partir das mesmas linhas da planilha.

- **Pronto quando**: um mês de uma empresa de teste chega no SCI sem ninguém tocar em arquivo.

## Fase 4: implantação de empresa no SCI

- **Plano de contas**: CSV do plano (doc 02, D) para o gerador *Contas contábeis* do SCI.
- **Saldos**: a planilha de implantação (mesmo gerador) a partir do **balancete do Alterdata** que o robô já tira, no último dia do mês
  anterior, com a conta transitória. Ou a planilha de de/para para a **preparação I157**, se a ECD do Alterdata for o
  caminho.
- **Pronto quando**: o balancete de abertura no SCI é igual ao do Alterdata na data de corte.

## Fase 5: o balancete do SCI de volta no nads

- **Core**: o leitor do CSV do balancete do SCI (com o arquivo da fase 0.2) para o tipo `Conta` da Conferência. Mais a
  comparação **balancete SCI × o que o nads mandou**: conta a conta, e o que ainda falta lançar.
- **Depois**, se o BI Connection for contratado: a leitura automática pela SQL de balancete (FAQ 6657), pelo robô do
  servidor.
- **Pronto quando**: a Conferência do nads funciona com o balancete do SCI do mesmo jeito que funciona com o do
  Alterdata.

## Fase 6: folha e LCDPR

- **LCDPR**: o registro `LCPR` abaixo de cada lançamento do produtor (converter `lcdpr/tipos.ts`).
- **Folha**, só se o DP continuar fora do SCI: a regra rubrica → conta, por empresa ou pelo plano padrão, e os
  lançamentos da folha na planilha SCI (salários, INSS, FGTS, IRRF, líquido, provisões), a partir dos holerites lidos.

## Fase 7: Fiscal no SCI (só se o Fiscal migrar)

- Levar os XML do SIEG para a pasta da *automação por pasta* do SCI, ou para a API do Integra NET.
- As duplicatas e baixas no Anexo 31, se o SCI for baixar as notas.
- Nesse cenário, o nads deixa de gerar os lançamentos das notas: o SCI contabiliza, e o nads só confere.

## Ordem sugerida e tamanho

| Fase | Depende de | Tamanho |
|---|---|---|
| 0 | — | pequeno (usuário) |
| 1 | 0.1 | médio |
| 2 | 0.2, perguntas 2 e 7 | médio |
| 3 | 0.3, fase 1 | médio (3a robô) |
| 4 | fases 1 e 2 | pequeno |
| 5 | 0.2 | pequeno, mais o BI depois |
| 6 | fase 1, pergunta 1 | médio |
| 7 | pergunta 1 | médio |

---

## Perguntas que só você responde

1. **Fiscal e DP**: o Fiscal e o DP também vão para o SCI, ou só o Contábil? A partir de quando? (Isso decide as fases 6
   e 7. Se forem, o SCI contabiliza notas e folha sozinho.)
2. **Plano de contas**: vai ser **um plano padrão do escritório** para todas as empresas, como o SCI favorece, ou um por
   empresa, como no Alterdata? Os **códigos curtos** do SCI vão repetir os reduzidos do Alterdata? Se repetirem, o
   de/para quase some.
3. **Contratos**: o SBS é pago à parte e o escritório não tem (respondido em 23/11/2026). E o **Integra NET** e o
   **BI Connection**: algum dos dois está contratado?
4. **Onde roda o SCI**: em que máquina o SCI do escritório roda (o NILMA-SERVER ou outra)? O robô do nads pode operar
   a tela de importação dele, como faz no Alterdata?
5. **Teste**: existe uma **empresa de teste** no SCI onde você importa os arquivos da fase 0 e de cada fase?
6. **Data de corte**: em que data cada empresa começa no SCI (ex.: saldos em 31/12/2026)? O Alterdata gera a **ECD**
   dessas empresas, ou implantamos pelo balancete?
7. **Históricos**: usamos os códigos do Alterdata ou uma lista nova e curta do escritório (ex.: 116 pagamento,
   117 recebimento...)?
8. **Fornecedores e clientes**: no SCI vai ser **uma conta com participante (CNPJ)** ou uma conta por fornecedor, como
   no Alterdata?
9. **Lote**: posso marcar tudo o que o nads manda com o lote `NADS` + AAMM (ou por aplicativo: `LANC2611`, `CART2611`,
   `FOLHA2611`) para excluir e refazer fácil?
10. **Quem importa no SCI**: o SChIp importa sozinho, num horário fixo, ou alguém clica em "importar" depois de conferir?
11. **Filiais**: há empresas com filial que lançam separado (cada CNPJ com os seus lançamentos)?
12. **Centro de custo e patrimônio**: algum cliente vai usar? Se ninguém usar, ficam fora.
13. **Balancete de volta**: basta exportar o CSV do SCI à mão uma vez por mês, ou vale contratar o BI Connection para o
    nads ler sozinho?
14. **"Não vai usar bancos"**: quer dizer **banco de dados** (o intermediário não guarda nada, só arquivo entra e
    arquivo sai)? Ou quer dizer **contas bancárias** (a parte do extrato fica fora do intermediário)?
