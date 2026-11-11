// O Importador LCDPR (16/10/2026: "quero integrar no app o importador lcpr e o entregas, só que preciso que fique tudo no
// visual igual para não destoar do app"): o que era do lcdpr.html do Entregas, puro (sem tela e sem banco). Lê os
// relatórios do SIEG, classifica pelas regras de NCM, guarda as regras no lcdpr/config e monta a planilha .xls. Desde 11/11/2026, mês a mês (os lançamentos guardados, com a conta de pagamento) e puxando do SIEG.
export * from './tipos';
export { EMPRESAS_COM_LCDPR, temLcdpr } from './empresas';
export { MODELOS, configPadrao, itemEmBranco } from './padrao';
export {
  HISTORICO_SEM_REGRA, aplicarCategoria, aplicarModelo, aplicarRegraNosPendentes, categoriaDaConta, classificarCte, classificarNota, cpfCnpjFormatado,
  gruposParaRevisar, lancamentoDoDocumento, lancamentosVisiveis, ncmCompleto, ncmDoLancamento, porData, regraNoFiltro, regraQuePega, regraSugerida,
  semEntidades, soDigitos, umaLinha, type DocumentoDoSieg, type GrupoParaRevisar,
} from './classificar';
export { dataBr, dataDaCelula, fretesDoCte, lerRelatorio, linhasDoArquivo, notasDoDetalhamento, numeroDaCelula, numeroDoDocumento, serieNormal, tipoDoRelatorio, type LeituraDoRelatorio, type TipoDeRelatorio } from './relatorios';
export { ABA_DA_PLANILHA, COLUNAS_DA_PLANILHA, NOME_DA_PLANILHA, linhasDaPlanilha, planilhaDoLcdpr } from './planilha';
export {
  IMPORTACOES_GUARDADAS, alternarMes, aplicarContaCredora, baseDoMes, mesDoId, mesesAte, mesesDoAno, porMes, chaveDoLancamento, comContaDosFornecedores, contasDePagamento, contasDoDocumento, documentoDoMes, juntarNoMes,
  lancamentoGuardado, lembrarContas, marcaDaConta, mesDoDocumento, mesVazio, proximoIdDoMes, rotuloDaConta, situacaoDoMes,
  type ContasDosFornecedores, type ImportacaoDoMes, type MesDoLcdpr, type SituacaoDoMes,
} from './mes';
export {
  aplicarAutomatico, aplicarHistoricoPadrao, contasDaPesquisa, historicosDaPesquisa, imoveisDaPesquisa, lancamentoDoRascunho, mudarNoRascunho, nomeNaPesquisa, pesquisar,
  problemasDoRascunho, rascunhoDoLancamento, rascunhoNovo, type ContaDaEmpresa, type ItemDePesquisa, type RascunhoDoLancamento,
} from './manual';
export { cadastrosDoDocumento, cadastrosDoMovimento, cadastrosVazios, linhasDaPlanilhaDoMovimento, modeloDoHistorico, type CadastrosDoAlterdata, type ContaAprendida, type HistoricoAprendido } from './historicos';
export { RESUMO_DO_LCDPR, lerDoSieg, notaDoLancamento, resumoServeParaOLcdpr, type LeituraDoSieg } from './sieg';
export { NOME_DO_BACKUP, backupDaConfig, configDoBackup, configDoDocumento, documentoDaConfig } from './documento';
