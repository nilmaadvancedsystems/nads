// @nads/core/conciliadorzinho — Model do Conciliadorzinho (extratos de cartão × notas de venda).
// Origem: contabil-htmls/conciliadorZINHO.html (IIFE a partir de ~L759). TypeScript puro:
// sem React, sem tela, sem banco. Mesma entrada, mesma saída que o original
// (conferido em __legado__/paridade.test.ts).
export type {
  IdBandeira, Bandeira, Mes, MesContagem, Transacao, Venda, LinhaConciliada, ResultadoBandeira, Conciliacao,
  TotalDoMes, Contas, LinhaArquivo, SaidaDoMes,
} from './tipos';
export { BANDEIRAS, bandeira } from './tabelas/bandeiras';
export {
  rotuloMes, brl, valorBR, pad2, chaveDaData, campoCsv, dataDoSerialExcel, lerDataFlexivel, lerNumeroFlexivel,
  limparHistorico, notaDoHistorico,
} from './regras/formatos';
export { contarMeses, chaveMes, chaveMesDaData, slugMeses, compararMeses } from './regras/meses';
export { ordemDasBandeiras, conciliar, HISTORICO_BRUTO_COM_NOTA, HISTORICO_BRUTO_SEM_NOTA, HISTORICO_TAXA } from './regras/conciliacao';
export { conferirTotais, totaisPorMes, TOLERANCIA } from './regras/totais';
export { linhasDaBandeira, saidasPorMes, nomeBaseBandeira, contaCaixa, CAIXA_PADRAO } from './regras/linhas';
export { EXTENSOES_EXTRATO, EXTENSOES_VENDAS, extensaoValida, lerExtrato, lerVendas } from './arquivos/leitura';
export { planilhaXls, textoCsv, formatoDoValor, LINHAS_EM_BRANCO } from './arquivos/exportar';
