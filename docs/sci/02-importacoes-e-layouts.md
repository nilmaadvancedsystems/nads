# As importações do SCI, uma por uma, com o layout e um exemplo

Todos os exemplos são **fictícios**: empresa `11.222.333/0001-81`, fornecedor `44.555.666/0001-99`, contas e valores
inventados. Os campos são resumidos dos manuais da SCI, sem copiar o texto. A fonte de cada um está indicada.

Resumo do que importa para o nads:

| # | Importação | Formato | Caminho no SCI | Prioridade para o nads |
|---|---|---|---|---|
| A | Lançamentos contábeis | TXT, vírgula, 130 campos | Integrações › Importações › Lançamentos contábeis via arquivo TXT | Reserva (para o SBS) |
| B | Lançamentos pela API do SBS | o mesmo TXT, por HTTPS | Integrações › Importações › Lançamentos contábeis via SBS | Só se contratar o SBS (**pago à parte**) |
| C | Lançamentos por planilha | .xlsx + gerador | Integrações › Importações › Lançamentos contábeis via planilha | **Alta: é o coração** (decisão do dono, 23/11/2026) |
| D | Plano de contas | TXT/CSV + gerador | Integrações › Gerador de importações › Contas contábeis | Implantação |
| E | Saldos iniciais | ECD (I155) ou lançamentos | Integrações › Importações › Sped ECD › Saldos | Implantação |
| F | Históricos padrão | sem importador no Único (a confirmar) | Planos › Históricos contábeis | Implantação |
| G | Centro de custo | rateio dentro do TXT (A); Anexo 67 para notas | — | Baixa (o escritório não usa hoje) |
| H | Extrato bancário | OFX/OFC; TXT/CSV com gerador | Integrações › Importações › Extratos bancários | Média (conciliação) |
| I | Notas fiscais | XML; Integra NET (API); TXT Anexos 04/09 | Integrações › Importações › Documentos fiscais | Depende do Fiscal ir para o SCI |
| J | Duplicatas e baixas | TXT, vírgula, Anexo 31 | Fiscal | Depende do Fiscal |
| K | Folha | contabilização on-line (Folha SCI) ou TXT (A) | — | Depende do DP |
| L | Patrimônio (bens) | TXT pipe, Latin-1, blocos 00/10/20/30/40 | Integrações › Importação de bem | Baixa |
| M | LCDPR | registro `LCPR` abaixo do lançamento (A) | — | Média (só os produtores) |
| N | Filiais | `EMPRESA<CNPJ>` na linha (A) | — | Junto com A |
| O | Conciliação | campos 126 a 129 do TXT (A) ou Central de conciliação | — | Baixa |
| P | Fechamento | bloqueio de lançamentos; zeramento | Configurações › Bloqueios; Processos | Só conferência |
| Q | Balancete (volta para o nads) | CSV com cabeçalho; BI Connection; Report | Relatórios › Balancete | **Alta**: fecha o ciclo |
| R | Exclusão em lote | filtro + "Excluir todos os registros filtrados" | Consulta de lançamentos | Só conferência |

---

## A. Lançamentos contábeis: TXT no leiaute padrão do Único

Fonte: manual "Leiaute de Importação TXT Único módulo contábil", versão de 02/04/2024
(`s1991.com.br/arquivo/manuais/ucontabil/Leiaute_de_Importacao_TXT_Unico_modulo_contabil.pdf`, a mesma cópia está no
portal da SCI). FAQ 6621, 6685, 6154, 5934, 6775, 4256 e 4555.

**Regras do arquivo**
- Um lançamento por linha, campos **separados por vírgula**, números com **ponto** decimal (`1500.00`).
- Sem aspas nos exemplos do manual, por isso **o complemento não pode ter vírgula** (o nads troca por espaço). A
  confirmar: o SCI aceita aspas?
- O manual não diz a **codificação** nem o fim de linha. Proposta: Windows-1252 com CRLF, como o manual de bens e o
  CSV do Alterdata. **A confirmar** numa importação de teste.
- Os campos 001 a 007 são obrigatórios. Os outros podem ir vazios.
- Na importação, informar a empresa e as datas inicial e final. O gerador fica vazio; o plano de troca é opcional
  (FAQ 6621).

**Os campos** (T = tipo: A alfanumérico, I inteiro, N numérico; Tam = tamanho)

