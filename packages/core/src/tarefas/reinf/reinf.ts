// A REINF do Fiscal (Vitor, 05/10/2026: "Heverton/REINF: observe o fluxo do Notion e monte um também"). No Notion, cada
// empresa obrigada tem o "Transmitido até" (o mês), a "Última transmissão" (sozinha, ao mexer) e as "Retificadas"; uma
// automação limpa o "Transmitido até" de todas no começo do mês (05/08, 00:00). Aqui não precisa limpar: na competência,
// a empresa está Transmitida se o "Transmitido até" chegou nela; senão, Pendente. Transmitir guarda o mês, quando e quem;
// Retificar acrescenta o mês nas retificadas. TypeScript puro: quem chama guarda o estado.

export interface UltimaTransmissao { em: string; por: string }

/** O estado da REINF de uma empresa. */
export interface EstadoReinf {
  codigo: number;
  /** 'aaaa-mm': até que competência já foi transmitida */
  transmitidoAte?: string;
  ultima?: UltimaTransmissao;
  /** 'aaaa-mm' de cada retificação */
  retificadas: string[];
}

export type SituacaoReinf = 'transmitida' | 'pendente';

export function situacaoReinf(e: EstadoReinf | undefined, competencia: string): SituacaoReinf {
  return e?.transmitidoAte && e.transmitidoAte >= competencia ? 'transmitida' : 'pendente';
}

/** Transmitiu a competência (nunca volta o "até" para trás). */
export function transmitirReinf(e: EstadoReinf, competencia: string, por: string, agora: Date): EstadoReinf {
  const ate = !e.transmitidoAte || competencia > e.transmitidoAte ? competencia : e.transmitidoAte;
  return { ...e, transmitidoAte: ate, ultima: { em: agora.toISOString(), por } };
}

/** Desfaz a transmissão da competência (marcou sem querer): o "até" volta para o mês anterior. */
export function desfazerReinf(e: EstadoReinf, competencia: string): EstadoReinf {
  if (!e.transmitidoAte || e.transmitidoAte < competencia) return e;
  const [a, m] = competencia.split('-').map(Number);
  const antes = m === 1 ? (a - 1) + '-12' : a + '-' + String(m - 1).padStart(2, '0');
  return { ...e, transmitidoAte: antes };
}

/** Retificou a competência (uma vez cada); de novo, tira. */
export function alternarRetificada(e: EstadoReinf, competencia: string, por: string, agora: Date): EstadoReinf {
  const tem = e.retificadas.includes(competencia);
  return { ...e, retificadas: tem ? e.retificadas.filter(c => c !== competencia) : [...e.retificadas, competencia].sort(), ultima: { em: agora.toISOString(), por } };
}

/** Quantas transmitidas e pendentes na competência. */
export function resumoReinf(estados: readonly EstadoReinf[], competencia: string): { transmitidas: number; pendentes: number; total: number } {
  const transmitidas = estados.filter(e => situacaoReinf(e, competencia) === 'transmitida').length;
  return { transmitidas, pendentes: estados.length - transmitidas, total: estados.length };
}

/**
 * As empresas da REINF e o estado como estava no Notion do Heverton em 05/10/2026 (o ponto de partida; depois quem
 * guarda é o nads). O nome é o do Notion, usado só se a empresa não estiver na lista do escritório.
 */
