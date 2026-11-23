# O que o nads já tem e o que falta para cada arquivo do SCI

Conferido na `origin/desenvolvimento` de 23/11/2026 (commit `5322eeee`). Os caminhos partem da raiz do repositório.

## 0. O ponto de partida: tudo já converge para uma linha só

Quase toda saída contábil do nads passa por `LinhaDeImportacao`, em `packages/core/src/extratudo/creditor/arquivos/gerar.ts`.
Os campos são `data` (DD/MM/AAAA), `debito`, `credito`, `valor` (em reais), `codHistorico`, `historico` (complemento) e
`documento`. Essa linha vira hoje o .xls de 10 colunas do Alterdata (`planilhaDeImportacao`).

Quem usa essa linha:
- Creditor;
- Lançatudo (`packages/core/src/lancatudo/regras/exportacao.ts`, `lancamentoDaLinha`);
- Cartões (`extratudo/cartoes/regras/lancamentos.ts`);
- Honorários, INSS, FGTS, pró-labore e adiantamento salarial (os `use*` de `apps/web/.../tarefas/telas/executor`);
- sugestões do Extrator (`extrator/regras/lancamentosParaOSistema.ts`);
- notas "faltando" da Conferência (`conferencia/regras/lancamentosFaltando.ts`);
- Conciliadorzinho, com o mesmo layout em `conciliadorzinho/arquivos/exportar.ts`.

**Consequência:** um gerador `planilhaDoSci(linhas: LinhaDeImportacao[], ...)` no core cobre todos de uma vez. É a
planilha .xlsx do doc 02, C, escolhida pelo dono em 23/11/2026 por ser melhor para analisar. Cada tela ganha um botão
"Planilha para o SCI" ao lado do "Baixar a planilha", sem mexer na regra de cada aplicativo. A Simples Conferência do
Lançatudo (`planilhaDaConferencia`, .xlsx com nome e classificação da conta) já é meio caminho.

## 1. Arquivo por arquivo