| Campo | Obrig. | T | Tam | Conteúdo | Exemplo |
|---|---|---|---|---|---|
| 001 | Sim | I | 6 | Sequência | `000001` |
| 002 | Sim | A | 8 | Data AAAAMMDD | `20261105` |
| 003 | Sim | A | 8 | Conta a débito (código curto do SCI) | `2950` |
| 004 | Sim | A | 8 | Conta a crédito | `1201` |
| 005 | Sim | N | 15,2 | Valor | `1500.00` |
| 006 | Sim | A | 8 | Código do histórico | `116` |
| 007 | Sim | A | 200 | Complemento do histórico (pode ser extenso, FAQ 5934) | `PAGTO NF 123` |
| 008 | Não | A | 15 | Documento, **com o prefixo `DCTO`** (nota 4) | `DCTO123` |
| 009 | Não | A | 10 | Lote | `NADS2611` |
| 010 a 117 | Não | | | 36 rateios de centro de custo, em trios: lado `D`/`C` (A1), centro de custo (A8), valor (N15,2) | `D,60,1000.00` |
| 118 | Sim* | A | 20 | CNPJ/CPF do participante a débito (com ou sem máscara; vazio se a conta não for de participante) | `44555666000199` |
| 119 | Sim* | A | 20 | CNPJ/CPF do participante a crédito (não pode ser igual ao do débito) | |
| 120 a 122 | Não | | | Trio de rateio de CC "NN": para quando os 36 acabarem | |
| 123 | Não | A | 20 | Empresa que recebe: `EMPRESA` + CNPJ/CPF (matriz ou filial; FAQ 6775) | `EMPRESA11222333000181` |
| 124 | Não | A | 1 | Contabilização: `A` ambas, `F` fiscal, `S` societária | `A` |
| 125 | Não | A | 8 | Transação SPED, com prefixo `TR` | `TR123456` |
| 126 | Não | A | 5 | Conciliação: `CONC1` débito, `CONC2` crédito, `CONC3` os dois | |
| 127 | Não | A | 4 | Pendência: `PEN1`, `PEN2`, `PEN3` (CONC1 só com PEN2; CONC2 só com PEN1; CONC3 sem PEN) | |
| 128/129 | Não | A | 200 | Observação da pendência, com prefixo `OBSD` / `OBSC` | |
| 130 | Não | A | 16 | Data extemporânea, com prefixo `DATEXT` (`DATEXT20261231` ou `DATEXT31/12/2026`) | |

\* O manual marca 118/119 como "Sim", mas a nota diz que ficam vazios quando a conta não é de participante.

**Registros extras**, cada um na linha **logo abaixo** do lançamento a que pertence (o `NE` sempre por último):
- `LCPR`: dados do LCDPR. Campos: código do imóvel, tipo de documento (0 NF, 1 fatura, 2 recibo, 3 contrato, 4
  folha, 5 outros), tipo de lançamento (0 receita, 1 despesa de custeio/investimento, 2 receita de adiantamento), tipo
  de conta (0 banco, 1 espécie, 2 em trânsito), código bancário, tipo de participante (0 participante, 1 CPF do
  produtor, 2 CPF/CNPJ manual), participante, CPF/CNPJ manual, operação (0 entrada, 1 saída), e mais quatro campos de
  transferência entre contas do produtor.
- `INCORP`: empreendimento e unidade imobiliária a débito e a crédito (incorporadoras; não se aplica ao escritório).
- `NE`: nota explicativa (até 32.700 letras).

**Exemplo fictício**: pagamento de um fornecedor pelo banco, com participante na conta de fornecedores (2101) e lote
`NADS2611`. As duas linhas têm os 130 campos (a conta da vírgula foi feita por programa):

```
000001,20261105,2950,1201,1500.00,116,PAGTO NF 123 FORNECEDOR EXEMPLO LTDA,DCTO123,NADS2611,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,EMPRESA11222333000181,A,,,,,,
000002,20261110,2101,1201,830.40,116,PAGTO NF 456,DCTO456,NADS2611,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,44555666000199,,,,,EMPRESA11222333000181,A,,,,,,
```

Nos próximos exemplos, `...` quer dizer "os campos vazios do meio, até completar os 130", só para caber na página.

Com LCDPR (produtor rural), a linha `LCPR` vem logo abaixo do lançamento:

```
000003,20261115,3110,1201,2400.00,200,COMPRA DE RACAO NF 789,DCTO789,NADS2611,...,EMPRESA12345678909,A,,,,,,
LCPR,1,0,1,0,1,0,44555666000199,,1,,,,
```

> **Ponto a validar antes de tudo.** O exemplo do próprio manual é curto:
> `00001,20190120,1201,78,36000.00,10,Compra em 11/12,DCTO12345,lote,,A,TR1,,,,`. Nele, `A` e `TR1` aparecem logo
> depois do lote, e não nas posições 124 e 125. Talvez o SCI reconheça os campos com prefixo (`DCTO`, `EMPRESA`, `TR`,
> `CONC`, `PEN`, `OBSD`, `OBSC`, `DATEXT`) em qualquer posição. A **fase 1** importa um arquivo de teste nos dois
> formatos (130 campos e curto) numa empresa de teste e fica com o que o SCI aceitar.

**Como o SCI mostra e corrige**: a grade de importação permite trocar de uma vez as contas e os participantes vazios
(FAQ 6685), vincular notas para baixar duplicatas (FAQ 4256, 6154) e editar o complemento longo (FAQ 5934). As
inconsistências mais comuns: participante não informado, conta não cadastrada, CNPJ da empresa diferente (FAQ 6775).

