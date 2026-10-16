// O Drive e o Gmail do escritório pelo robô do Entregas (o mapa das pastas, a caixa do robô, os pedidos a ele):
// de todos os aplicativos (hoje, a Tarefas: Drive e Gmail).
export * from './drive';
export * from './secretario';
export * from './saude';
export * from './gmail';
// a entrega de documentos aos clientes (a rota e o painel do Entregas, no nads desde 16/10/2026)
export * from './documentos';
export type * from './repo';
export { criarDriveDoEntregasMemoria, criarGmailDoEntregasMemoria } from './repo.memoria';
