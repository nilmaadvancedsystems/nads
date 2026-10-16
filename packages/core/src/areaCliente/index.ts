// @nads/core/areaCliente — Model da Área do Cliente (Vitor, 16/10/2026): o que o cliente vê (guias, agenda, recibos de envio,
// chamados) e as projeções com LISTA BRANCA de campos que o robô grava no espelho areasCliente/{token}. TypeScript puro.
export * from './guias';
export * from './agenda';
export * from './chamados';
export * from './envios';
export * from './vencimentos';

/** Quem o link mostra: as empresas, o contato do escritório e quando o robô atualizou. */
export interface ResumoDoCliente {
  empresas: { codigo: number; nome: string; cnpj: string }[];
  escritorio: { telefone?: string; email?: string; whatsapp?: string };
  /** ISO */
  atualizadoEm: string;
}

/** A raiz do espelho: as empresas do link (pode ser um grupo). */
export interface AreaDoCliente {
  codigos: number[];
  criadoEm: string;
  atualizadoEm: string;
}