---

## B. Envio pela API do SBS (sem arquivo na mão)

Fonte: Portal do Desenvolvedor da SCI, OpenAPI `portal-dev.sci.com.br/openapi/sbs.json` (atualizado em 23/11/2026).
FAQ 5045, 3475, 5076, 5071, 5107, 42310, 8924.

- **Endereço**: `POST https://api-sbs.sci.com.br/api/v1/lancamentos-contabeis` (multipart/form-data).
- **Cabeçalhos**: `Service-Token: <token de parceiro>` e `Authorization: Bearer <token de cliente>`. O JWT da API de
  autenticação **não** vale aqui.
  - O **token de parceiro** é emitido pela SCI depois do cadastro de integrador, no formulário
    `visual.sci10.com.br/sistemas-de-gestao/`. Quando o próprio escritório desenvolve, ele se cadastra como
    desenvolvedor (FAQ 8924).
  - O **token de cliente** é gerado no SCI WEB (menu do usuário › *Gerar token API*). Com escopo *contabilidade*, o
    usuário Diretor ou TI pode mandar para qualquer empresa do escritório. O token aparece **uma vez só** e não expira.
- **Corpo**:
  - `anexo`: o TXT do item A;
  - `documento`: o CNPJ da empresa;
  - `data_inicial` e `data_final` no formato AAAA-MM-DD (a inicial tem de ser menor que a final);
  - `cliente_id`: só para chamadas do próprio SCI WEB.
- **Nome do arquivo**: `CL` + CNPJ (só números) + `AAAAMMDDHHMMSS` + `.txt`. Exemplo: `CL1122233300018120261123143000.txt`.
- **Respostas**:
  - **200**: criado, ou atualizado se já havia arquivo da mesma empresa e período ainda "novo";
  - **400**: falta campo, nome fora do padrão ou datas trocadas;
  - **401**: empresa não cadastrada no SCI WEB ou token inválido;
  - **422**: período já importado;
  - **500**: erro.
- **No SCI**: o arquivo fica com status *novo* até alguém importar em *Integrações › Importações › Lançamentos
  contábeis via SBS* (escolhe a empresa, seleciona o arquivo, F12). Depois fica *integrado*. O SChIp pode importar
  sozinho por agendamento (FAQ 3475). Há opção de gerar as transações SPED no fim e de selecionar filiais.
- **Custo**: a API vem junto com o módulo SBS (FAQ 8924), e **o SBS é pago à parte**. O escritório não tem o SBS hoje
  (o dono confirmou em 23/11/2026). Enquanto não contratar, vale o item A com importação manual, ou um robô do nads
  operando a tela do SCI (doc 05, fase 3).

Exemplo de chamada (fictícia):

```
curl -X POST https://api-sbs.sci.com.br/api/v1/lancamentos-contabeis \
  -H "Service-Token: $TOKEN_PARCEIRO" -H "Authorization: Bearer $TOKEN_CLIENTE" \
  -F "anexo=@CL1122233300018120261123143000.txt" -F "documento=11222333000181" \
  -F "data_inicial=2026-11-01" -F "data_final=2026-11-30"
```

---

## C. Lançamentos por planilha (.xlsx + gerador): **o formato escolhido**

O dono decidiu em 23/11/2026: o nads manda **planilha**, porque é melhor para analisar antes e depois de importar.
FAQ 3202, 3203, 32459, 5460, 5028, 7878, 6766, 4893, 42261, 4257 e 4569.

**Como o SCI lê a planilha**
- Primeiro alguém cria, **uma vez**, um **gerador** em *Integrações › Gerador de importações › Lançamentos contábeis a
  partir de planilha eletrônica*. O gerador tem:
  - *linha inicial*: 2, se a planilha tiver título;
  - *total de linhas a descartar no fim*: 1, se tiver linha de total;
  - um arquivo de exemplo: ele mostra as 10 primeiras linhas, e a pessoa clica em cada coluna para dizer o que ela é
    (FAQ 3202).
- Depois, em *Integrações › Importações › Lançamentos contábeis via planilha*: datas, gerador, plano de troca
  (opcional) e arquivo. Os lançamentos vão para a grade e entram com F12. O gerador é **obrigatório** na planilha
  (FAQ 3203).
- Vale **as mesmas regras do TXT**: participante na conta de participante, conta existente, empreendimento e produtor
  só nas contas marcadas (FAQ 3203).
- Uma conta por coluna. Para várias contas de débito e crédito, use várias colunas (FAQ 32459).
- **CNPJ da empresa**: a coluna marcada como "CNPJ da filial" faz o SCI recusar a linha se o CNPJ não for da matriz ou
  de uma filial (FAQ 6766).
