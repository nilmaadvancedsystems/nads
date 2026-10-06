// @nads/core/tarefas — Model da Tarefas: a rotina de cada departamento em etapas, o andamento de
// cada empresa na competência, o check automático, as objeções e a visão de cima. TypeScript puro.
export * from './tipos';
export { ROTINA_CONTABIL } from './rotinas/contabil';
export { ROTINA_FISCAL } from './rotinas/fiscal';
export { ROTINA_DP } from './rotinas/dp';
export { rotinaDo } from './rotinas/rotinaDo';
export * from './regras/execucao';
export * from './regras/verificacao';
export * from './regras/competencias';
export * from './regras/visao';
export * from './regras/quando';
export * from './regras/folha';
export * from './regras/razao';
export * from './regras/inss';
export { idDaExecucao, type RepoTarefas } from './repo';
export { criarRepoTarefasMemoria, execucoesDeExemplo, execucoesVariadas, type GuardaTarefas } from './repo.memoria';
export * from './reinf/reinf';
export * from './regras/deTeste';
export * as sieg from './sieg';
export * as painel from './painel';
