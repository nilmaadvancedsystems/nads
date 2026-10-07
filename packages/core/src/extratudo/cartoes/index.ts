// @nads/core/cartoes — Model do Cartões (Extratudo): a fatura do cartão de crédito empresarial quebrada no razão do
// cartão (D Cartão de Crédito / C Banco), no dia em que o banco pagou. TypeScript puro.
export * from './regras/fatura';
export * from './regras/lancamentos';
export { planilhaDeImportacao, TIPO_XLS, type LinhaDeImportacao } from '../creditor/arquivos/gerar';