- **Produtor rural (LCDPR)**: há 12 opções de coluna próprias, as mesmas do registro `LCPR`. São elas: código do
  imóvel, tipo de documento, tipo de lançamento, tipo de conta, código bancário, tipo de participante, participante,
  CPF/CNPJ, tipo de operação e os três de transferência (FAQ 4893).
- **Juros, multa, desconto e outros valores**: por preparação (contas fixas por plano de contabilização) ou pelos
  *valores adicionais 1 a 5*. Cada um tem colunas de conta D, conta C, valor D, valor C, histórico e
  pagamento/recebimento. Nessas colunas **a conta pode ir por código curto, classificação, nome ou apelido** (FAQ 5028,
  7878). Se as colunas principais de débito e crédito também aceitarem a classificação, o de/para fica bem mais fácil.
  **A confirmar** na fase 0.
- Colunas "Constar na" (DLPA, DMPL, DFC, DVA...) com `S`/`Sim` (FAQ 42261). Não usamos.
- Na grade dá para vincular notas e baixar duplicatas (FAQ 4257).
- O que não entrar volta em `naoimportados_<nome>.xlsx`, na mesma pasta, para corrigir e importar de novo (FAQ 5460).

**Conferido no SCI em 23/11/2026** (gerador `nads`, código 13; empresa de teste com 3 linhas, só a grade de
importação, ainda sem gravar):
- a **classificação** (ex.: `04.2.1.01.002`) é aceita no débito e no crédito e vira o código curto. Então o de/para
  pode ser feito pela classificação do plano;
- o **CNPJ do participante** é resolvido para o código do participante cadastrado;
- o **acento** do complemento sai certo;
- a **linha Total** (linha inicial 2, descartar 1) é ignorada, e as colunas **L a O sem campo** não atrapalham.
- **Gravado com F12** (as 3 linhas entraram, sem `naoimportados`; tipo "Importação", lote `NADS2611`):
  - o SCI pergunta **"Deseja comparar lançamentos a importar com lançamentos já lançados?"**. No dia a dia, a
    resposta "Sim" evita importar duas vezes a mesma planilha;
  - depois ele avisa "Importação de dados concluída!" e gera as transações SPED sozinho;
  - **o texto do histórico vem antes do complemento**: com o histórico 29 ("Vendas cfe NF nº"), o lançamento ficou
    "Vendas cfe NF nº TESTE NADS 1 ...". Por isso o nads precisa de **históricos de texto neutro** (ou um histórico
    sem texto) para que o complemento fale sozinho. **A confirmar** com o escritório quais códigos usar;
  - às vezes o primeiro F12 fecha a tela sem gravar. Repetir com a grade em foco.
- Os campos que o gerador oferece:
  - Data, Débito, Crédito, Participante a débito/crédito, Valor principal, Contabilização, Histórico, Documento,
    Complemento, Lote, Conciliado, CNPJ da filial, Nota explicativa, Centro de custo a débito/crédito;
  - Incorporadoras (empreendimento e unidade, D/C);
  - Produtor rural (os 12 do LCDPR);
  - Multa, Juros e Descontos (cada um com conta D/C, histórico e valor D/C);
  - Valores adicionais 1 a 5 (os mesmos, mais pagamento e recebimento);
  - Constar na (DMPL, DLPA, DOAR, DFC, DVA, LALUR, BRE).

**A "planilha SCI" do nads** (proposta; o gerador do SCI é configurado uma vez com estas colunas)

| Col. | Título na planilha | Vai para o campo do gerador | Conteúdo |
|---|---|---|---|
| A | Data | Data | Data de verdade, mostrada DD/MM/AAAA |
| B | Débito | Conta débito | Código curto do SCI (ou a classificação, se aceita) |
| C | Crédito | Conta crédito | Idem |
| D | Valor | Valor | Número com 2 casas |
| E | Histórico | Histórico | Código do histórico padrão |
| F | Complemento | Complemento | Texto (pode ser longo, FAQ 5934) |
| G | Documento | Documento | Número da nota ou do documento |
| H | Lote | Lote | `NADS` + AAMM, ou por aplicativo (`LANC2611`, `CART2611`) |
| I | CNPJ empresa | CNPJ da filial | CNPJ da matriz ou da filial que recebe |
| J | Participante D | Participante débito | CNPJ/CPF, se a conta de débito for de participante |
| K | Participante C | Participante crédito | CNPJ/CPF, se a conta de crédito for de participante |
| L | Nome da conta D | *(sem campo: o SCI ignora)* | Só para análise |
| M | Nome da conta C | *(sem campo)* | Só para análise |
| N | Origem | *(sem campo)* | Lançatudo, Creditor, Cartões, Honorários... e a linha do extrato |
| O | Situação no nads | *(sem campo)* | conciliada, sugerida, sem regra... |

