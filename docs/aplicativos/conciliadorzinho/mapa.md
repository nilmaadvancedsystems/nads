# Conciliadorzinho → nads

Origem: `contabil-htmls/conciliadorZINHO.html` (2.287 linhas, das quais ~1.500 são código próprio; o
resto é o SheetJS e os logos colados). Inventário: `inventario.md` (91 funções: 39 Model, 24
ViewModel, 25 View, 3 MISTAS).

O que faz: **concilia o cartão com as notas fiscais**. A pessoa escolhe as bandeiras (Cielo, Rede,
Getnet, Stone, PagBank) e manda o extrato de cada uma (colunas A = Data, B = Valor Bruto, C = Taxa),
com a conta contábil dela. Depois manda a planilha de vendas (C = Data, E = Contrapartida,
G = Valor Bruto, H = Histórico código, I = Histórico "NF-CPF/CNPJ-Nome") e informa as contas de
vendas, de taxas e de caixa. O cruzamento é por data + valor (FIFO), com as notas num monte só:
a bandeira com mais lançamentos escolhe primeiro. Saem:
- um arquivo **por bandeira**: duas linhas por transação, o bruto (com nota, histórico 15; sem nota,
  vai para o caixa com histórico 181) e a taxa (histórico 92060);
- um arquivo **de saídas por mês**, com as vendas que não bateram com nenhum cartão.

Antes de liberar os arquivos, confere os totais: bruto e taxa de cada bandeira contra o extrato, e
toda venda usada uma vez só. Não usa banco nem internet.

## Telas

O original é um passo a passo com a lista de etapas à esquerda. No nads, **as etapas viram a barra
lateral**: cada etapa é uma página, e só abre depois que a anterior foi concluída. É a mesma trava
que a Conferência já usa.

| Etapa antiga | Rota no nads (`/conciliadorzinho/<código>/conciliacao/<etapa>`) | ViewModel | View |
|---|---|---|---|
| Entrada (não existe no original) | `/conciliadorzinho` | `telas/entrada/useEntrada.ts` | `Entrada.tsx` (`<EscolherEmpresa>`) | — |
| 1 Bandeiras | `conciliacao/bandeiras` | `telas/bandeiras/useBandeiras.ts` | `Bandeiras.tsx` |
| 2…k+1 Extrato da <bandeira> (um por bandeira) | `conciliacao/extrato-<bandeira>` | `telas/extrato/useExtrato.ts` | `Extrato.tsx` + `partes/ArquivosDoExtrato.tsx` |
| Notas fiscais | `conciliacao/notas` | `telas/notas/useNotas.ts` | `Notas.tsx` |
| Contas contábeis | `conciliacao/contas` | `telas/contas/useContas.ts` | `Contas.tsx` |
| Totais (conferência) | `conciliacao/totais` | `telas/totais/useTotais.ts` | `Totais.tsx` + `partes/TotaisDoMes.tsx` |
| Conclusão (downloads + prévia) | `conciliacao/arquivos` | `telas/arquivos/useArquivos.ts` | `Arquivos.tsx` + `partes/Previa.tsx` |

**Cancelar** (com confirmação) e **Novo processo** ficam nas ações do topo. O trabalho em andamento
fica na sessão do aplicativo (em memória): trocar de etapa não perde nada, e sair ou trocar de
empresa zera, igual ao original.

## Model (`packages/core/src/conciliadorzinho`)

| Função antiga (linha) | Vira | Tipo | Teste |
|---|---|---|---|
| `parseCardStatementFile` (870) | `arquivos/lerExtrato` → transações + mês principal | arquivo | sim |
| `parseSalesFile` (923), `cleanHistorico` (906), `extractNfFromHistorico` (916) | `arquivos/lerVendas` + `regras/historico.ts` | arquivo/regra | sim |
| `parseDateFlexible` (839), `parseNumberFlexible` (855), `excelSerialToDate` (834) | `regras/leitura.ts` (vão para `formatos` se já houver igual) | regra | sim |
| `computeMonthTally` (985), `monthKey` (997), `monthLabel` (817), `monthsSlug` (1805) | `regras/meses.ts` | regra | sim |
| Checagem de meses da planilha de vendas contra os do cartão (dentro de `wireStep2`, ~1400) | `regras/meses.ts: compararMeses` → `{ extras, comuns }` | regra | sim |
| `computeBrandOrder` (1369) | `regras/conciliacao.ts: ordemDasBandeiras` | regra | sim |
| `generateMultiBrandDatasets` (1477) | `regras/conciliacao.ts: conciliar` (o coração do app) | regra | sim, com paridade |
| `validateTotals` (1640), `monthOfDateKey` (1632) | `regras/totais.ts: conferirTotais` | regra | sim |
| Conta por mês de `renderTotalsBreakdown` (1673) | `regras/totais.ts: totaisPorMes` | regra | sim |
| Linhas de `buildFinalOutputs` (1817) e `buildSaidaOutputs` (2077) | `regras/saida.ts: linhasDaBandeira`, `linhasDeSaidas` | regra | sim |
| Montagem do .xls/.csv (dentro de 1817/2077), `csvField` (827) | `arquivos/planilhas.ts` (4 linhas vazias + layout; taxa em vermelho) | arquivo | sim |
| `BRAND_META`, `BRAND_LIST` (960) | `tabelas/bandeiras.ts` (os logos vão para `packages/ui`) | tabela | — |
| `fmtBR`, `fmtBRL`, `fmtDate`, `pad2`, `fmtBytes` | `formatos` | util | — |