export const EMPRESAS_REINF: readonly { codigo: number; nome: string; transmitidoAte?: string; ultima?: string }[] = [
  { codigo: 10, nome: 'DORNAS HAVANA LTDA' }, { codigo: 49, nome: 'POSTO DE COMBUSTIVEIS ALTA FLORESTA LTDA' },
  { codigo: 55, nome: 'TORRA TORRA LTDA' }, { codigo: 66, nome: 'ADERLEI DOS SANTOS & CIA LTDA', transmitidoAte: '2026-08', ultima: '2026-08-28T19:02:40.261Z' },
  { codigo: 86, nome: 'BIBOKA EMBALAGENS LTDA' }, { codigo: 174, nome: 'ARMARINHO E PAPELARIA TAIOBEIRAS LTDA' },
  { codigo: 183, nome: 'CLEIA CRUZ DE OLIVEIRA' }, { codigo: 237, nome: 'POSTO DE COMBUSTIVEIS BERIZAL LTDA' },
  { codigo: 250, nome: 'BRASAO INDUSTRIA FLORESTAL LTDA' }, { codigo: 277, nome: 'G.A.S SERVICOS LABORATORIAIS LTDA' },
  { codigo: 279, nome: 'ALMEIDA & SOUZA PRODUTOS ALIMENTICIOS LTDA', transmitidoAte: '2026-08', ultima: '2026-08-28T19:02:40.644Z' },
  { codigo: 291, nome: 'G.A.S SAUDE DE DIVISA ALEGRE LTDA' }, { codigo: 292, nome: 'FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA' },
  { codigo: 298, nome: 'TEOBALDO MENDES DE OLIVEIRA LTDA' }, { codigo: 299, nome: 'TEOBALDO MENDES DE OLIVEIRA LTDA - FILIAL 02' },
  { codigo: 300, nome: 'TEOBALDO MENDES DE OLIVEIRA LTDA - FILIAL 03' }, { codigo: 301, nome: 'TEOBALDO MENDES DE OLIVEIRA LTDA - FILIAL 04' },
  { codigo: 356, nome: 'A7 COMERCIO DE VEICULOS LTDA', transmitidoAte: '2026-07', ultima: '2026-08-28T19:02:41.204Z' },
  { codigo: 360, nome: 'SUPERMERCADO CENTRAL DE BARREIROS LTDA' }, { codigo: 366, nome: 'SOLUS REFLORESTAMENTO LTDA' },
  { codigo: 380, nome: 'LEONARDO MENDES MARQUES' }, { codigo: 407, nome: 'DUDA HOME DE TAIOBEIRAS LTDA' },
  { codigo: 429, nome: 'POSTO DE COMBUSTIVEIS ANDRIELE LIMITADA' }, { codigo: 434, nome: 'CONSTRUNOVO LTDA' },
  { codigo: 444, nome: 'GALPAO VEICULOS E LOCADORA LTDA' }, { codigo: 455, nome: 'CENTRO DE ODONTOLOGIA E SAUDE DE TAIOBEIRAS LTDA' },
  { codigo: 463, nome: 'CENTRO DE ODONTOLOGIA ESTETICA LTDA' }, { codigo: 481, nome: 'B LIMA SERVICOS MEDICOS LTDA' },
  { codigo: 494, nome: 'CAIXA ESCOLAR JOVITA SECUNDINA REGO' },
  { codigo: 515, nome: 'A7 MOBILE LTDA', transmitidoAte: '2026-08', ultima: '2026-08-28T19:02:50.132Z' },
  { codigo: 521, nome: 'GALDUS PROJETOS INDUSTRIAIS LTDA' }, { codigo: 527, nome: 'GL MATERIAIS DE CONSTRUCAO LTDA' },
  { codigo: 532, nome: 'POUSADA, RESTAURANTE E PANIFICADORA JM- JOAO MANOEL LTDA' },
  { codigo: 544, nome: 'HELLO NUTRITION COMERCIO DE ALIMENTOS E BEBIDAS LTDA' }, { codigo: 545, nome: 'HELLO NUTRITION COMERCIO DE ALIMENTOS E BEBIDAS LTDA' },
  { codigo: 552, nome: 'CONSTRULAR MATERIAIS DE PINTURA E CONSTRUCAO LTDA' }, { codigo: 564, nome: 'HELLO NUTRITION COMERCIO DE ALIMENTOS E BEBIDAS LTDA - FILIAL' },
  { codigo: 579, nome: 'MORONI & XAVIER AUTOPECAS LTDA' }, { codigo: 585, nome: 'MORONI & XAVIER AUTOPECAS LTDA - FILIAL' },
  { codigo: 593, nome: 'CONSTRUTOP MATERIAIS DE CONSTRUCAO LTDA' }, { codigo: 597, nome: 'CONSTRU UNIAO MATERIAIS DE CONSTRUCAO LTDA' },
  { codigo: 599, nome: 'BIBOKA EMBALAGENS LTDA - FILIAL', transmitidoAte: '2026-08', ultima: '2026-09-20T19:15:01.389Z' },
];

/** O estado inicial (o do Notion) de cada empresa da REINF. */
export function estadosIniciaisReinf(): EstadoReinf[] {
  return EMPRESAS_REINF.map(e => ({
    codigo: e.codigo, retificadas: [],
    ...(e.transmitidoAte ? { transmitidoAte: e.transmitidoAte } : {}),
    ...(e.ultima ? { ultima: { em: e.ultima, por: 'Notion' } } : {}),
  }));
}