- A **linha 1** traz os títulos (linha inicial = 2). A **última linha** traz o total de débitos (descartar 1 no fim).
- **26/11/2026 (regra do Vitor):** "eu quero ele 100% pronto, não quero editar. Então remova: esse total e os dados da coluna
  lote, deixa vazia!". Desde então a aba Importar **não tem a linha Total** e a coluna **Lote vai vazia** (só o título). No
  gerador `nads` do SCI, o *total de linhas a descartar no fim* passa a ser **0**; com 1, o SCI perde o último lançamento.
- **25/11/2026:** a aba Importar ficou só com as 11 colunas do gerador (A a K), com os nomes dos campos dele (Valor principal,
  CNPJ da filial, Participante a débito/crédito). O nome das contas, a origem e o motivo ficam só na aba Conferir, que não
  vai para o SCI.
- **Produtores rurais**: um segundo gerador com as 12 colunas do LCDPR depois da coluna O. Para as outras empresas, a
  planilha é a mesma sem essas colunas.

Exemplo fictício (o que se vê no Excel):

| Data | Débito | Crédito | Valor | Histórico | Complemento | Documento | Lote | CNPJ empresa | Participante D | Participante C | Nome da conta D | Nome da conta C | Origem | Situação no nads |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05/11/2026 | 2950 | 1201 | 1.500,00 | 116 | PAGTO NF 123 FORNECEDOR EXEMPLO LTDA | 123 | LANC2611 | 11.222.333/0001-81 | | | ALUGUEL | BANCO EXEMPLO | Lançatudo | conciliada |
| 10/11/2026 | 2101 | 1201 | 830,40 | 116 | PAGTO NF 456 | 456 | LANC2611 | 11.222.333/0001-81 | 44.555.666/0001-99 | | FORNECEDORES | BANCO EXEMPLO | Lançatudo | conciliada |
| 30/11/2026 | 1201 | 3301 | 12,35 | 117 | RENDIMENTO APLICACAO | | LANC2611 | 11.222.333/0001-81 | | | BANCO EXEMPLO | RECEITAS FINANCEIRAS | Lançatudo | sugerida |

---

## D. Plano de contas

FAQ 3280, 5377, 7536 e 7867. Manual Anexo 32 (o formato antigo, só para referência).
- No Único: *Integrações › Gerador de importações › Contas contábeis*. A pessoa monta o gerador dizendo a posição de
  cada campo. Exemplo do FAQ (separado por `;`): `0;0;1.1.4.1.0090;ADIANTAMENTO 13 SALARIO`.
- O Anexo 32 (antigo) mostra os campos que o SCI guarda: plano, código curto, apelido, classificação, nome, tipo A/T,
  relatório (0 DRE, 1 balanço), rateio S/N, conciliação automática S/N, obrigatória S/N, data de cadastro, inativa
  desde, grupo SPED (1 ativo, 2 passivo, 3 PL, 4 resultado, 5 compensação, 6 outras) e conta referencial.
- **O que o nads geraria** (CSV `;`, Windows-1252), a partir do plano do Cadastro (`cadastro/{id}/plano/atual`):

```
CODIGO;CLASSIFICACAO;APELIDO;NOME;TIPO;GRUPO
1;1;;ATIVO;T;1
5;1.1.1.01;CAIXA;CAIXA GERAL;A;1
1201;1.1.1.02.001;BANCOEX;BANCO EXEMPLO S.A.;A;1
2101;2.1.1.01;FORNEC;FORNECEDORES;A;2
```

- **Decisão grande**: um plano **padrão do escritório** para todas as empresas, como o SCI favorece (plano de
  contabilização compartilhado), ou um plano por empresa, como no Alterdata. Ver as perguntas no `05`.

---

## E. Saldos iniciais

FAQ 42866, 42865, 42837, 42322, 4873 e 5377.
- **Pela ECD** (o melhor caminho): *Integrações › Importações › Sped ECD › Saldos*. Lê o **I155**.
  - "Com zeramento": só ativo, passivo e PL, numa data escolhida.
  - "Troca de contador, sem zeramento": exige fazer o encerramento depois.
  - Precisa de uma **preparação de transferência de saldos (I157)**, um de/para das contas antigas para as novas. Ela
    deve incluir até as contas que zeraram no ano.
- **Por lançamentos**: um lançamento por conta no **último dia do mês anterior**, pela natureza (FAQ 4873). Pelo TXT,
  isso exige uma contrapartida (conta transitória de implantação). Se o TXT aceita uma partida só, **a confirmar**.
- **O que o nads geraria**: o de/para das contas (Alterdata → SCI) em planilha, para a preparação I157. Ou então o
  TXT de implantação a partir do **balancete do Alterdata** que o robô já tira.

Exemplo (TXT de implantação, contrapartida na conta transitória fictícia 9999):

```
000001,20251231,5,9999,12345.67,900,SALDO INICIAL CAIXA,,IMPLANT,...,EMPRESA11222333000181,A,,,,,,
000002,20251231,9999,2101,8000.00,900,SALDO INICIAL FORNECEDORES,,IMPLANT,...,EMPRESA11222333000181,A,,,,,,
```

