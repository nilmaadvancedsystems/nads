# Cheque especial → nads

Origem: `contabil-htmls/cheque_especial.html` (805 linhas, das quais ~450 são código próprio; o resto
é o SheetJS colado). Inventário: `inventario.md` (29 funções: 20 Model, 7 ViewModel, 2 MISTAS).

O que faz: lê o relatório de **saldo diário** da conta (colunas Data e Saldo, com C/D) e gera os
lançamentos de **ajuste do saldo negativo**. Para cada dia que fecha negativo: débito na conta
banco / crédito no cheque especial. No dia seguinte do relatório, o estorno (o contrário). Se o
período termina negativo, o estorno vai para o próximo dia útil e fica marcado como **projetado**.
Não usa banco nem internet; tudo acontece no navegador.

## Telas

| Tela antiga | Rota no nads | ViewModel | View |
|---|---|---|---|
| Entrada (não existe no original) | `/cheque-especial` | `telas/entrada/useEntrada.ts` | `Entrada.tsx` (usa `<EscolherEmpresa>`) |
| Página única: Passo 1 (arquivo + contas + convenção C/D) e resultado | `/cheque-especial/<código>/ajuste/saldo-negativo` | `telas/ajuste/useAjuste.ts` | `Ajuste.tsx` + `partes/Resultado.tsx` |

Casca: barra lateral com uma seção **Ajuste** e uma página, **Saldo negativo**. Botões **Baixar .xlsx**
e **Baixar .xls (97-2003)** no canto superior direito, depois de gerar.

## Model (`packages/core/src/cheque-especial`)

| Função antiga (linha) | Vira | Tipo | Teste |
|---|---|---|---|
| `readSheet` (494) | `arquivos/lerPlanilha` → linhas | arquivo | sim |
| `normalizeHeader` (518), `findColumns` (524) | `regras/colunas.ts: acharColunas` | regra | sim |
| `excelSerialToDate` (540), `parseDateCell` (547), `dateOnly` (563) | `regras/datas.ts` (vão para `formatos` se já houver igual) | regra | sim |
| `roundCents` (565), `parseSaldoCell` (571) | `regras/saldo.ts: lerSaldo(v, inverterCD)`. O `state.invertCD` vira parâmetro | regra | sim |
| `isBusinessDay` (593), `nextBusinessDay` (597) | `regras/datas.ts: proximoDiaUtil` | regra | sim |
| `buildDailyClosingBalances` (612) | `regras/saldos.ts: saldosDeFechamento` | regra | sim |
| `buildLancamentos` (628) | `regras/lancamentos.ts: gerarLancamentos` | regra | sim |
| `dateToExcelSerial` (752), `buildLancamentosSheet` (762) | `arquivos/planilhaDeLancamentos` (4 linhas vazias + layout do sistema) | arquivo | sim |
| `fmtDateBR` (602), `fmtMoney` (607), `formatBytes` (454), `escapeHtml` (459) | `formatos` (já existem: `dataBR`/`brl`; `escapeHtml` some, o React escapa) | util | — |

Teste de paridade: as funções antigas rodam num sandbox com as mesmas planilhas e dão os mesmos
lançamentos e o mesmo arquivo, como foi feito na Conferência.

## Cortes (MISTAS)

### `renderResults` (688)
- Hoje monta os números, a tabela, o aviso de estorno projetado e os botões, tudo em HTML.
- Model: `resumoDoAjuste(resultado)` (dias analisados, dias negativos, total ajustado). ViewModel: o
  resultado no estado da tela. View: `<Stat>`, a tabela e `<Alerta>`.

### `downloadLancamentos` (781)
- Hoje gera o arquivo e força o download.
- Model: `planilhaDeLancamentos(lanc, 'xlsx' | 'xls')` devolve os bytes. View: `baixarArquivo` do
  `@nads/ui`.

## Estado global → onde vai

| Variável | Vira |
|---|---|
| `state.file`, `state.rows`, `state.parsing` | estado do `useAjuste` |
| `state.invertCD` / `fInvertCD` (padrão: marcado) | estado do `useAjuste`, passado para `lerSaldo` |
| `fBanco`, `fCheque`, `fHistorico` (padrão 92029) | estado do `useAjuste` (ver decisão 2 do `inicio.md`) |
| `dz`, `input`, `alertHost`, … (elementos da tela) | somem: viram componentes |

## Comportamentos a manter (paridade)
- Aceita .csv, .xls, .xlsx e .xlsm, e recusa outros com "Formato inválido".
- O cartão do arquivo mostra "Lendo arquivo…", depois o tamanho e as linhas, e tem a lixeira para
  remover.
- **Gerar lançamentos** só fica ativo com arquivo lido e as três contas preenchidas.
- Procura Data/Saldo nas 10 primeiras linhas. Se não achar: "Colunas não encontradas".
- Se a mesma data aparece mais de uma vez, vale a última linha dela.
- Convenção marcada por padrão: D = positivo, C = negativo. Vale para texto e para número.
- Nenhum dia negativo: mostra os números zerados e "nenhum lançamento de ajuste é necessário".
- Estorno projetado: um aviso laranja e o selo "Estorno (projetado)" na linha.
- Arquivo: 4 linhas vazias e depois `(vazio) · Débito · Crédito · Data · Valor · Histórico`, com a data
  como serial do Excel e o valor `#,##0,00`. Nome: `lancamentos_ajuste_cheque_especial.xlsx|xls`.

## Visual
Tudo com a casca e os componentes do nads. Nada do CSS, dos ícones nem das fontes do original.

## Decisões pendentes (do Vitor)
- Ver `docs/aplicativos/inicio.md`: rotas e o que a empresa faz aqui.
- Nome do arquivo baixado com o código da empresa (ex.: `lancamentos_ajuste_cheque_especial_292.xlsx`)?
  Recomendo sim.
