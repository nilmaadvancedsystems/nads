// Cadastro da empresa (contas bancárias, plano de contas, contas padrão) — de todos os aplicativos:
// a Tarefas edita; o Extrator e o Creditor leem.
export type * from './tipos';
export * from './regras';
export * from './plano';
export * from './entregas';
export * from './repo';
export { criarRepoCadastroMemoria, portaCadastroMemoria } from './repo.memoria';
