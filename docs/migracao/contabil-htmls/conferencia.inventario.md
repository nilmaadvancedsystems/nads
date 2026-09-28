# Inventário de camadas — conferencia.html

4778 linhas · 310 funções · MISTA: 16 · Model: 153 · ViewModel: 66 · View: 75

## Estado global (21) — vira estado dos ViewModels ou parâmetro das regras

`saved` (L1399) · `savedFam` (L1401) · `dados` (L1491) · `atual` (L1491) · `view` (L1708) · `ultimaPorSecao` (L1708) · `cadTipo` (L1760) · `contasFiltroGrupo` (L2043) · `vistaEditando` (L2177) · `vistaEditTipo` (L2177) · `vistaDestacar` (L2177) · `reimp` (L2471) · `filtro` (L2937) · `natAnimar` (L3151) · `ccState` (L3313) · `confAbaAtual` (L3370) · `consultaTipo` (L3370) · `vc` (L3702) · `cadServTipo` (L4449) · `servOrdem` (L4730) · `primeiraCarga` (L4756)

## Constantes e tabelas (31) — dados do domínio (packages/core) ou config da tela

`APP_VERSION` (L1331) · `ICONS` (L1335) · `THEME_KEY` (L1373) · `THEME_FAMILY_KEY` (L1374) · `THEME_FAMILIAS` (L1375) · `MES` (L1451) · `CLIENTES` (L1515) · `SEED` (L1517) · `SECOES` (L1678) · `VIEWS` (L1694) · `MSG_CADASTRO_BLOQ` (L1709) · `AVISO_IMPORTAR` (L1816) · `SIDEBAR_KEY` (L1867) · `GRUPOS_ORDEM` (L2042) · `VISTA_TIPOS` (L2178) · `CONFERIVEIS` (L2328) · `MARK_SVG` (L2416) · `IMP_CONFIG` (L2481) · `BAL_SIMILARIDADE_MIN` (L2578) · `MSG_IMPORT` (L2625) · `STOPWORDS_CONTA` (L2663) · `ORDENS_DIV` (L2850) · `CONS_TIPOS` (L2942) · `CONS_GRUPOS` (L2944) · `SORT_CAMPOS` (L2957) · `CFOP_DESC` (L3152) · `DESC_AMBOS` (L3349) · `RE_PREFIXO_PERIODO` (L3622) · `VC_LIMITE_LINHAS` (L4117) · `SV` (L4266) · `SERV_CAT` (L4417)

## Infraestrutura (2) — some: vira packages/core/firebase

`firebaseConfig` (L1481) · `db` (L1490)

## MISTA — dividir antes de migrar (16)

