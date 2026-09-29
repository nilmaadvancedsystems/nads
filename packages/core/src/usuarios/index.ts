// Usuários da Nilma — Model (packages/core): login pelo nome, departamento/nível, papéis do
// Entregas e quem pode o quê. TypeScript puro, sem banco: quem lê e grava usuarios/{uid} é a
// camada de dados de cada app (sempre o mesmo documento do Entregas).
export * from './tipos';
export * from './regras/login';
export * from './regras/papeis';
export * from './regras/acesso';
export * from './regras/conta';
export { EQUIPE_EXEMPLO } from './__exemplos__/equipe';
