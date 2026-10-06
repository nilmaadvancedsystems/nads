// @nads/core/conversor — Model do Conversor: lê o extrato do banco (PDF, OFX, planilha) e gera o .xls no layout do
// escritório (Data Lançamento · Valor Lançamento · Descrição Histórico · Finalidade de operação). Sem banco de dados.
export type { LinhaConvertida, Leitor, ExtratoConvertido } from './tipos';
export { ehExtratoDoBancoDoBrasil, lancamentosDoBancoDoBrasil } from './regras/bancoDoBrasil';
export { bancoDoTexto, marcaDoBanco, mesDoExtrato, bancoNoNomeDoArquivo, nomeDoXls, NOMES_DE_BANCO } from './regras/arquivo';
export { CABECALHO, nomeDaAba, fluxoDoLivro, planilhaDoExtrato, TIPO_XLS } from './arquivos/xls';
export { EXTENSOES_CONVERSOR, converterArquivo } from './arquivos/leitura';