| Função | Linha | Tam. | Sinais | Estado global (lê / muda) | Destino |
|---|---:|---:|---|---|---|
| `entrar` | 2004 | 20 | telaLe, telaEscreve · chama save | dados, renderTudo() / dados, atual, contasFiltroGrupo, ccState | dividir: desenha e grava (save) |
| `sair` | 2024 | 16 | telaLe, telaEscreve · chama save | atual, emp() / atual | dividir: desenha e grava (save) |
| `$('#btPlano').onclick` | 2526 | 44 | telaLe, telaEscreve, html, retorno · chama apagarPlano → save, save, concluir → save | reimp, atual, emp() / reimp | dividir: desenha e grava (apagarPlano → save; save; concluir → save); evento com lógica dentro (44 linhas) |
| `(anônima) sheet(f).then` | 2532 | 37 | telaEscreve, html, retorno · chama save, concluir → save | reimp, atual, emp() / reimp | dividir: desenha e grava (save; concluir → save) |
| `concluir` | 2539 | 17 | telaEscreve, retorno · chama save | reimp, emp() / reimp | dividir: desenha e grava (save) |
| `importar` | 2856 | 71 | telaLe, telaEscreve, html, retorno · chama save, aplicar → save | reimp, view, emp() / reimp | dividir: desenha e grava (save; aplicar → save) |
| `(anônima) sheet(f).then` | 2863 | 63 | telaEscreve, html, retorno · chama save, aplicar → save | reimp, view, emp() / reimp | dividir: desenha e grava (save; aplicar → save) |
| `aplicar` | 2876 | 38 | telaEscreve, html · chama save | reimp, view, emp() / reimp | dividir: desenha e grava (save) |
| `renderChecklistNatureza` | 3080 | 71 | telaLe, telaEscreve, html · chama autoMarcarConferidos → save | atual, ccState, natAnimar, notasNoPeriodoCc(), periodoKeyCc(), emp() / natAnimar | dividir: desenha e grava (autoMarcarConferidos → save) |
| `renderGeral` | 3593 | 28 | telaLe, telaEscreve, html · chama autoMarcarConferidos → save | atual, confAbaAtual, notasNoPeriodoCc(), periodoKeyCc() / — | dividir: desenha e grava (autoMarcarConferidos → save) |
| `$('#vcBtConferir').onclick` | 3980 | 129 | telaLe, telaEscreve, html, retorno, tempo · chama verifGravar → save | vc, view, vcMulti(), vcRotuloContas(), vcCodigos() / vc | dividir: desenha e grava (verifGravar → save); evento com lógica dentro (129 linhas) |
| `(anônima) setTimeout` | 3993 | 115 | telaLe, telaEscreve, html, retorno, tempo · chama verifGravar → save | vc, view, vcMulti(), vcRotuloContas(), vcCodigos() / vc | dividir: desenha e grava (verifGravar → save) |
| `importarServ` | 4311 | 61 | telaLe, telaEscreve, html, retorno · chama save, aplicar → save | reimp, emp() / reimp | dividir: desenha e grava (save; aplicar → save) |
| `(anônima) sheet(f).then` | 4317 | 54 | telaEscreve, html, retorno · chama save, aplicar → save | reimp, emp() / reimp | dividir: desenha e grava (save; aplicar → save) |
| `aplicar` | 4329 | 30 | telaEscreve, html · chama save | reimp, emp() / reimp | dividir: desenha e grava (save) |
| `(anônima) document.addEventListener('click')` | 4575 | 18 | telaLe, telaEscreve, retorno · chama servRefresh → save | servRefresh() / — | dividir: desenha e grava (servRefresh → save) |

## Model (packages/core) (153)

