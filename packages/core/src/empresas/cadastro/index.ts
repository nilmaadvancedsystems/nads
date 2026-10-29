// Cadastro da empresa (contas bancárias, plano de contas, contas padrão) — de todos os aplicativos:
// a Tarefas edita; o Extrator e o Creditor leem.
export type * from './tipos';
export { BANCOS_DO_RELATORIO, DEPARTAMENTOS_DO_RESPONSAVEL, MAX_TEXTO_DO_FISCAL, PARAMETROS_FISCAIS, SEGMENTOS_FISCAIS } from './tipos';
export * from './regras';
export * from './plano';
export * from './entregas';
export * from './receita';
export * from './repo';
export { criarRepoCadastroMemoria, portaCadastroMemoria } from './repo.memoria';
