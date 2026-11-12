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
  /** o que foi transmitido em cada competência ('aaaa-mm' → as séries), como o CheckList REINF do Alterdata */
  series?: Record<string, SerieReinf[]>;
}

/**
 * As partes da transmissão (Vitor, 12/11/2026, chamado KADMFS do Savio: "ao clicar em transmitir, aparece um submenu: 2000,
 * 4000, MIT"), as mesmas do CheckList REINF do Alterdata.
 */
export type SerieReinf = '2000' | '4000' | 'mit';
export const SERIES_REINF: readonly { id: SerieReinf; rotulo: string }[] = [
  { id: '2000', rotulo: 'Série 2000' }, { id: '4000', rotulo: 'Série 4000' }, { id: 'mit', rotulo: 'MIT' },
];

/** As séries transmitidas na competência, na ordem do Alterdata. */
export function seriesDaReinf(e: EstadoReinf | undefined, competencia: string): SerieReinf[] {
  const tem = e?.series?.[competencia] || [];
  return SERIES_REINF.map(s => s.id).filter(id => tem.includes(id));
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
  if (e.series?.[competencia]) { const series = { ...e.series }; delete series[competencia]; e = { ...e, series }; }
  if (!e.transmitidoAte || e.transmitidoAte < competencia) return e;
  const [a, m] = competencia.split('-').map(Number);
  const antes = m === 1 ? (a - 1) + '-12' : a + '-' + String(m - 1).padStart(2, '0');
  return { ...e, transmitidoAte: antes };
}

/**
 * Marca (ou tira) uma série da competência. A primeira série marcada transmite a competência; tirar a última desfaz.
 */
export function alternarSerieReinf(e: EstadoReinf, competencia: string, serie: SerieReinf, por: string, agora: Date): EstadoReinf {
  const antes = seriesDaReinf(e, competencia);
  const agoraSeries = antes.includes(serie) ? antes.filter(s => s !== serie) : [...antes, serie];
  const series = { ...(e.series || {}) };
  if (agoraSeries.length) series[competencia] = SERIES_REINF.map(s => s.id).filter(id => agoraSeries.includes(id));
  else delete series[competencia];
  const base = { ...e, series };
  if (agoraSeries.length) return transmitirReinf(base, competencia, por, agora);
  return desfazerReinf(base, competencia);
}

/** Transmitiu a competência com estas séries (as caixinhas do Transmitir; uma ou mais). Sem nenhuma, nada muda. */
export function transmitirSeriesReinf(e: EstadoReinf, competencia: string, series: readonly SerieReinf[], por: string, agora: Date): EstadoReinf {
  const ids = SERIES_REINF.map(s => s.id).filter(id => series.includes(id));
  if (!ids.length) return e;
  return transmitirReinf({ ...e, series: { ...(e.series || {}), [competencia]: ids } }, competencia, por, agora);
}

/** O rótulo curto das séries ("2000 · 4000 · MIT"), para a coluna da tela. */
export const rotuloDasSeries = (series: readonly SerieReinf[]) => series.map(s => (s === 'mit' ? 'MIT' : s)).join(' · ');

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
 * A empresa tem a REINF no Fiscal (Vitor, 05/11/2026: "todas as empresas tem reinf"): todas, sem olhar o regime (o que vem do
 * Entregas ou da Receita tirava empresas da lista) e com as filiais (05/11/2026: o Heverton tem 43 empresas, as 6 filiais
 * entram). Menos o empregador doméstico e a pessoa física (Vitor, 12/11/2026: "quem for doméstica e física, não precisa estar
 * na lista da REINF"), pelos regimes Domésticas e Física do Cadastro.
 */
export function temReinfNoFiscal(e: { codigo: number | null; nome: string; regime?: string }): boolean {
  if (e.codigo == null) return false;
  const regime = (e.regime || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return !/^(fisica|domesticas?)$/.test(regime);
}

/** As empresas da lista que têm a REINF no Fiscal, uma por código, em ordem de código. */
export function empresasDaReinf<T extends { codigo: number | null; nome: string; regime: string }>(lista: readonly T[]): (T & { codigo: number })[] {
  const vistos = new Set<number>();
  return lista.filter(e => temReinfNoFiscal(e) && !vistos.has(e.codigo as number) && !!vistos.add(e.codigo as number))
    .map(e => e as T & { codigo: number }).sort((a, b) => a.codigo - b.codigo);
}

/**
 * O estado da REINF como estava no Notion do Heverton em 05/10/2026 (o ponto de partida; depois quem guarda é o nads).
 * Desde 05/11/2026 quem tem a REINF é temReinfNoFiscal; esta lista só traz o que já estava transmitido.
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
  { codigo: 544, nome: 'HELLO NUTRITION COMERCIO DE ALIMENTOS E BEBIDAS LTDA' }, { codigo: 545, nome: 'HELLO NUTRITION COMERCIO DE ALIMENTOS E BEBIDAS LTDA - FILIAL 02' },
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
