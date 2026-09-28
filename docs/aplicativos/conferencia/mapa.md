# Conferência Contábil → nads (cópia)

Origem: `contabil-htmls/conferencia.html` (beta 0.1.63, 4.777 linhas). Inventário completo:
`inventario.md` (310 funções: 153 Model, 66 ViewModel, 75 View, 16 MISTAS).
Cópia sem banco: repositório em memória com empresas de exemplo (901, 902, 903).

## Telas

| Tela antiga (seção › página › aba) | Rota no nads (`#/<empresa>/…`) | ViewModel | View |
|---|---|---|---|
| Entrada (escolher empresa) | `#/` | `entrada/useEntrada.ts` | `entrada/Entrada.tsx` |
| Importação › Balancete/Entradas/Saídas/Tomados/Prestados | `importacao/<tipo>` | `importacao/useImportacao.ts` | `importacao/Importacao.tsx` + `partes/` |
| Cadastro › Configurações (Entradas/Saídas/Tomados/Prestados) | `cadastro/configuracoes` | `cadastro/useConfiguracoes.ts` | `cadastro/Configuracoes.tsx` + `partes/` |
| Cadastro › Lançamentos automáticos (fora do menu) | `cadastro/lancamentos-automaticos` | `lancamentos/useLancamentosAutomaticos.ts` | `lancamentos/LancamentosAutomaticos.tsx` |
| Movimento › Relatório (Geral/Entradas/Saídas/Tomados/Prestados) | `movimento/relatorio` | `relatorio/useRelatorio.ts` | `relatorio/Relatorio.tsx` + `partes/` |
| Movimento › Checklist ("Naturezas de CFOP") | `movimento/checklist` | `checklist/useChecklist.ts` | `checklist/Checklist.tsx` |
| Movimento › Consulta (Fiscais/Serviços) | `movimento/consulta` | `consulta/useConsulta.ts` | `consulta/Consulta.tsx` |
| Verificar por conta (Revisar, fora do menu) | `movimento/verificar` | `verificar/useVerificarConta.ts` | `verificar/VerificarConta.tsx` + `partes/` |
| Auditoria › Histórico | `auditoria/historico` | `auditoria/useAuditoria.ts` | `auditoria/Auditoria.tsx` |
| Casca (cabeçalho, barra lateral, gaveta, travas, sair) | — | `useCascaConferencia.ts` | `CascaConferencia.tsx` (+ `Casca` do ui) |

## Model (packages/core/src/conferencia)

| Original (conferencia.html) | Vira | Tipo |
|---|---|---|
| `num`, `comp`, `dataOrdem`, `brl`, `nomeNorm`, `lancN`, `lancComZeros`, `docLimpo`, `normExportado`, `slug`, `dl` (CSV) | `formatos/index.ts` | util |
| `CFOP_DESC` | `tabelas/cfop.ts` | tabela |
| `SV`, `SERV_CAT` | `tabelas/servicos.ts` | tabela |
| `tipoDoCfop`, `DESC_AMBOS`, `chaveNaturezaNota`, `agruparTotaisPorNatureza`, `agruparPorNatureza`, `ordenarGrupos`, `chave` | `regras/cfop.ts` | regra |
| `norm`, `limparNomeConta`, `contasDaNatureza`, `saldoAtualizado`, `nomeConta`, `avisoPassivo`, `ordemPlano`, `ndpContasDisponiveis`, `importacoesOk`, `impJaImportado`, `empresaNuncaAberta`, `telaInicialEmpresa`, `primeiraImportacaoPendente`, `listaTipo`, `semPrest` | `regras/empresa.ts` | regra |
| `noPeriodoCc`, `notasBaseCc`, `notasNoPeriodoCc`, `periodoKeyCc` | `regras/periodo.ts` | regra (ccState vira parâmetro) |
| `ehCfopVenda`, `ehVendaVista`, `ctxVista`, `lancEsperadoSaida`, `lancVistaDaNota`, `vistaRowCfop` (cálculo), `vistaPendentes` | `regras/vendaVista.ts` | regra |
| `catServ`, `chaveContaCat`, `catFixa`, `catDoPart`, `contasDoPart`, `contasServico`, `notasCfopDeServico`, `servicoDaConta`, `servPartsDasNotas`, `chaveServ` | `regras/servicos.ts` | regra |
| `padraoPorCfop`, `acharDivergencias` | `regras/divergencias.ts` | regra |
| `gruposConciliacao`, `nomeComumContas`, `podeConferir`, `verifEstado`, situação de `renderCcBalancete`, `autoMarcarConferidos` (o que marcar) | `regras/conciliacao.ts` | regra |
| cálculo de `renderGeral`, `renderCcChart`, `renderCcRank` | `regras/relatorio.ts` | regra |
| cálculo de `renderChecklistNatureza` | `regras/checklist.ts` | regra |
| `listaConsulta`, `filtrar`, `SORT_CAMPOS`, CSV da consulta | `regras/consulta.ts` | regra |
| `renderAuditoria` (linhas), `registrarHist` | `regras/auditoria.ts` | regra |
| `importar/aplicar`, `importarServ/aplicar`, `verificarBalancete`, `assinaturaBalancete` | `regras/importacao.ts` | regra |
| `lancsDescobertos`, `melhorConta`, `linhasDp`, `btAutoLanc` | `regras/lancamentosAuto.ts` | regra |
| cálculo de `renderConfServ` e `renderCadServ` | `regras/servicosConferencia.ts` | regra |
| algoritmo de dentro de `$('#vcBtConferir').onclick`, `vcNumerosDoHistorico`, `vcPartesHistorico`, `ehLinhaIcms`, `vcComposicao`, CSV | `regras/verificarConta.ts` | regra |
| `sheet`, `acha`, `col`, `lerNotas`, `lerBalancete`, `lerServicos`, `vcLerRazao` | `arquivos/index.ts` | arquivo |
| ~40 mutações de `emp()` + `save()` | `acoes.ts` (funções puras empresa → empresa) | ação |
| `save()`, `onSnapshot`, `CLIENTES`, `SEED` | `repo.ts` + `repo.memoria.ts` + `__exemplos__/` | repositório em memória |

