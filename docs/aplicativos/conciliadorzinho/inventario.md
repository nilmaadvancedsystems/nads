# Inventário de camadas — conciliadorZINHO.html

2287 linhas · 91 funções · MISTA: 3 · Model: 39 · ViewModel: 24 · View: 25

Bibliotecas coladas no arquivo (ignoradas): linha 738 (426 KB), linha 758 (124 KB)

## Estado global (8) — vira estado dos ViewModels ou parâmetro das regras

`themeToggle` (L789) · `savedTheme` (L811) · `state` (L970) · `cardFileIdSeq` (L984) · `stepperList` (L1011) · `progressTimer` (L1564) · `finalOutputs` (L1792) · `finalSaidaOutputs` (L1793)

## Constantes e tabelas (9) — dados do domínio (packages/core) ou config da tela

`ICONS` (L763) · `THEME_KEY` (L788) · `MONTHS` (L816) · `BRAND_META` (L960) · `BRAND_LIST` (L967) · `STEPS` (L1010) · `BRAND_EXTS` (L1220) · `PHASES` (L1556) · `BLANK_ROWS` (L1796)

## MISTA — dividir antes de migrar (3)

| Função | Linha | Tam. | Sinais | Estado global (lê / muda) | Destino |
|---|---:|---:|---|---|---|
| `wireBrandStep` | 1300 | 65 | telaLe, html, eventos, retorno | state, cardFileIdSeq, getBrandTransactions() / state | dividir: evento com lógica dentro (65 linhas) |
| `buildFinalOutputs` | 1817 | 100 | arquivo, telaLe, telaEscreve, html | state, finalOutputs / finalOutputs | dividir: arquivo + tela |
| `browserDownload` | 1975 | 10 | arquivo, telaEscreve, tempo | — | dividir: arquivo + tela |

## Model (packages/core) (39)

| Função | Linha | Tam. | Sinais | Estado global (lê / muda) | Destino |
|---|---:|---:|---|---|---|
| `monthLabel` | 817 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `fmtBR` | 818 | 1 | — | — | util (packages/core/formatos) — provavelmente já existe lá |
| `fmtBRL` | 819 | 1 | — | — | util (packages/core/formatos) — provavelmente já existe lá |
| `pad2` | 820 | 1 | — | — | util (packages/core/formatos) — provavelmente já existe lá |
| `fmtDate` | 821 | 1 | — | — | util (packages/core/formatos) — provavelmente já existe lá |
| `fmtBytes` | 822 | 5 | — | — | util (packages/core/formatos) — provavelmente já existe lá |
| `csvField` | 827 | 5 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `randInt` | 832 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `excelSerialToDate` | 834 | 5 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `parseDateFlexible` | 839 | 16 | — | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `parseNumberFlexible` | 855 | 15 | — | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `parseCardStatementFile` | 870 | 36 | arquivo | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `(anônima)` | 871 | 34 | arquivo | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `(anônima) file.arrayBuffer().then` | 873 | 31 | arquivo | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `cleanHistorico` | 906 | 10 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `extractNfFromHistorico` | 916 | 7 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `parseSalesFile` | 923 | 35 | arquivo | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `(anônima)` | 927 | 30 | arquivo | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `(anônima) file.arrayBuffer().then` | 929 | 27 | arquivo | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `computeMonthTally` | 985 | 12 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `monthKey` | 997 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `totalSteps` | 1013 | 1 | — | state / — | regra — hoje lê estado global (state): passar por parâmetro |
| `stepNumFor` | 1014 | 9 | — | state / — | regra — hoje lê estado global (state): passar por parâmetro |
| `pick` | 1134 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `validExt` | 1159 | 4 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `computeBrandOrder` | 1369 | 5 | — | state, getBrandTransactions() / — | regra — hoje lê estado global (state, getBrandTransactions()): passar por parâmetro |
| `onAction` | 1440 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `generateMultiBrandDatasets` | 1477 | 77 | — | state, getBrandTransactions() / — | regra — hoje lê estado global (state, getBrandTransactions()): passar por parâmetro |
| `(anônima) state.brandOrder.forEach` | 1498 | 47 | — | getBrandTransactions() / — | regra — hoje lê estado global (getBrandTransactions()): passar por parâmetro |
| `(anônima) approved.forEach` | 1511 | 23 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `accountsValid` | 1595 | 7 | — | state / — | regra — hoje lê estado global (state): passar por parâmetro |
| `monthOfDateKey` | 1632 | 4 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `validateTotals` | 1640 | 32 | — | state, getBrandTransactions() / — | regra — hoje lê estado global (state, getBrandTransactions()): passar por parâmetro |
| `onAction` | 1761 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `escHtml` | 1802 | 3 | — | — | util (packages/core/formatos) — provavelmente já existe lá |
| `monthsSlug` | 1805 | 5 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `(anônima) state.brandOrder.forEach` | 1823 | 74 | arquivo, html | state, finalOutputs / finalOutputs | arquivo: ler/gerar (packages/core/<dominio>/arquivos) — lê estado: state, finalOutputs |
| `buildSaidaOutputs` | 2077 | 71 | arquivo, html | state, finalSaidaOutputs / finalSaidaOutputs | arquivo: ler/gerar (packages/core/<dominio>/arquivos) — lê estado: state, finalSaidaOutputs |
| `(anônima) Object.keys(byMonth).forEach` | 2086 | 59 | arquivo, html | finalSaidaOutputs / finalSaidaOutputs | arquivo: ler/gerar (packages/core/<dominio>/arquivos) — lê estado: finalSaidaOutputs |

