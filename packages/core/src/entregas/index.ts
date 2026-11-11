// O Drive e o Gmail do escritório pelo robô do Entregas (o mapa das pastas, a caixa do robô, os pedidos a ele):
// de todos os aplicativos (hoje, a Tarefas: Drive e Gmail).
export * from './drive';
export * from './secretario';
export * from './saude';
// o painel do robô (Cadastro › Painel do robô, 21/10/2026)
export * from './painelRobo';
// a saúde do banco (o site do admin, 21/10/2026)
export * from './saudeBanco';
// o arquivador novo (Admin › Arquivador, 22/10/2026)
export * from './arquivadorNovo';
export * from './gmail';
export * from './parcelamentos';
// a entrega de documentos aos clientes (a rota e o painel do Entregas, no nads desde 16/10/2026)
export * from './documentos';
export * from './guiasDoPdf';
export * from './rotaDeEntregas';
export * from './confirmacaoDaEntrega';
export * from './clienteDaEntrega';
export * from './numerosDasEntregas';
export * from './solicitacoes';
// o 13º do DP na rota (o botão "13º do DP" da Rota, 11/11/2026)
export * from './decimoDoDp';
export type * from './repo';
export { criarDriveDoEntregasMemoria, criarGmailDoEntregasMemoria } from './repo.memoria';
export * from './saudeDosRobos';
// a planilha aberta no navegador (Drive, 09/11/2026)
export * from './planilhaNoNavegador';