---

## F. Históricos padrão

FAQ 7537, 8193, 6466 e 8204. Manual Anexo 34 (antigo).
- No Único, o plano de históricos é cadastrado à mão ou copiado de outro plano. O FAQ não mostra importação. O Anexo 34
  (antigo) era `código,"descrição",operação`, por exemplo `123,"Pagamento combustível",0`. **A confirmar** com a SCI se
  o Único aceita algo assim.
- Variáveis no texto (ex.: `*M` = MM/AAAA do lançamento) evitam repetir o mês no complemento (FAQ 6466).
- **O que o nads faz**: uma lista pequena e fixa de históricos do escritório (ex.: 116 pagamento, 117 recebimento,
  200 compra, 900 implantação), cadastrada **uma vez** no plano de históricos do SCI. O texto variável vai no
  complemento (campo 007).

---

## G. Centro de custo

FAQ 42648, 6301, 4569, 4568 e 6424. Manual Anexo 67.
- Nos lançamentos, o rateio vai no próprio TXT (campos 010 a 117). Exemplo de rateio a débito em dois CC:
  `...,NADS2611,D,60,1000.00,D,70,500.00,...`
- Nas notas fiscais (Fiscal), o Anexo 67 usa um TXT separado por **pipe**:
  `|CCUSTO_SCI|tipo|CNPJ participante|IE|nº doc|AAAAMMDD|série|espécie|modelo|natureza|tipo doc|conta D|conta C|seq|nome CC|%|CNPJ empresa|D/C/A|`.
- Hoje o escritório não usa centro de custo. **Baixa prioridade.**

---

## H. Extrato bancário

FAQ 4929, 6349, 4891, 42637, 5502, 4759, 4756, 7405, 7544 e 8900.
- *Integrações › Importações › Extratos bancários*: informa a conta do banco e a data e escolhe o arquivo, **OFX/OFC de
  preferência**. Para TXT ou CSV é preciso um gerador (*Integrações › Gerador de importações › Extratos bancários*:
  delimitador, linha inicial, colunas e campo D/C).
- As **preparações** (histórico do banco → conta) fazem o papel das regras do Lançatudo. O botão *Conciliação* marca o
  que já está lançado e importa só o resto (FAQ 7405).
- O SCI confere se o extrato é da conta corrente cadastrada (FAQ 4891).
- **Para o nads**: como o nads já faz a contabilização do extrato no Lançatudo, o caminho principal é o item A/B
  (lançamentos prontos). O OFX só seria útil para quem quiser usar a conciliação do SCI. O nads lê o PDF e pode
  **escrever um OFX** com o mesmo conteúdo:

```
OFXHEADER:100
DATA:OFXSGML
VERSION:102
ENCODING:USASCII
CHARSET:1252
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL
<BANKACCTFROM><BANKID>999<ACCTID>12345-6</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261101<DTEND>20261130
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105<TRNAMT>-1500.00<FITID>20261105-1<CHECKNUM>123<MEMO>PIX ENVIADO FORNECEDOR EXEMPLO</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>10500.00<DTASOF>20261130</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>
```

---

## I. Notas fiscais (Fiscal do SCI)

FAQ 3567, 6826, 4884, 7470, 42803, 6542, 3604 e 9577. API Integra NET. Manuais Anexos 04 e 09.
- **XML**: *Integrações › Importações › Documentos fiscais › NF-e (XML)*, NFC-e, CT-e e NFS-e. Pode pegar a pasta com
  subpastas e importar Entradas, Saídas ou Ambos.
- **Em segundo plano**: o botão *Importar pela automação por pasta* importa empresa por empresa, sem montar a grade e
  sem licença do Integra NET (FAQ 6826). Se o robô do nads gravar os XML do SIEG numa pasta que o SCI enxergue, o SCI
  importa sozinho.
- **API Integra NET**: `POST /{tipoDocumento}` (nfe, cte, nfse, nfce, cfe, txt, sintegra, sped, cat52) com
  `nomeArquivo[]` e `cnpj`. A resposta traz URLs S3 pré-assinadas para mandar cada XML por `PUT`. Os documentos ficam
  disponíveis para o Fiscal importar. Exige o módulo Integra NET contratado.
- **TXT** (quando não há XML): Anexo 09 (entradas) e Anexo 04 (saídas), separados por vírgula, alfanuméricos entre
  aspas. Começo de uma entrada: `000001,"44555666000199","MG","20261105","20261105",123,"NF","1","1102000",1000.00,...`.
- **Contabilização**: o SCI contabiliza as notas no Contábil pelo plano de contabilização (CFOP → contas). Não é o nads
  que gera esses lançamentos.

---

## J. Duplicatas e baixas (Fiscal)