| Função | Linha | Tam. | Sinais | Estado global (lê / muda) | Destino |
|---|---:|---:|---|---|---|
| `brl` | 1452 | 1 | — | — | util (packages/core/formatos) — provavelmente já existe lá |
| `esc` | 1453 | 1 | — | — | util (packages/core/formatos) — provavelmente já existe lá |
| `num` | 1454 | 9 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `comp` | 1463 | 5 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `dataOrdem` | 1468 | 5 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `rot` | 1473 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `dl` | 1474 | 5 | arquivo, tempo | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `slug` | 1492 | 2 | — | — | util (packages/core/formatos) — provavelmente já existe lá |
| `save` | 1494 | 12 | banco, retorno | atual, dados / — | repositório (packages/core/<dominio>/repo) |
| `emp` | 1506 | 1 | — | dados, atual / — | regra — hoje lê estado global (dados, atual): passar por parâmetro |
| `limparNomeConta` | 1507 | 6 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `norm` | 1513 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `sheet` | 1533 | 6 | arquivo | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `acha` | 1539 | 6 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `normExportado` | 1546 | 6 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `col` | 1552 | 12 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `lerNotas` | 1564 | 21 | — | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `classificarGrupo` | 1585 | 8 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `lerBalancete` | 1598 | 20 | — | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `candidatosBusca` | 1620 | 6 | — | dados / — | regra — hoje lê estado global (dados): passar por parâmetro |
| `peso` | 1633 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `secaoPorId` | 1710 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `importacoesOk` | 1711 | 1 | — | atual, emp() / — | regra — hoje lê estado global (atual, emp()): passar por parâmetro |
| `telaInicialEmpresa` | 1712 | 6 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `primeiraImportacaoPendente` | 1718 | 5 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `contadorSubnav` | 1738 | 15 | — | atual, emp(), contadorCad() / — | regra — hoje lê estado global (atual, emp(), contadorCad()): passar por parâmetro |
| `contadorCad` | 1754 | 6 | — | atual / — | regra — hoje lê estado global (atual): passar por parâmetro |
| `todosGruposNatureza` | 2077 | 5 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `ehCfopVenda` | 2137 | 5 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `docLimpo` | 2142 | 4 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `ehVendaVista` | 2146 | 6 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `vendaVistaCfg` | 2152 | 1 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `ctxVista` | 2154 | 10 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `ehGrupoVenda` | 2179 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `vistaValor` | 2180 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `vistaPendentes` | 2205 | 9 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `naturezasDaConta` | 2266 | 4 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `contasDaNatureza` | 2270 | 5 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `saldoAtualizado` | 2275 | 4 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `contasDoPassivo` | 2279 | 3 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `contasServico` | 2287 | 5 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `notasCfopDeServico` | 2293 | 7 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `noPeriodoCc` | 2300 | 4 | — | ccState / — | regra — hoje lê estado global (ccState): passar por parâmetro |
| `servicoDaConta` | 2305 | 7 | — | noPeriodoCc() / — | regra — hoje lê estado global (noPeriodoCc()): passar por parâmetro |
| `somaServDaConta` | 2313 | 7 | — | noPeriodoCc() / — | regra — hoje lê estado global (noPeriodoCc()): passar por parâmetro |
| `somaNfeDaConta` | 2321 | 7 | — | emp(), noPeriodoCc() / — | regra — hoje lê estado global (emp(), noPeriodoCc()): passar por parâmetro |
| `podeConferir` | 2329 | 4 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `nomeConta` | 2333 | 4 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `ndpContasDisponiveis` | 2337 | 7 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `ordemPlano` | 2349 | 7 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `gi` | 2350 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `naoContabil` | 2402 | 1 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `impPrecisaBalancete` | 2420 | 5 | — | atual, emp() / — | regra — hoje lê estado global (atual, emp()): passar por parâmetro |
| `mostrarAvisoBalancete` | 2428 | 1 | — | atual, view, emp() / — | regra — hoje lê estado global (atual, view, emp()): passar por parâmetro |
| `empresaNuncaAberta` | 2429 | 4 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `impJaImportado` | 2463 | 4 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `nomeNorm` | 2576 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `assinaturaBalancete` | 2577 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `lancsDescobertos` | 2644 | 15 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `normalizarTexto` | 2659 | 4 | — | — | util (packages/core/formatos) — provavelmente já existe lá |
| `palavrasSignificativas` | 2664 | 3 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `melhorConta` | 2667 | 19 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `linhasDp` | 2700 | 11 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `chave` | 2789 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `lancN` | 2791 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `lancComZeros` | 2793 | 4 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `ehCpf` | 2797 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `chaveNaturezaNota` | 2798 | 7 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `lancEsperadoSaida` | 2806 | 7 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `lancVistaDaNota` | 2813 | 4 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `padraoPorCfop` | 2817 | 20 | — | emp() / — | util (packages/core/formatos) — provavelmente já existe lá |
| `acharDivergencias` | 2837 | 13 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `cfop` | 2851 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `valor` | 2852 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `data` | 2853 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `consGrupo` | 2945 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `issDaNota` | 2946 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `listaConsulta` | 2947 | 6 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `data` | 2958 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `numero` | 2959 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `nome` | 2960 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `cfop` | 2961 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `lanc` | 2962 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `valor` | 2963 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `iss` | 2964 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `tipo` | 2965 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `filtrar` | 2967 | 9 | — | filtro / — | regra — hoje lê estado global (filtro): passar por parâmetro |
| `agruparPorNatureza` | 3153 | 11 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `ordenarGrupos` | 3164 | 16 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `mesCurto` | 3314 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `contaPorLanc` | 3315 | 4 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `contaPorCfops` | 3319 | 11 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `notasBaseCc` | 3332 | 7 | — | ccState, emp() / — | regra — hoje lê estado global (ccState, emp()): passar por parâmetro |
| `notasNoPeriodoCc` | 3339 | 3 | — | ccState / — | regra — hoje lê estado global (ccState): passar por parâmetro |
| `tipoDoCfop` | 3343 | 4 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `agruparTotaisPorNatureza` | 3355 | 12 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `periodoKeyCc` | 3367 | 1 | — | ccState / — | regra — hoje lê estado global (ccState): passar por parâmetro |
| `renderMovimentoFiltrado` | 3399 | 3 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `gruposConciliacao` | 3470 | 19 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `(anônima) chaves.forEach` | 3472 | 15 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `nomeBaseConta` | 3491 | 3 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `nomeBaseNormalizada` | 3496 | 3 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `nomeComumContas` | 3499 | 9 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `(anônima) comps.forEach` | 3567 | 21 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `doTipo` | 3597 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `renderAuditoriaImport` | 3652 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `renderCcHistorico` | 3653 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `registrarHist` | 3656 | 12 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `vcMulti` | 3706 | 1 | — | vc / — | regra — hoje lê estado global (vc): passar por parâmetro |
| `vcCodigos` | 3707 | 1 | — | vc, vcMulti() / — | regra — hoje lê estado global (vc, vcMulti()): passar por parâmetro |
| `vcRotuloContas` | 3708 | 5 | — | vc, vcMulti() / — | regra — hoje lê estado global (vc, vcMulti()): passar por parâmetro |
| `vcServDaConta` | 3730 | 5 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `vcNotasServ` | 3735 | 7 | — | vc, vcCodigos() / — | regra — hoje lê estado global (vc, vcCodigos()): passar por parâmetro |
| `vcTodasNotas` | 3750 | 4 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `vcNumerosDoHistorico` | 3754 | 11 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `vcPartesHistorico` | 3765 | 8 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `vcOndeNota` | 3773 | 11 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `olhar` | 3775 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `vcLinhaRazao` | 3785 | 4 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `ehLinhaIcms` | 3791 | 2 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `vcLinhasDuplicadas` | 3794 | 10 | — | vc / — | regra — hoje lê estado global (vc): passar por parâmetro |
| `vcLinhasFaltando` | 3804 | 3 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `verifChave` | 3826 | 1 | — | periodoKeyCc() / — | regra — hoje lê estado global (periodoKeyCc()): passar por parâmetro |
| `verifEstado` | 3827 | 1 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `vcEnter` | 3835 | 8 | — | atual, vc / — | regra — hoje lê estado global (atual, vc): passar por parâmetro |
| `acha` | 3846 | 1 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `vcFaltando` | 3890 | 10 | — | vc, vcMulti() / — | regra — hoje lê estado global (vc, vcMulti()): passar por parâmetro |
| `vcLerRazao` | 3901 | 19 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `(anônima) sheet(f).then` | 3902 | 17 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `opcao` | 3961 | 4 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `(anônima) linhasConf.filter` | 4013 | 15 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `catSv` | 4128 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `soma` | 4146 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `add` | 4232 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `ehServ` | 4270 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `semPrest` | 4271 | 1 | — | atual, emp() / — | regra — hoje lê estado global (atual, emp()): passar por parâmetro |
| `listaTipo` | 4272 | 1 | — | semPrest(), emp() / — | regra — hoje lê estado global (semPrest(), emp()): passar por parâmetro |
| `chaveServ` | 4273 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `capital` | 4274 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `lerServicos` | 4275 | 35 | — | — | arquivo: ler/gerar (packages/core/<dominio>/arquivos) |
| `acha` | 4286 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `catServ` | 4430 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `chaveContaCat` | 4431 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `servCatMapa` | 4432 | 1 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `catFixa` | 4433 | 5 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `catDoPart` | 4438 | 5 | — | emp() / — | regra — hoje lê estado global (emp()): passar por parâmetro |
| `contasDoPart` | 4445 | 3 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `servPartsDasNotas` | 4467 | 8 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `chRes` | 4623 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `catN` | 4625 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `soma` | 4683 | 1 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `agrupar` | 4684 | 9 | — | — | regra pura (packages/core/<dominio>/regras) + teste |
| `renderTudo` | 4755 | 1 | — | view / — | regra — hoje lê estado global (view): passar por parâmetro |