## ViewModel (hooks) (24)

| Função | Linha | Tam. | Sinais | Estado global (lê / muda) | Destino |
|---|---:|---:|---|---|---|
| `applyTheme` | 794 | 12 | telaLe, telaEscreve, navegador | themeToggle / — | ação/estado do hook da tela (use<Tela>.ts) |
| `renderStepperList` | 1043 | 5 | telaEscreve, html | stepperList / stepperList | ação/estado do hook da tela (use<Tela>.ts) |
| `goStep` | 1082 | 10 | telaLe, telaEscreve | state / state | ação/estado do hook da tela (use<Tela>.ts) |
| `toast` | 1094 | 8 | telaLe, telaEscreve, retorno, tempo | — | ação/estado do hook da tela (use<Tela>.ts) |
| `openModal` | 1104 | 24 | telaLe, telaEscreve, eventos | — | ação/estado do hook da tela (use<Tela>.ts) |
| `(anônima)` | 1105 | 22 | telaLe, telaEscreve, eventos | — | ação/estado do hook da tela (use<Tela>.ts) |
| `wireDropzone` | 1133 | 26 | telaLe, telaEscreve, eventos | — | ação/estado do hook da tela (use<Tela>.ts) |
| `showInlineAlert` | 1163 | 10 | telaLe, telaEscreve, html, eventos | — | ação/estado do hook da tela (use<Tela>.ts) |
| `renderFileCard` | 1175 | 12 | telaLe, telaEscreve, html, eventos | — | ação/estado do hook da tela (use<Tela>.ts) |
| `renderBrandFileList` | 1265 | 22 | telaLe, telaEscreve, html, eventos | state / state | ação/estado do hook da tela (use<Tela>.ts) |
| `(anônima) …ument.getElementById('continueBrand-'+code).addEventListener('click')` | 1342 | 22 | telaLe, html, retorno | state, getBrandTransactions() / state | ação/estado do hook da tela (use<Tela>.ts) |
| `wireStep2` | 1385 | 75 | telaLe, html, retorno | state / state | ação/estado do hook da tela (use<Tela>.ts) |
| `(anônima) wireDropzone` | 1386 | 73 | html, retorno | state / state | ação/estado do hook da tela (use<Tela>.ts) |
| `(anônima) parseSalesFile(file).then` | 1394 | 64 | html, retorno | state / state | ação/estado do hook da tela (use<Tela>.ts) |
| `proceedWith` | 1416 | 12 | retorno | state / state | ação/estado do hook da tela (use<Tela>.ts) |
| `startStep3` | 1574 | 20 | telaLe, telaEscreve, tempo | state, progressTimer, checkStep3Ready() / state, progressTimer | ação/estado do hook da tela (use<Tela>.ts) |
| `runTotalsValidation` | 1717 | 50 | telaLe, telaEscreve, html, tempo | state, computeBrandOrder() / state | ação/estado do hook da tela (use<Tela>.ts) |
| `(anônima) setTimeout` | 1733 | 33 | telaLe, telaEscreve, html, tempo | state, computeBrandOrder() / state | ação/estado do hook da tela (use<Tela>.ts) |
| `(anônima) setTimeout` | 1743 | 22 | telaLe, telaEscreve, html, tempo | — | ação/estado do hook da tela (use<Tela>.ts) |
| `renderBrandTabs` | 1918 | 13 | telaLe, telaEscreve, html, eventos | state / — | ação/estado do hook da tela (use<Tela>.ts) |
| `renderBrandDownloads` | 1947 | 23 | telaLe, telaEscreve, html, eventos | state / — | ação/estado do hook da tela (use<Tela>.ts) |
| `saveWithFallback` | 1986 | 38 | telaEscreve, retorno | — | ação/estado do hook da tela (use<Tela>.ts) |
| `renderSaidaDownloads` | 2149 | 28 | telaLe, telaEscreve, html, eventos | finalSaidaOutputs / — | ação/estado do hook da tela (use<Tela>.ts) |
| `resetApp` | 2228 | 38 | telaLe, telaEscreve | progressTimer / state, finalOutputs, finalSaidaOutputs | ação/estado do hook da tela (use<Tela>.ts) |

