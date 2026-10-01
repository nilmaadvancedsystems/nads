// @nads/core/extrator — Model do Extrator (extrato bancário × lançamentos contábeis).
// Lê os extratos (PDF, OFX) e o razão da conta do banco (Excel, CSV, PDF), guarda só os
// lançamentos e confere: faltando, diferentes, a mais e duplicados. TypeScript puro.
export type {
  Lado, Lancamento, LancamentoDoArquivo, ModoImportacao, ArquivoImportado, RegistroAuditoria, EmpresaExtrator, BancoAdicionado, PedidoRegistrado,
  ArquivoLido, Situacao, TipoDiferenca, LinhaConferencia, Conferencia,
} from './tipos';
export { centavos, temSinal, lerData, numeroDoDia, dataBR, competencia, valorBR, palavras, parecido } from './regras/texto';
export { montarLinhas, anoDoTexto, lancamentosDoPdf, type ItemDeTexto } from './regras/extrato';
export { lancamentosDaPlanilha, type Celula } from './regras/planilha';
export { ehOfx, lancamentosDoOfx } from './regras/ofx';
export { conferir, totais, rotuloSituacao, csvConferencia, PARECIDO_MESMO_DIA, PARECIDO_OUTRO_DIA, PARECIDO_DUPLICADO } from './regras/conferencia';
export {
  empresaNova, normalizarEmpresa, lancamentosDe, periodo, rotuloPeriodo, competencias, jaTemNoPeriodo, soNovos,
  importar, excluirArquivo, linhasAuditoria, type ResultadoImportacao,
} from './regras/importacao';
export { EXTENSOES_EXTRATO, EXTENSOES_SISTEMA, abasDaPlanilha, lerArquivo } from './arquivos/leitura';
export { definirWorkerDoPdf, ehPdf, itensDoPdf } from './arquivos/pdf';
export type { RepoExtrator } from './repo';
export { arquivoDeTeste } from './regras/teste';
export { bancoDoArquivo, bancosNaCompetencia, bancosDaEmpresaNa, arquivosDoBanco, adicionarBanco } from './regras/bancos';
export {
  bancoOkNoPeriodo, situacaoDoBancoNoPeriodo, conferenciaDoBanco, diasNegativos, chequeEspecialNoRazao,
  type SituacaoDoBanco, type DiaNegativo, type ConferenciaDoBanco, type ChequeNoRazao,
} from './regras/situacaoDoBanco';
export { movimentoDoExtrato, TODOS_OS_MESES, extratosSemSaldoAnterior, definirSaldoAnterior, type LinhaDoMovimento, type MovimentoDoExtrato } from './regras/movimento';
export { requisitosDaImportacao, requisitosDoChequeEspecial, type ImportadosDaConferencia, type RequisitosDaImportacao } from './regras/requisitos';
export { correcoesDoRazao, ROTULO_CORRECAO, type CorrecaoDoRazao, type TipoCorrecao } from './regras/correcoes';
export { acharExtratoNoDrive, mensagemDaBuscaDoExtrato, type ContaProcurada } from './regras/drive';
export { gravacao, semMudanca, empresaDoBanco, type Gravacao, type DocEmpresaExtrator } from './regras/banco';
export { criarRepoExtratorMemoria, type Guarda } from './repo.memoria';
export {
  assuntoDoPedido, competenciaDoPedido, competenciasPorExtenso, linkDoWhatsApp, mesPorExtenso, rotuloDoBanco, telefoneParaWhatsApp, textoDoPedido,
  documentosDoPedido, textoDoWhatsApp, registrarPedido, prazoPadrao, dataPorExtenso, nomeComCompetencias,
  type BancoDoPedido, type CanalDoPedido, type PedidoDeExtratos, type DocumentoDoPedido,
} from './regras/pedido';
export { htmlDoPedido, type OpcoesDoEmail } from './regras/email';
export { EMPRESAS_EXEMPLO, empresasDeExemplo } from './__exemplos__/empresas';