## ViewModel (hooks) (66)

| Função | Linha | Tam. | Sinais | Estado global (lê / muda) | Destino |
|---|---:|---:|---|---|---|
| `applyTheme` | 1378 | 6 | telaLe, telaEscreve, navegador | — | ação/estado do hook da tela (use<Tela>.ts) |
| `applyThemeFamily` | 1384 | 6 | telaLe, telaEscreve, navegador | — | ação/estado do hook da tela (use<Tela>.ts) |
| `abrirTemaModal` | 1403 | 21 | html, navegador, retorno | — | ação/estado do hook da tela (use<Tela>.ts) |
| `toast` | 1426 | 4 | telaLe, telaEscreve, retorno, tempo | — | ação/estado do hook da tela (use<Tela>.ts) |
| `modal` | 1430 | 19 | telaLe, telaEscreve, eventos, retorno | — | ação/estado do hook da tela (use<Tela>.ts) |
| `(anônima)` | 1431 | 17 | telaLe, telaEscreve, eventos | — | ação/estado do hook da tela (use<Tela>.ts) |
| `btn.onclick` | 1442 | 1 | telaLe, telaEscreve | — | ação/estado do hook da tela (use<Tela>.ts) |
| `cadAba` | 1761 | 11 | telaLe, telaEscreve | semPrest() / cadTipo, cadServTipo | ação/estado do hook da tela (use<Tela>.ts) |
| `definirPrestaServico` | 1776 | 5 | — · chama save | cadTipo, emp() / — | ação/estado do hook da tela (use<Tela>.ts) |
| `perguntarPrestaServico` | 1781 | 8 | html, retorno | atual, emp() / — | ação/estado do hook da tela (use<Tela>.ts) |
| `avisoImportar` | 1826 | 6 | retorno | — | ação/estado do hook da tela (use<Tela>.ts) |
| `aplicarBloqueios` | 1838 | 28 | telaLe, telaEscreve | atual, confAbaAtual, ccState, consultaTipo, cadTipo, view +2 / confAbaAtual, ccState, consultaTipo, cadTipo | ação/estado do hook da tela (use<Tela>.ts) |
| `aplicarSidebar` | 1868 | 8 | telaLe, telaEscreve, navegador | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btColapsar').onclick` | 1876 | 1 | telaLe, telaEscreve | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btVoltarMov').onclick` | 1883 | 1 | — | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btPersonalizarTema').onclick` | 1885 | 1 | telaLe | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#crumbInicio').onclick` | 1893 | 1 | — · chama sair → save | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#brandTagEmpresa').onclick` | 1894 | 1 | — | atual / — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btEmpCaret').onclick` | 1895 | 1 | telaLe | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btMenuHamb').onclick` | 1898 | 1 | — | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btDrawerFechar').onclick` | 1899 | 1 | — | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#drawerOverlay').onclick` | 1900 | 1 | — | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btDrawerInicio').onclick` | 1902 | 1 | — · chama sair → save | — | ação/estado do hook da tela (use<Tela>.ts) |
| `wireFilePicker` | 1920 | 17 | telaLe, telaEscreve, eventos | — | ação/estado do hook da tela (use<Tela>.ts) |
| `clr.onclick` | 1929 | 7 | telaLe, telaEscreve | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btSairIcon').onclick` | 1949 | 1 | telaLe · chama sair → save | — | ação/estado do hook da tela (use<Tela>.ts) |
| `go` | 1950 | 28 | telaLe, telaEscreve, retorno | atual, reimp, view, ultimaPorSecao, confAbaAtual, consultaTipo +3 / reimp, view, ultimaPorSecao | ação/estado do hook da tela (use<Tela>.ts) |
| `vistaBloqueia` | 2215 | 12 | telaLe, html, retorno | atual, view, cadTipo / vistaDestacar, vistaEditando | ação/estado do hook da tela (use<Tela>.ts) |
| `vistaSalvar` | 2235 | 1 | retorno · chama save | view, confAbaAtual / — | ação/estado do hook da tela (use<Tela>.ts) |
| `vistaGravar` | 2236 | 7 | — · chama vistaSalvar → save | vistaSalvar() / vistaEditando | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btReimp'+s).onclick` | 2473 | 7 | telaLe | reimp / reimp | ação/estado do hook da tela (use<Tela>.ts) |
| `apagarPlano` | 2511 | 15 | retorno · chama save | atual, emp() / — | ação/estado do hook da tela (use<Tela>.ts) |
| `impApagarNotas` | 2605 | 15 | html, retorno · chama save | atual, view, emp() / — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btExcluirPlano').onclick` | 2620 | 1 | telaLe, telaEscreve · chama apagarPlano → save | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btExcluirEnt').onclick` | 2621 | 1 | telaLe, telaEscreve · chama impApagarNotas → save | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btExcluirSai').onclick` | 2622 | 1 | telaLe, telaEscreve · chama impApagarNotas → save | — | ação/estado do hook da tela (use<Tela>.ts) |
| `x.onclick` | 2634 | 1 | telaEscreve | — | ação/estado do hook da tela (use<Tela>.ts) |
| `alerta` | 2639 | 3 | telaEscreve, html, retorno | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btAutoLanc').onclick` | 2762 | 25 | retorno · chama save | atual, emp() / — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btImpEnt').onclick` | 2927 | 4 | telaEscreve · chama impApagarNotas → save, importar → save | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btImpSai').onclick` | 2931 | 4 | telaEscreve · chama impApagarNotas → save, importar → save | — | ação/estado do hook da tela (use<Tela>.ts) |
| `(anônima) document.addEventListener('change')` | 3235 | 23 | telaLe · chama save | emp() / — | ação/estado do hook da tela (use<Tela>.ts) |
| `(anônima) document.addEventListener('click')` | 3293 | 18 | retorno · chama save | atual, view, emp() / — | ação/estado do hook da tela (use<Tela>.ts) |
| `confAba` | 3371 | 11 | telaLe, telaEscreve | — / confAbaAtual | ação/estado do hook da tela (use<Tela>.ts) |
| `consAba` | 3382 | 9 | telaLe, telaEscreve | — / consultaTipo | ação/estado do hook da tela (use<Tela>.ts) |
| `autoMarcarConferidos` | 3563 | 27 | — · chama save | emp() / — | ação/estado do hook da tela (use<Tela>.ts) |
| `(anônima) document.addEventListener('change')` | 3678 | 22 | telaLe · chama save | emp() / natAnimar | ação/estado do hook da tela (use<Tela>.ts) |
| `vcReset` | 3703 | 1 | — | — / vc | ação/estado do hook da tela (use<Tela>.ts) |
| `vcDescartarRelatorio` | 3744 | 6 | telaLe, telaEscreve | vc / vc | ação/estado do hook da tela (use<Tela>.ts) |
| `verifGravar` | 3828 | 7 | — · chama save | emp() / — | ação/estado do hook da tela (use<Tela>.ts) |
| `vcAbrirParaConta` | 3845 | 9 | retorno | vc, emp(), vcCodigos() / vc | ação/estado do hook da tela (use<Tela>.ts) |
| `vcCarregarContas` | 3859 | 9 | telaLe, telaEscreve, html | vc, emp(), vcRotuloContas() / vc | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#vcBtImportarRazao').onclick` | 3920 | 11 | telaLe, telaEscreve, html, retorno | vc / vc | ação/estado do hook da tela (use<Tela>.ts) |
| `vcMontarCfopSelect` | 3944 | 34 | telaLe, telaEscreve, html | vc / vc | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#vcBtReimportar').onclick` | 4208 | 9 | telaLe, retorno | vc, vcMulti(), abrir() / vc | ação/estado do hook da tela (use<Tela>.ts) |
| `abrir` | 4211 | 1 | telaLe | vc / vc | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#vcBtOk').onclick` | 4217 | 1 | telaLe | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#vcBtCsv').onclick` | 4225 | 22 | — | vc, atual / — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#vcBtExcluir3').onclick` | 4247 | 11 | telaLe, telaEscreve, retorno | vc / vc | ação/estado do hook da tela (use<Tela>.ts) |
| `servApagar` | 4372 | 14 | retorno · chama save | emp() / — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btImp'+s).onclick` | 4390 | 1 | telaEscreve · chama servApagar → save, importarServ → save | — | ação/estado do hook da tela (use<Tela>.ts) |
| `$('#btExcluir'+s).onclick` | 4391 | 1 | telaLe, telaEscreve · chama servApagar → save | — | ação/estado do hook da tela (use<Tela>.ts) |
| `servRefresh` | 4448 | 1 | — · chama save | view, confAbaAtual / — | ação/estado do hook da tela (use<Tela>.ts) |
| `servIrParaForm` | 4539 | 7 | telaLe, tempo | view / cadServTipo, cadTipo | ação/estado do hook da tela (use<Tela>.ts) |
| `servConfirmar` | 4565 | 10 | telaLe, retorno · chama servRefresh → save | servRefresh() / — | ação/estado do hook da tela (use<Tela>.ts) |
| `(anônima) db.collection('empresas').onSnapshot` | 4757 | 15 | — · chama save | primeiraCarga, dados / dados, primeiraCarga | ação/estado do hook da tela (use<Tela>.ts) |

