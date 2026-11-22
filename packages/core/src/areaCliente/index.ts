// @nads/core/areaCliente — Model da Área do Cliente (Vitor, 16/10/2026): o que o cliente vê (guias, agenda, recibos de envio,
// chamados) e as projeções com LISTA BRANCA de campos que o robô grava no espelho areasCliente/{token}. TypeScript puro.
export * from './guias';
export * from './leitorDeGuia';
export * from './agenda';
export * from './chamados';
export * from './envios';
export * from './vencimentos';
// "Já paguei: mandar o comprovante" na guia (plano do Acessórias, 17/11/2026, ficha comprovante-da-guia)
export * from './comprovanteDaGuia';
// o certificado A1 do cofre na Área do Cliente (plano do Acessórias, 17/11/2026, ficha certificado-digital)
export * from './certificado';
// o que falta o cliente mandar no mês (plano do Acessórias, 17/11/2026, ficha o-que-falta-mandar)
export * from './pendencias';
// o registro de abertura da guia (plano do Acessórias, 17/11/2026, ficha comprovante-de-leitura)
export * from './leitura';
// o lembrete de vencimento ao cliente (plano do Acessórias, 17/11/2026, ficha lembrete-de-vencimento)
export * from './lembretes';
// o e-mail quando o escritório responde (plano do Acessórias, 17/11/2026, ficha aviso-de-resposta, parte B)
export * from './avisoDeResposta';
// o acervo de documentos do escritório (plano do Acessórias, 17/11/2026, ficha documentos-do-escritorio)
export * from './documentosDoEscritorio';
// a ficha cadastral da empresa (plano do Acessórias, 17/11/2026, ficha dados-cadastrais)
export * from './ficha';
// as certidões da empresa (plano do Acessórias, 18/11/2026, ficha certidoes)
export * from './certidoes';
// o cliente confirma a entrega pela Área (plano do Acessórias, 18/11/2026, ficha confirmar-entrega)
export * from './entregaRecebida';
export * from './semMovimento';
export * from './recusa';
export * from './comunicados';
export * from './privacidade';
export * from './avaliacao';
export * from './guiaPaga';
export * from './parcelamentos';

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
export * from './pessoal';
export * from './dp';
export * from './folhaLida';
export * from './faturamento';
export * from './notasDoMes';
export * from './logo';
export * from './pedidoDeDanfe';
export * from './acessoPorPessoa';
export * from './emailDeSenha';