Manual Anexo 31 (30/01/2026). FAQ 4341.
- Vírgula; alfanuméricos entre aspas; números com ponto. O mesmo layout serve para **provisão** e **pagamento**.
- Para casar com a nota, os campos 3, 5, 6, 7, 8, 9, 10 e 11 têm de bater com o lançamento da nota.
- Os 34 campos:
  - 1 parcela;
  - 2 tipo: `E`/`S`/`R`/`D` para provisão, `PE`/`PS`/`PR`/`PD` para pagamento;
  - 3 CNPJ e 4 IE;
  - 5 e 6 nota inicial e final;
  - 7 data da nota;
  - 8 UF, 9 série, 10 espécie e 11 modelo;
  - 12 natureza;
  - 13 e 14 contas D/C e 15 histórico (só no pagamento);
  - 16 valor;
  - 17 vencimento, 18 pagamento e 19 cheque;
  - 20 duplicata, 21 promissória e 22 recibo;
  - 23 a 30 retenções (PIS, COFINS, CSLL, IR, INSS, ISS, Funrural, Sest/Senat);
  - 31 tipo de baixa (P, D, J, M, O);
  - 32 ordem;
  - 33 emissão;
  - 34 observação.
- Exemplo (pagamento fictício de uma NF-e de entrada):
  `1,"PE","44.555.666/0001-99",0,123,123,"20261105","MG","1","NFe","55","1102000","2101","1201","116",1500.00,"","20261110","","","","",0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,"P",0,"20261104","PAGO VIA PIX"`
- Só faz sentido se o **Fiscal** estiver no SCI. Senão, a baixa vai como lançamento comum (item A).

---

## K. Folha (integração do DP)

FAQ 5051, 4318, 4296, 9630, 42857 e 4999.
- Se o DP estiver no SCI, o cálculo contabiliza **on-line** no Contábil, verba a verba, pelo plano de contabilização.
  Não há arquivo.
- Se o DP continuar fora do SCI, a folha vira **lançamentos no TXT do item A**: salários, INSS, FGTS, IRRF, líquido e
  provisões. O nads já lê os holerites (rubricas, bases e líquido) dos PDFs do DP. Exemplo:

```
000010,20261130,4101,2105,25000.00,300,SALARIOS 11/2026,,FOLHA2611,...,EMPRESA11222333000181,A,,,,,,
000011,20261130,2105,2106,2750.00,301,INSS RETIDO 11/2026,,FOLHA2611,...,EMPRESA11222333000181,A,,,,,,
```

---

## L. Patrimônio (bens)

Manual "Importação de bens do patrimônio – Único Patrimônio" (versão 03). FAQ 3376, 4686 e 3345.
- TXT **separado por pipe**, **ISO-8859-1 (Latin-1)**, vírgula decimal sem milhar, data DD/MM/AAAA. Registros em níveis:
  - `00` empresa: CNPJ, nome, versão `03`;
  - `10` bem: 52 campos, entre eles descrição, natureza, tipo, identificação, chapa, aquisição, valores, vida útil,
    conta curta, CNPJ do participante, índice (padrão 1) e os dados do CIAP/PIS/COFINS;
  - `20` depreciação: data, depreciação acumulada, taxa, conta, início/fim, F/S;
  - `30` baixa;
  - `40` valor residual.
- Também aceita planilha com gerador (FAQ 4686).
- Exemplo mínimo (fictício). O bloco 10 tem 52 campos e o bloco 20 tem 10. O manual não diz se a linha começa ou
  termina com `|`, nem traz um exemplo: **a confirmar**.

```
00|11222333000181|EMPRESA EXEMPLO LTDA|03
10|COMPUTADOR DESKTOP|0|0||0|CH001|10/01/2026||PAT001|0,00|4500,00|1|60||1301||44555666000199|1||1|1|N|||||||||||||||||||||||||||||
20|10/01/2026|0,00||20,00|4910|||F|
```

- O escritório não controla bens hoje. **Baixa prioridade.**

---

## M. LCDPR

Registro `LCPR` do item A. FAQ 7414, 4897 e 7588.
- Cada lançamento de produtor rural leva, na linha de baixo: imóvel, tipo de documento, tipo de lançamento, conta
  (banco, espécie ou trânsito), participante e operação.
- O Fiscal do SCI também vincula o imóvel pela IE da NF-e (FAQ 7588).
- O nads já guarda isso no LCDPR (`lcdpr/tipos.ts`: imóvel, tipoDoc, tipoLanc, CPF/CNPJ): é **só converter**.

## N. Filiais

- Cada linha leva `EMPRESA` + o CNPJ da matriz ou da filial (campo 123). O SCI confere se é da matriz ou de uma filial
  dela (FAQ 6775). A importação pelo SBS permite escolher as filiais (FAQ 5045).
- A exclusão em lote é **filial por filial** (FAQ 6297).

## O. Conciliação

