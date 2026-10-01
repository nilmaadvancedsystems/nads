// @nads/core/tarefas — Model da Tarefas: a rotina de cada departamento em etapas, o andamento de
// cada empresa na competência, o check automático, as objeções e a visão de cima. TypeScript puro.
export * from './tipos';
export { ROTINA_CONTABIL } from './rotinas/contabil';
export * from './regras/execucao';
export * from './regras/verificacao';
export * from './regras/competencias';
export * from './regras/visao';
export * from './regras/quando';
export * from './regras/folha';
export { idDaExecucao, type RepoTarefas } from './repo';
export { criarRepoTarefasMemoria, execucoesDeExemplo, execucoesVariadas, type GuardaTarefas } from './repo.memoria';
