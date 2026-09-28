# Inventário de camadas — cheque_especial.html

805 linhas · 29 funções · MISTA: 2 · Model: 20 · ViewModel: 7 · View: 0

Bibliotecas coladas no arquivo (ignoradas): linha 343 (426 KB)

## Estado global (11) — vira estado dos ViewModels ou parâmetro das regras

`state` (L380) · `dz` (L382) · `input` (L383) · `alertHost` (L384) · `fileCardHost` (L385) · `resultsHost` (L386) · `generateBtn` (L387) · `fBanco` (L388) · `fCheque` (L389) · `fHistorico` (L390) · `fInvertCD` (L392)

## Constantes e tabelas (4) — dados do domínio (packages/core) ou config da tela

`ICONS` (L367) · `VALID_EXTS` (L412) · `MS_DAY` (L539) · `BLANK_LEAD_ROWS` (L760)

## MISTA — dividir antes de migrar (2)

| Função | Linha | Tam. | Sinais | Estado global (lê / muda) | Destino |
|---|---:|---:|---|---|---|
| `renderResults` | 688 | 63 | telaLe, telaEscreve, html, eventos | resultsHost / resultsHost | dividir: evento com lógica dentro (63 linhas) |
| `downloadLancamentos` | 781 | 19 | arquivo, telaEscreve, retorno | — | dividir: arquivo + tela |

## Model (packages/core) (20)

| Função | Linha | Tam. | Sinais | Estado global (lê / muda) | Destino |
|---|---:|---:|---|---|---|
| `validExt` | 413 | 4 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `formatBytes` | 454 | 5 | — | — | util (packages/core/formatos) — provavelmente já existe lá |
| `escapeHtml` | 459 | 5 | — | — | util (packages/core/formatos) — provavelmente já existe lá |
| `readSheet` | 494 | 17 | arquivo | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `(anônima)` | 495 | 15 | arquivo | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `normalizeHeader` | 518 | 5 | — | — | util (packages/core/formatos) — provavelmente já existe lá |
| `findColumns` | 524 | 14 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `excelSerialToDate` | 540 | 6 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `parseDateCell` | 547 | 16 | — | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `dateOnly` | 563 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `roundCents` | 565 | 5 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `parseSaldoCell` | 571 | 21 | — | state / — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) — lê estado: state |
| `isBusinessDay` | 593 | 4 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `nextBusinessDay` | 597 | 5 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `fmtDateBR` | 602 | 5 | — | — | util (packages/core/formatos) — provavelmente já existe lá |
| `fmtMoney` | 607 | 3 | — | — | util (packages/core/formatos) — provavelmente já existe lá |
| `buildDailyClosingBalances` | 612 | 15 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `buildLancamentos` | 628 | 36 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `dateToExcelSerial` | 752 | 7 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `buildLancamentosSheet` | 762 | 18 | arquivo | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |

## ViewModel (hooks) (7)

| Função | Linha | Tam. | Sinais | Estado global (lê / muda) | Destino |
|---|---:|---:|---|---|---|
| `showAlert` | 418 | 5 | telaEscreve, html | alertHost / alertHost | ação/estado do hook da tela (use<Tela>.ts) |
| `clearAlert` | 423 | 1 | telaEscreve | alertHost / alertHost | ação/estado do hook da tela (use<Tela>.ts) |
| `toast` | 425 | 8 | telaLe, telaEscreve, retorno, tempo | — | ação/estado do hook da tela (use<Tela>.ts) |
| `renderFileCard` | 434 | 19 | telaLe, telaEscreve, html, eventos | state, fileCardHost, resultsHost, updateGenerateEnabled() / fileCardHost, state, resultsHost | ação/estado do hook da tela (use<Tela>.ts) |
| `handleFile` | 465 | 27 | telaEscreve | resultsHost, state, clearAlert(), showAlert(), updateGenerateEnabled() / resultsHost, state | ação/estado do hook da tela (use<Tela>.ts) |
| `updateGenerateEnabled` | 512 | 3 | telaLe | generateBtn, state, fBanco, fCheque, fHistorico / generateBtn | ação/estado do hook da tela (use<Tela>.ts) |
| `(anônima) generateBtn.addEventListener('click')` | 666 | 21 | telaLe, telaEscreve | state, resultsHost, fBanco, fCheque, fHistorico, clearAlert() +1 / resultsHost | ação/estado do hook da tela (use<Tela>.ts) |