- No TXT: `CONC1`/`CONC2`/`CONC3`, `PEN1..3`, `OBSD`/`OBSC` (campos 126 a 129).
- No SCI: *Processos › Central de conciliação*, com conciliação automática e pendências com observação (FAQ 4907,
  7314, 3435).
- **Para o nads**: marcar `CONC` na conta do banco nos lançamentos que vieram de extrato já conferido pelo saldo. Assim
  o razão do banco já entra conciliado. **Opcional.**

## P. Fechamento

- *Configurações › Bloqueios de lançamentos*: por módulo, rotina, período e grupo de usuários (FAQ 6908, 3350, 6386).
- O zeramento é por empresa ou pelo SChIp, em várias empresas (FAQ 8057, 3340). O arquivamento de anos antigos
  deixa o balancete mais rápido (FAQ 5853).

## Q. Balancete de volta para o nads

**O formato real, conferido em 23/11/2026** (balancete de uma empresa exportado do SCI; o nads lê com
`sci.lerBalanceteDoSci`):
- *Relatórios › Balancete*, com **"Imprimir conta: Curta" e "Longa"** marcados (sem eles não vem a classificação) e
  "Exportar CSV com cabeçalho". Depois *Exportar para… › CSV*; o nome sugerido é `Balancete.csv`.
- Windows-1252, sem BOM, CRLF, separador `;`, sem aspas, vírgula decimal e ponto no milhar.
- Linha 1: `BALANCETE DE 01/10/2026 A 31/10/2026;;;;;;`. Linha 2: `EMPRESA: 999 - NOME;CIDADE/UF -CNPJ:11.222.333/0001-81`.
  Depois duas linhas vazias, os títulos `CONTA;CLASSIFICAÇÃO;NOME DA CONTA CONTÁBIL;SALDO ANTERIOR;DÉBITO;CRÉDITO;SALDO
  ATUAL` e uma linha vazia. **CONTA** é o código curto e **CLASSIFICAÇÃO** é a longa.
- **Sem D/C**: o saldo vem com o sinal natural do grupo (1 e 4 devedores; 2 e 3 credores). Um saldo ao contrário vem
  **entre parênteses**: `(4.692,44)`. **Sem linha de totais** (a não ser que se marque "Totalizar embaixo"). Por
  padrão, só saem as contas com saldo ou movimento.
- Não há coluna dizendo se a conta é analítica: o nads deduz pela classificação (quem não tem conta abaixo).
- Ao emitir, o SCI pode avisar "Existe uma diferença contábil entre Ativo x Passivo. Deseja emitir relatório mesmo
  assim?" (acontece quando o resultado ainda não foi encerrado). É só responder Sim.

**O razão** (*Razão e livro caixa*, atalho Ctrl+A no SCI), exportado em "CSV sem quebra de página":
- vem em UTF-8 **com BOM**, diferente do balancete;
- só traz `Histórico;Valor;Saldo`, com a data numa linha própria (`05/10/2026;;`) e o valor sem sinal;
- sem chave, contrapartida, documento nem D/C, a menos que essas opções sejam marcadas na tela;
- **a última linha pode sumir** nesse modo. Por isso, para conferir, vale o balancete, ou o razão em CSV comum com
  "Totais › Conta".

- *Relatórios › Balancete* › "Exportar CSV com cabeçalho" (FAQ 5378). A linha 1 traz a data, a linha 2 traz a empresa,
  a cidade/UF e o CNPJ, e depois vêm as contas. As colunas exatas ficam **a confirmar** com um arquivo real, que o
  usuário exporta uma vez.
- O razão sai em CSV sem quebra de página (FAQ 5743).
- **BI Connection** (pago à parte): a SQL de balancete devolve código e CNPJ da empresa, classificação, tipo da conta,
  nome, saldo anterior, débitos, créditos e saldo atual (FAQ 6657). Há também a SQL do plano de contas (FAQ 6662).
- **SCI Report 24h API**: `GET /api/v1/publicados/busca` e `PUT /api/v1/publicados/visualiza` (URL do PDF), se o
  balancete for publicado ao cliente.

## R. Exclusão em lote

- Na consulta de lançamentos da empresa: filtrar e usar **"Excluir todos os registros filtrados"** (FAQ 6297).
- **Conferido em 23/11/2026**: o filtro pelo lote `NADS2611` trouxe só as 3 linhas do teste, e a exclusão funcionou
  (o mês voltou como era). Mas o SCI pede a **"Senha de segurança do processo"**, de um usuário master ou responsável
  pela equipe. Então refazer um mês sempre precisa de uma pessoa com essa senha; não dá para um robô fazer sozinho.
- Por isso o nads deve sempre preencher o **lote** (campo 009) com uma marca própria, como `NADS2611` ou `FOLHA2611`.
  Assim, para refazer um mês, basta filtrar pelo lote e excluir.
- O relatório "Contas movimentadas" mostra até os lançamentos excluídos (FAQ 4439).