| Arquivo do SCI | O que o nads já tem | O que falta |
|---|---|---|
| **A. TXT de lançamentos** | `LinhaDeImportacao` (data, D, C, valor, cód. histórico, complemento, documento) em todos os aplicativos acima | **Gerador do TXT** (130 campos, vírgula, AAAAMMDD, ponto decimal, `DCTO`, `EMPRESA`+CNPJ, lote), limpeza do complemento (sem vírgula, até 200), codificação Windows-1252, **CNPJ do participante** por linha e **de/para das contas** (ver D) |
| **B. API do SBS** (pago à parte) | Robôs com fila no banco (padrão `pedidosAlterdata`) e segredos no metadado da VM | Só se contratar o SBS: **robô de envio** (multipart, tokens, nome `CL...`, tratar 200/400/401/422) |
| **B'. Importar a planilha sem SBS** | O robô do Alterdata no servidor (pywinauto) já importa o .xls no Contábil (`alterdata_importar.py` + `apps/web/src/comum/importarNoAlterdata.ts`, fila `pedidosAlterdata`) | Um **roteiro igual para o SCI**: abrir *Lançamentos contábeis via planilha*, datas, gerador, arquivo, F12, e ler as inconsistências (ou a `naoimportados_`). Depende de o SCI rodar numa máquina do escritório onde o robô alcance (a confirmar) |
| **C. Planilha (o formato escolhido)** | Gerador de .xlsx (SheetJS); a Simples Conferência do Lançatudo já tem conta, classificação e nome em .xlsx | A **planilha SCI** (15 colunas do doc 02, C): título, total no fim, CNPJ da empresa, participantes, lote, origem e situação. Mais as colunas do LCDPR para os produtores e a configuração do gerador no SCI (uma vez) |
| **D. Plano de contas** | `ContaDoPlano` {codigo (reduzido do Alterdata), nome, classificacao?, grupo?, sintetica?} em `cadastro/{id}/plano/atual`. Leitura do plano do Alterdata em `empresas/cadastro/plano.ts`. O LCDPR tem plano próprio (`lcdpr/tipos.ts:23`) | Falta guardar o **código curto e o apelido do SCI** de cada conta, e o de/para Alterdata → SCI. Falta a natureza D/C e o grupo SPED (hoje o grupo é deduzido pelo nome). Falta o CSV do plano para o gerador do SCI |
| **E. Saldos iniciais** | O balancete do Alterdata pelo robô (`robo/alterdata-numeros.js`: `lerBalancete`, `lerDinamico`) e a conferência do balancete | Gerar o **TXT de implantação** do balancete, ou o **de/para I157** para importar a ECD. O robô não tira a ECD hoje (a confirmar se tira) |
| **F. Históricos** | Códigos soltos: Creditor (`creditor/regras/historicos.ts`), cheque especial, `tarefas/regras/historicosDoContabil.ts`, regras do Lançatudo e `HistoricoAprendido` do LCDPR | **Lista única de históricos padrão do escritório** (código → texto), para cadastrar uma vez no SCI e usar no campo 006 |
| **G. Centro de custo** | Nada (só o tipo `CentroDeCusto` 'CPV'/'CMV'... para sugestão de conta) | Tudo, se for usar. Hoje não precisa |
| **H. Extrato / OFX** | Leitura de PDF, OFX e OCR; conferência pelo saldo (`extratudo/extrator`) | Um **escritor de OFX** (só se quiserem a conciliação do SCI). O `Lancamento` não guarda o FITID, que pode ser gerado (data + ordem) |
| **I. Notas fiscais** | SIEG: XML no Drive e resumo `siegNotas/{codigo}_{AAAA-MM}` (`tarefas/sieg/index.ts`: chave, número, série, data, emitente/destinatário, valor, CFOP, itens) | Se o Fiscal for para o SCI: **levar os XML** a uma pasta que o SCI monitore (automação por pasta) ou à API do Integra NET. Nada de TXT de nota |
| **J. Duplicatas** | Faturas do XML (`tarefas/sieg/danfe.ts` lê `cobr/dup`; o resumo não guarda). Baixa sugerida (`extratudo/clientes/sugestaoDeBaixa.ts`) | Gerador do Anexo 31, só se o Fiscal for para o SCI |
| **K. Folha** | Holerites lidos dos PDFs do DP (`areaCliente/folhaLida.ts`: rubricas com código, provento/desconto, INSS, FGTS, IRRF, líquido), o resumo `MesDaFolha` (`areaCliente/dp.ts`) e as conferências de INSS e FGTS que já geram lançamentos | Se o DP ficar fora do SCI: a **regra de contabilização da folha** (rubrica → conta) e os lançamentos no TXT. Se o DP for para o SCI: nada a gerar, só conferir |
| **L. Patrimônio** | Só aponta notas do imobilizado pelo CFOP (`tarefas/regras/bens.ts`) | Tudo (cadastro de bens). Fica no SCI |
| **M. LCDPR** | `lcdpr/tipos.ts` `Lancamento` (contaDeved/contaCred, codHist, imovel, tipoDoc, tipoLanc, CPF/CNPJ, chave) e a planilha de 13 colunas do Alterdata (`lcdpr/planilha.ts`) | O **registro `LCPR`** abaixo de cada linha, convertendo os códigos (tipo de documento, tipo de lançamento, tipo de conta, participante e operação) |
| **N. Filiais** | Cada filial é uma empresa com código próprio | O **CNPJ** de cada empresa no `EMPRESA<CNPJ>`. O cadastro tem o retrato da Receita; usar o CNPJ de lá |
| **O. Conciliação** | Conferência pelo saldo do extrato (`ConferenciaPeloSaldo`) | Marcar `CONC1`/`CONC2` na conta do banco quando o mês do extrato bateu pelo saldo (opcional) |
| **Q. Balancete de volta** | Leitores de balancete do Alterdata e a Conferência (`conferencia/arquivos/index.ts`, tipo `Conta`) | O **leitor do CSV do balancete do SCI** (com o arquivo real para confirmar as colunas). Depois, se contratado, a consulta pelo BI Connection |
| **R. Exclusão em lote** | — | Preencher sempre o **lote** (`NADS` + AAMM, ou por aplicativo) para filtrar e excluir no SCI |

## 2. Diferenças de modelo que pedem cuidado

1. **Contas**: o Alterdata usa o código reduzido por empresa. O SCI usa código curto, apelido e classificação num plano
   que pode ser **compartilhado**. Se o plano do SCI for padrão, o de/para é **um só para o escritório**. Se for um por
   empresa, é um por empresa.
2. **Participante**: o Alterdata costuma ter uma conta por fornecedor. O SCI favorece **uma conta "Fornecedores" com
   participante (CNPJ)**, e o Auditor reclama da conta de participante sem CNPJ. O Lançatudo já aprende CNPJ → conta;
   para o SCI ele passaria a mandar a conta-mãe + o CNPJ.
3. **Histórico**: no SCI o código do histórico é obrigatório (campo 006). O nads precisa de um código para cada tipo de
   lançamento.
4. **Valores**: o Lançatudo e o Extrator guardam centavos (inteiros) e o `LinhaDeImportacao` já guarda reais. O TXT pede
   `1500.00`, sempre com duas casas e ponto.
5. **Datas**: o nads usa ISO (aaaa-mm-dd) ou DD/MM/AAAA. O TXT pede AAAAMMDD.
6. **Volume de leituras**: as leituras do banco já passam da cota. O envio ao SBS deve reaproveitar o que a tela já tem
   e gravar só o registro do envio (um documento por empresa e mês), sem ouvir coleções novas.