## View (componentes) (25)

| Função | Linha | Tam. | Sinais | Estado global (lê / muda) | Destino |
|---|---:|---:|---|---|---|
| `svg` | 779 | 3 | html | — | template → JSX |
| `getAllBrandTransactions` | 998 | 7 | telaLe | state / — | componente (.tsx) |
| `rebuildSteps` | 1023 | 20 | telaLe, telaEscreve | state, renderStepperList(), totalSteps() / — | componente (.tsx) |
| `renderStepper` | 1059 | 10 | telaLe, telaEscreve | state / — | componente (.tsx) |
| `renderTopbarMeta` | 1070 | 11 | telaLe, telaEscreve, html | — | componente (.tsx) |
| `clearInlineAlert` | 1173 | 1 | telaLe, telaEscreve | — | componente (.tsx) |
| `selectedBrandCodes` | 1198 | 3 | telaLe | — | componente (.tsx) |
| `buildBrandStepSections` | 1222 | 37 | telaLe, telaEscreve, html | state, totalSteps() / — | componente (.tsx) |
| `(anônima) state.brands.map` | 1224 | 29 | html | state, totalSteps() / — | template → JSX |
| `getBrandTransactions` | 1260 | 5 | telaLe | state / — | componente (.tsx) |
| `renderBrandMonthsSummary` | 1287 | 8 | telaLe, telaEscreve, html | getBrandTransactions() / — | componente (.tsx) |
| `checkBrandContinue` | 1295 | 5 | telaLe | getBrandTransactions() / — | componente (.tsx) |
| `(anônima) wireDropzone` | 1301 | 34 | telaLe, html | state, cardFileIdSeq / — | componente (.tsx) |
| `(anônima) Promise.all(tasks).then` | 1311 | 23 | telaLe, html | state, cardFileIdSeq / — | componente (.tsx) |
| `resetStep2Zone` | 1376 | 9 | telaLe, telaEscreve, html | — | componente (.tsx) |
| `renderProgressLog` | 1566 | 7 | telaLe, telaEscreve, html | — | componente (.tsx) |
| `checkStep3Ready` | 1602 | 5 | telaLe | state / — | componente (.tsx) |
| `renderTotalsBreakdown` | 1673 | 43 | telaLe, telaEscreve, html | state / — | componente (.tsx) |
| `(anônima) keys.map` | 1685 | 30 | html | state / — | template → JSX |
| `stat` | 1810 | 3 | html | — | template → JSX |
| `renderPreviewForBrand` | 1931 | 15 | telaLe, telaEscreve, html | finalOutputs / — | componente (.tsx) |
| `downloadBrandXls` | 2025 | 29 | telaLe | finalOutputs / — | componente (.tsx) |
| `downloadBrandCsv` | 2055 | 20 | telaLe | finalOutputs / — | componente (.tsx) |
| `downloadSaidaXls` | 2178 | 25 | telaLe | finalSaidaOutputs / — | componente (.tsx) |
| `downloadSaidaCsv` | 2204 | 20 | telaLe | finalSaidaOutputs / — | componente (.tsx) |