Testes: 146 (regras, ações, repositório, arquivos) + paridade em `__legado__/`: as funções originais,
tiradas do `conferencia.html`, rodam lado a lado com as novas na mesma entrada. Nenhuma diferença.

## Cortes (MISTAs)

- `renderGeral`/`renderChecklistNatureza` desenhavam **e gravavam** (autoMarcarConferidos → save):
  regra `quaisMarcarSozinho` no core + ação `marcarAutomaticos` disparada pelo hook.
- `$('#vcBtConferir').onclick` (129 linhas): algoritmo inteiro → `conferirConta` no core; o hook só junta.
- `importar`/`importarServ`/`$('#btPlano').onclick`: ler (arquivos) → validar e mesclar (regras) →
  perguntar (hook) → gravar (ação) → mensagem (hook/View).
- `aplicarBloqueios`: `disponivel(e)` no core; travas e avisos no hook da casca e de cada tela.
- `entrar`/`sair`: ações `aoEntrar`/`aoSair` + navegação.

## Estado global → onde vai

| Variável | Vira |
|---|---|
| `dados`, `atual`, `emp()` | repositório + sessão (`empresa`) |
| `view`, `ultimaPorSecao` | URL (rota) |
| `ccState` | sessão `filtro` |
| `confAbaAtual`, `cadTipo`, `consultaTipo`, `filtro`, `servOrdem`, `ORDEM div` | sessão |
| `vc` | sessão `verificar` (descartado ao sair da tela) |
| `reimp`, `contasFiltroGrupo`, `vistaEditando` | estado do hook da tela |
| `natAnimar` | sessão |
| tema, barra lateral oculta | `localStorage` (ui) |

## Banco

Site publicado (https://nads-nilma.web.app): **mesmo Firestore da conferencia-nilma.web.app**
(`apps/web/src/aplicativos/conferencia/dados/conferencia.firestore.ts`): onSnapshot na coleção `empresas`, SEED na primeira carga,
save = set do documento inteiro em `empresas/{slug}`, lista = CLIENTES + banco. Diferença proposital: nada
grava antes da primeira carga. Local (`npm run dev`): repositório em memória com exemplos.

## Código morto do original (não copiado)

`somaServDaConta`, `somaNfeDaConta`, `contaPorCfops`, `impPrecisaBalancete`, `vcOndeNota`, `contadorSubnav`
(definidos e nunca chamados).

## Perguntas ao usuário

- (resolvidas) link: https://nads-nilma.web.app · banco: mesmo da Conferência, leitura e gravação.
