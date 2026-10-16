// O Importador LCDPR (16/10/2026: "quero integrar no app o importador lcpr e o entregas, só que preciso que fique tudo no
// visual igual para não destoar do app"): o que era do lcdpr.html do Entregas, puro (sem tela e sem banco). Lê os
// relatórios do SIEG, classifica pelas regras de NCM, guarda as regras no lcdpr/config e monta a planilha .xls.
export * from './tipos';
export { MODELOS, configPadrao, itemEmBranco } from './padrao';
export {
  HISTORICO_SEM_REGRA, aplicarCategoria, aplicarModelo, aplicarRegraNosPendentes, categoriaDaConta, classificarCte, classificarNota, cpfCnpjFormatado,
  gruposParaRevisar, lancamentoDoDocumento, lancamentosVisiveis, ncmCompleto, ncmDoLancamento, porData, regraNoFiltro, regraQuePega, regraSugerida,
  soDigitos, umaLinha, type DocumentoDoSieg, type GrupoParaRevisar,
} from './classificar';
export { dataBr, dataDaCelula, fretesDoCte, lerRelatorio, linhasDoArquivo, notasDoDetalhamento, numeroDaCelula, numeroDoDocumento, serieNormal, tipoDoRelatorio, type LeituraDoRelatorio, type TipoDeRelatorio } from './relatorios';
export { ABA_DA_PLANILHA, COLUNAS_DA_PLANILHA, NOME_DA_PLANILHA, linhasDaPlanilha, planilhaDoLcdpr } from './planilha';
export { NOME_DO_BACKUP, backupDaConfig, configDoBackup, configDoDocumento, documentoDaConfig } from './documento';
