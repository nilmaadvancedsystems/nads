// nads → SCI (23/11/2026, docs/sci): o intermediário sem banco. Lê a planilha de importação que as telas do nads já
// baixam e a planilha de de/para das contas, e escreve a planilha que o gerador do SCI importa. E o ShadersCI: os planos
// padrão do SCI e a aba de lançamentos digitados, que sai na mesma planilha.
export * from './tipos';
export * from './regras/leitura';
export * from './regras/planilha';
export * from './regras/plano';
export * from './regras/lancamentos';
export * from './regras/historicos';
export * from './regras/dias';
export * from './regras/dePara';
export * from './regras/balancete';
export * from './regras/consulta';
export * from './regras/baixa';
// as provisões de cada conta do balancete e os pagamentos que faltam (27/11/2026)
export * from './regras/provisoes';
// Extrato → SCI no minimum (25/11/2026): o PDF do extrato vira a planilha do gerador do SCI
export * from './regras/extrato';
// as APIs da SCI (24/11/2026): config/sci, o Integra NET e a publicação no SCI Report
export * as integracao from './integracao';