## View (componentes) (75)

| Função | Linha | Tam. | Sinais | Estado global (lê / muda) | Destino |
|---|---:|---:|---|---|---|
| `svg` | 1367 | 1 | html | — | template → JSX |
| `$` | 1369 | 1 | telaLe | — | componente (.tsx) |
| `$$` | 1370 | 1 | telaLe | — | componente (.tsx) |
| `renderBusca` | 1626 | 22 | telaLe, telaEscreve, html | candidatosBusca() / — | componente (.tsx) |
| `renderNav` | 1789 | 24 | telaLe, telaEscreve, html | view, atual, importacoesOk(), emp() / — | componente (.tsx) |
| `ajustarAlturaCabecalho` | 1879 | 3 | telaLe, telaEscreve | — | componente (.tsx) |
| `togglePopover` | 1886 | 5 | telaLe, telaEscreve | — | componente (.tsx) |
| `abrirGaveta` | 1897 | 1 | telaLe, telaEscreve | — | componente (.tsx) |
| `impBotoesEstado` | 1912 | 8 | telaLe, telaEscreve | — | componente (.tsx) |
| `resetFilePicker` | 1937 | 6 | telaLe, telaEscreve | — | componente (.tsx) |
| `renderTopActions` | 1978 | 9 | telaLe, telaEscreve, html | view, consultaTipo, atual, reimp, switchAutoLimpar() / — | componente (.tsx) |
| `switchAutoLimpar` | 1988 | 5 | html | atual, emp() / — | template → JSX |
| `renderPlano` | 2044 | 25 | telaLe, telaEscreve, html | atual, contasFiltroGrupo, emp() / — | componente (.tsx) |
| `renderNaturezaDePara` | 2082 | 51 | telaLe, telaEscreve, html | atual, cadTipo, emp() / — | componente (.tsx) |
| `(anônima) ['Entrada','Saída'].forEach` | 2101 | 30 | telaEscreve, html | emp() / — | componente (.tsx) |
| `(anônima) ks.map` | 2104 | 25 | html | emp() / — | template → JSX |
| `vendaVistaCard` | 2164 | 10 | html | emp() / — | template → JSX |
| `vistaRowCfop` | 2181 | 23 | html | vistaEditando, vistaEditTipo, vistaDestacar, emp() / — | template → JSX |
| `slot` | 2190 | 11 | html | vistaEditando, vistaEditTipo, vistaDestacar / — | template → JSX |
| `avisoPassivo` | 2282 | 5 | html | — | template → JSX |
| `grupoTag` | 2344 | 4 | html | — | template → JSX |
| `ndpRenderAddLista` | 2356 | 8 | telaLe, telaEscreve, html | — | componente (.tsx) |
| `ndpFecharCampo` | 2380 | 6 | telaLe, telaEscreve | — | componente (.tsx) |
| `renderImportacoes` | 2433 | 30 | telaLe, telaEscreve, html | atual, reimp, mostrarAvisoBalancete(), emp() / — | componente (.tsx) |
| `impAtualizarBox` | 2488 | 13 | telaEscreve, html | — | componente (.tsx) |
| `btnCarregando` | 2501 | 5 | telaLe, telaEscreve, html | — | componente (.tsx) |
| `btnCarregandoFim` | 2506 | 5 | telaLe, telaEscreve | — | componente (.tsx) |
| `verificarBalancete` | 2579 | 26 | html | emp() / — | template → JSX |
| `fecharMsgsImport` | 2626 | 1 | telaEscreve | — | componente (.tsx) |
| `opcoesContaAnalitica` | 2686 | 14 | html | emp() / — | template → JSX |
| `renderDP` | 2711 | 32 | telaLe, telaEscreve, html | atual, emp() / — | componente (.tsx) |
| `consTipoHtml` | 2953 | 4 | html | — | template → JSX |
| `thSort` | 2976 | 5 | html | filtro / — | template → JSX |
| `renderNotas` | 2985 | 12 | telaEscreve, html | atual / — | componente (.tsx) |
| `renderImportadas` | 2998 | 19 | telaEscreve, html | atual, emp() / — | componente (.tsx) |
| `renderConsulta` | 3018 | 53 | telaLe, telaEscreve, html | atual, filtro, thSort() / — | componente (.tsx) |
| `(anônima) chaves.map` | 3125 | 24 | html | natAnimar, emp() / — | template → JSX |
| `renderDivergencias` | 3180 | 52 | html | filtro, emp() / — | template → JSX |
| `renderGrupo` | 3189 | 29 | html | — | template → JSX |
| `notasPesquisar` | 3269 | 7 | telaLe | filtro / — | componente (.tsx) |
| `renderCcChart` | 3419 | 28 | telaLe, telaEscreve, html | ccState / — | componente (.tsx) |
| `renderCcRank` | 3447 | 19 | telaLe, telaEscreve, html | — | componente (.tsx) |
| `renderCcBalancete` | 3508 | 52 | telaLe, telaEscreve, html | periodoKeyCc(), emp() / — | componente (.tsx) |
| `(anônima) comps.map` | 3525 | 34 | html | periodoKeyCc(), emp() / — | template → JSX |
| `renderAuditoria` | 3623 | 29 | telaLe, telaEscreve, html | atual, emp() / — | componente (.tsx) |
| `vcInfoLidos` | 3713 | 4 | html | — | template → JSX |
| `vcRenderMulti` | 3717 | 11 | telaLe, telaEscreve, html | vc, vcMulti() / — | componente (.tsx) |
| `vcTabelaFaltando` | 3807 | 8 | html | — | template → JSX |
| `exp` | 3808 | 1 | html | — | template → JSX |
| `vcTabela` | 3815 | 7 | html | — | template → JSX |
| `vcMostrarResultado` | 3822 | 4 | telaLe, telaEscreve | — | componente (.tsx) |
| `vcRenderContaLista` | 3868 | 10 | telaLe, telaEscreve, html | vc / — | componente (.tsx) |
| `voltar` | 4095 | 1 | telaLe, telaEscreve | view / — | componente (.tsx) |
| `vcComposicao` | 4110 | 7 | html | — | template → JSX |
| `it` | 4112 | 1 | html | — | template → JSX |
| `vcAvisoTruncado` | 4118 | 3 | html | — | template → JSX |
| `vcRenderResultado` | 4121 | 83 | telaLe, telaEscreve, html | vc, vcCodigos() / — | componente (.tsx) |
| `numero` | 4134 | 1 | html | — | template → JSX |
| `sec` | 4162 | 1 | html | — | template → JSX |
| `secao` | 4186 | 3 | html | — | template → JSX |
| `renderServImportados` | 4394 | 19 | telaLe, telaEscreve, html | atual, emp() / — | componente (.tsx) |
| `servContasHtml` | 4450 | 17 | html | emp() / — | template → JSX |
| `servFormHtml` | 4476 | 10 | html | — | template → JSX |
| `renderCadServ` | 4486 | 36 | telaLe, telaEscreve, html | atual, cadServTipo, emp() / — | componente (.tsx) |
| `(anônima) cats.map` | 4495 | 26 | html | — | template → JSX |
| `bloco` | 4498 | 1 | html | — | template → JSX |
| `servFormEstado` | 4523 | 3 | telaLe | — | componente (.tsx) |
| `servAbrirForm` | 4526 | 6 | telaLe, telaEscreve | — | componente (.tsx) |
| `servFecharForm` | 4532 | 6 | telaLe, telaEscreve | — | componente (.tsx) |
| `servListaForn` | 4546 | 13 | telaLe, telaEscreve, html | — | componente (.tsx) |
| `servListaConta` | 4559 | 6 | telaLe, telaEscreve, html | — | componente (.tsx) |
| `renderConfServ` | 4617 | 113 | telaLe, telaEscreve, html | atual, ccState, servOrdem, emp() / — | componente (.tsx) |
| `st` | 4631 | 1 | html | — | template → JSX |
| `(anônima) ks.map` | 4659 | 22 | html | — | template → JSX |
| `grupo` | 4693 | 28 | html | — | template → JSX |

