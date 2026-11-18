// @nads/core/lancatudo — o extrato do banco em lançamentos contábeis prontos para o Alterdata (17/11/2026: "um Mister
// dentro do nads"). Lê o que o Extrator já guardou; a contrapartida vem da pessoa, das regras da empresa, do que o nads
// aprendeu ou da sugestão pelo razão. TypeScript puro.
export type {
  SentidoDaRegra, TipoDaRegra, RegraDoLancatudo, ContaLembrada, ConfigDoLancatudo, DecisaoDaLinha, ExportacaoFeita, MesDoLancatudo,
  OrigemDaConta, SituacaoDaLinha, LinhaDoRegistro, TotaisDoRegistro,
} from './tipos';
export { historicoLimpo, documentoNoHistorico, chaveDoFavorecido, chaveLembrada, expressaoCasa, regraCasa, regraDaLinha, historicoPelaRegra, regraSugerida } from './regras/motor';
export { dadosDoBanco, mesesComExtrato, chavesDasLinhas, problemaDaConta, montarRegistro, totaisDoRegistro, percentualConciliado, type DadosDoBanco, type EntradaDoRegistro } from './regras/registro';
export {
  configVazia, mesVazio, problemaDaRegra, criarRegra, editarRegra, excluirRegras, escolherConta, removerConta, voltarAoAutomatico, editarHistorico,
  ignorarLinha, esquecerLembrada, registrarExportacao, gravarLinha, type DadosDaRegra, type RascunhoDaLinha,
} from './regras/mudancas';
export { linhasParaExportar, lancamentoDaLinha, lancamentosParaImportar, planilhaDaConferencia, nomeDoArquivoDoLancatudo, TIPO_XLSX } from './regras/exportacao';
export { linhasDoPlano, linhasVisiveisDoPlano, gruposFechadosNoInicio, type LinhaDoPlano } from './regras/plano';
export { configDoDocumento, mesDoDocumento, documentoDaConfig, documentoDoMes, idDaChave } from './regras/documento';