Teste de paridade: `conciliar`, `conferirTotais` e as linhas de saída rodam contra as funções antigas
com os mesmos extratos e vendas (mais de uma bandeira, nota disputada, venda sobrando, mês a mais).

## Cortes (MISTAS)

### `wireBrandStep` (1300)
- Hoje lê os arquivos, junta ao estado, mostra os erros por arquivo e pede confirmação num modal.
- Model: `lerExtrato`. ViewModel: `useExtrato` com `adicionarArquivos`, `remover` e `confirmar`
  (pergunta via `useRetorno().modal`). View: a zona de arquivo, os chips e os meses.

### `buildFinalOutputs` (1817)
- Hoje calcula as linhas, gera .xls/.html/.csv, preenche os números e desenha a prévia.
- Model: `linhasDaBandeira` + `planilhas`. ViewModel: `useArquivos` (resumo, abas da prévia). View:
  `<Stat>`, os cartões de download e a tabela da prévia.

### `browserDownload` (1975) / `saveWithFallback` (1986)
- Hoje tenta salvar pelo visualizador do claude.ai (com `.xls.txt`, `.html` e `.txt` de reserva) e,
  se não der, baixa direto.
- No nads, fica só o download direto com `baixarArquivo` do `@nads/ui`. As reservas existiam só por
  causa do visualizador do claude.ai, que não se aplica aqui.

## Estado global → onde vai

| Variável | Vira |
|---|---|
| `state.brands`, `brandData`, `sales`, `reconcileMonths`, `excludedMonths`, `accounts` | sessão do aplicativo (`casca/sessao.tsx`), porque várias etapas usam |
| `state.step`, `maxStep` | a rota (etapa aberta) + travas da barra lateral calculadas pela sessão |
| `state.datasets`, `leftoverSales` | resultado de `conciliar`, guardado na sessão ao concluir os totais |
| `finalOutputs`, `finalSaidaOutputs` | calculados no `useArquivos` a partir da sessão |
| `state.progress`, `progressTimer` | ver decisão 1 |
| `cardFileIdSeq` | id do arquivo dentro da sessão |
| `THEME_KEY`, `savedTheme`, `themeToggle` | somem: o tema é o do nads |

## Comportamentos a manter (paridade)
- Bandeiras: pelo menos uma para continuar. Trocar as bandeiras recomeça as etapas.
- Extrato: aceita vários arquivos (.csv/.xls/.xlsx/.xlsm), com erro por arquivo e o formato esperado.
  Mostra as competências achadas. Continua só com lançamentos e conta. Pede confirmação com o
  resumo (lançamentos, arquivos, meses, conta).
- Notas: .xls/.xlsx. Sem mês em comum com o cartão, dá erro e oferece escolher outro arquivo. Com
  meses a mais, pergunta "Prosseguir mesmo assim" e concilia só os meses em comum.
- Contas: vendas e taxas são obrigatórias, e "O caixa é 10101?" Sim/Não (no Não, pede a conta).
- Totais: se não baterem, refaz uma vez sozinho. Se ainda não baterem, mostra as diferenças e
  "Reenviar arquivos do zero". **Baixar PDF** imprime a conferência.
- Arquivos: números (aprovados, com nota, sem nota, bandeiras), a linha de paridade bruto/taxas,
  um cartão por bandeira e por mês de saídas, cada um com **.xls** e **.csv**, e a prévia por
  bandeira, com a taxa em vermelho.
- Layout do arquivo: 4 linhas vazias e depois `(vazio) · Devedora · Credora · Data · Valor ·
  Histórico · Complemento · (vazio) · (vazio) · Nota`. CSV com `;` e BOM.
- Nomes: `conciliacao-<bandeira>-<aaaa-mm>…` e `saidas-vendas-<aaaa-mm>`.

## Visual
Tudo com a casca e os componentes do nads. Os logos das bandeiras entram em `packages/ui` como
ícones. Nada do CSS, das fontes nem do stepper do original.

## Decisões pendentes (do Vitor)
1. **Barra de progresso "Conciliando…"** (etapa Contas, 0→100% com fases). É só animação: a conta
   de verdade é feita nos Totais e é instantânea. Recomendo tirar, junto com a barra falsa dos
   Totais. Manter também é possível.
2. **Etapas na barra lateral** (proposta acima), em vez de um passo a passo dentro da página.
   Recomendo.
3. Ver `docs/aplicativos/README.md`: rotas e o que a empresa faz aqui (lembrar as contas por
   empresa no banco, ou não).

## Correções aprovadas (Vitor, 2026-09-28)
Defeitos do original corrigidos no nads. Os testes de paridade comparam com o original já com essas
correções e têm um teste de "diferença de propósito" para cada uma.
- Com meses a mais nas vendas e mês do cartão sem vendas, os totais nunca batiam (beco sem saída) →
  a conferência olha o extrato e as vendas só nos meses conciliados.
- Vendas de meses fora do cartão iam para as Saídas, contra o aviso "apenas os meses em comum" →
  agora ficam de fora.
- Meses ordenados como texto (outubro antes de setembro) → ordem de calendário.
- Leitura de texto: "1.000" virava 1, "12,345" virava 12345, "31/02" virava 03/03 → milhar/decimal
  lidos certo e data que não existe é ignorada.
