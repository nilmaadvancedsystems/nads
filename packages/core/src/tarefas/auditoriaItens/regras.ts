// A auditoria tributária dos itens (04/11/2026: o prompt "Gestor Fiscal e Auditor Tributário" virou ferramenta do Fiscal):
// cada item (NCM, descrição e, quando vierem, CFOP, CST/CSOSN e CEST) ganha o PIS/COFINS federal (monofásico, alíquota
// zero ou tributado integralmente, com o CST de saída sugerido e a lei) e o ICMS-ST de Minas (RICMS/MG, Decreto nº
// 48.589/2023, Anexo VII), mais o diagnóstico combinado. TypeScript puro.
//
// O ICMS-ST: o documento vale mais que o NCM. CFOP 1403/5405, CST 10/30/60/70 ou CSOSN 201/202/203/500 é ST (a mercadoria
// veio com retenção ou antecipação); CFOP 5102, CST 00/20 ou CSOSN 101/102 é o regime normal. Sem nada disso no item, vale
// o NCM nos capítulos do Anexo VII (a lista aqui é o resumo dos principais NCMs de cada capítulo: a dupla conformidade, NCM
// e descrição, se confere no anexo) e, na falta, o CEST.

export interface ItemParaAuditar {
  ncm: string;
  descricao: string;
  cfop?: string;
  /** o CST do ICMS (com ou sem a origem na frente) */
  cst?: string;
  csosn?: string;
  cest?: string;
}

export type Diagnostico = 'Ambos' | 'Somente ST' | 'Somente Monofásico' | 'Não';
export type RegimePisCofins = 'Monofásico' | 'Alíquota Zero' | 'Tributado Integralmente';

export interface Auditoria {
  monofasico: boolean;
  st: boolean;
  diagnostico: Diagnostico;
  regime: RegimePisCofins;
  /** o CST de saída sugerido do PIS/COFINS: 04, 05, 06, 01 ou 49 */
  cstPisCofins: string;
  basePisCofins: string;
  segmentoSt: string;
  baseSt: string;
  /** de onde saiu o ICMS-ST: o documento (CFOP/CST/CSOSN), o NCM no Anexo VII, o CEST ou nada */
  origemSt: 'documento' | 'ncm' | 'cest' | 'nenhuma';
}

/** só os dígitos */
export const digitos = (s: unknown) => String(s ?? '').replace(/\D/g, '');

/** o NCM com 8 dígitos (o Excel come o zero da frente: 2011000 é 02011000); vazio se não parece NCM */
export function ncmLimpo(s: unknown): string {
  const d = digitos(s);
  if (!d || d.length > 8) return '';
  return d.length === 7 ? '0' + d : d;
}

const comeca = (ncm: string, prefixos: readonly string[]) => prefixos.some(p => ncm.startsWith(p));

// ---------------------------------------------------------------- PIS e COFINS

interface RegraPis { prefixos: readonly string[]; exceto?: readonly string[]; regime: RegimePisCofins; cst: string; base: string }

const LEI_10147 = 'Lei nº 10.147/2000, art. 1º, I, "a"';
const LEI_10925 = 'Lei nº 10.925/2004, art. 1º';

const REGRAS_PIS: readonly RegraPis[] = [
  // monofásicos
  { prefixos: ['3303', '3304', '3305', '3306', '3307'], exceto: ['330741', '330749'], regime: 'Monofásico', cst: '04', base: LEI_10147 + ' (perfumaria, cosméticos e higiene pessoal)' },
  { prefixos: ['340111', '34012010', '34013000'], regime: 'Monofásico', cst: '04', base: LEI_10147 + ' (sabonetes)' },
  { prefixos: ['96032100'], regime: 'Monofásico', cst: '04', base: LEI_10147 + ' (escovas dentárias)' },
  { prefixos: ['2201', '2202', '2203'], regime: 'Monofásico', cst: '04', base: 'Lei nº 13.097/2015, arts. 14 a 28 (bebidas frias)' },
  { prefixos: ['2710'], regime: 'Monofásico', cst: '04', base: 'Lei nº 9.718/1998 e Lei nº 10.865/2004 (combustíveis e lubrificantes; CST 061 do ICMS na cobrança anterior do combustível monofásico)' },
  { prefixos: ['4011', '4013'], regime: 'Monofásico', cst: '04', base: 'Lei nº 10.485/2002, art. 5º (pneus e câmaras de ar)' },
  { prefixos: ['8708', '8544', '8511', '8512', '8507', '8409', '8421', '8482', '8483', '8484', '8536'], regime: 'Monofásico', cst: '04', base: 'Lei nº 10.485/2002, Anexos I e II (autopeças)' },
  { prefixos: ['2402'], regime: 'Monofásico', cst: '05', base: 'Lei nº 9.532/1997, art. 53 (cigarros, substituição tributária)' },
  // alíquota zero
  { prefixos: ['02', '03'], regime: 'Alíquota Zero', cst: '06', base: LEI_10925 + ', XIX e XX (carnes, aves e pescados)' },
  { prefixos: ['0401', '0402', '0406', '0713', '090121', '1005', '110220', '1104', '1101', '1507', '151710', '190211', '190219', '19059010'], regime: 'Alíquota Zero', cst: '06', base: LEI_10925 + ' (cesta básica)' },
  { prefixos: ['9619'], regime: 'Alíquota Zero', cst: '06', base: LEI_10925 + ', XXIII, e Decreto nº 11.439/2023 (absorventes higiênicos)' },
  { prefixos: ['4901', '4903'], regime: 'Alíquota Zero', cst: '06', base: 'Lei nº 10.865/2004, art. 28, VI (livros)' },
];

// ---------------------------------------------------------------- ICMS-ST de Minas (Anexo VII, Parte 2)

interface CapituloSt { capitulo: number; nome: string; prefixos: readonly string[]; exceto?: readonly string[] }

const CAPITULOS_ST: readonly CapituloSt[] = [
  { capitulo: 1, nome: 'Autopeças', prefixos: ['4009', '4010', '401693', '7007', '700910', '830120', '8409', '841330', '841520', '842123', '842131', '8482', '8483', '8484', '8507', '8511', '8512', '853910', '854430', '8708', '9029', '9104'] },
  { capitulo: 2, nome: 'Bebidas alcoólicas, exceto cerveja e chope', prefixos: ['2204', '2205', '2206', '2208'] },
  { capitulo: 3, nome: 'Cervejas, chopes, refrigerantes, águas e outras bebidas', prefixos: ['2201', '2202', '2203', '21069010'] },
  { capitulo: 4, nome: 'Cigarros e outros produtos do fumo', prefixos: ['2402', '2403'] },
  { capitulo: 8, nome: 'Ferramentas', prefixos: ['6804', '8202', '8203', '8204', '8205', '8206', '8207', '8467'] },
  { capitulo: 9, nome: 'Lâmpadas, reatores e starters', prefixos: ['8539', '850410'] },
  { capitulo: 10, nome: 'Materiais de construção e congêneres', prefixos: ['2523', '3214', '3916', '3917', '3918', '3922', '3925', '6810', '6907', '6910', '7214', '7217', '7308', '7317', '7318', '7324', '8301', '8302', '8481'] },
  { capitulo: 11, nome: 'Materiais de limpeza e inseticidas', prefixos: ['282890', '330749', '3402', '3405', '3808'] },
  { capitulo: 12, nome: 'Materiais elétricos', prefixos: ['8535', '8536', '8537', '8538', '8544'] },
  { capitulo: 13, nome: 'Medicamentos e curativos', prefixos: ['3001', '3002', '3003', '3004', '3005', '3006', '401410', '901831', '901832'] },
  { capitulo: 15, nome: 'Pneus e câmaras de ar', prefixos: ['4011', '4012', '4013'] },
  { capitulo: 18, nome: 'Perfumaria, cosméticos e higiene pessoal', prefixos: ['3303', '3304', '3305', '3306', '3307', '3401', '481810', '481820', '96032100', '9619'], exceto: ['330741', '330749'] },
  { capitulo: 20, nome: 'Rações para animais domésticos', prefixos: ['230910'] },
  { capitulo: 21, nome: 'Sorvetes', prefixos: ['2105'] },
  { capitulo: 22, nome: 'Tintas, vernizes e outros', prefixos: ['3208', '3209', '3210', '3212', '3814'] },
];

const RICMS = 'RICMS/MG (Decreto nº 48.589/2023)';

/** o capítulo do Anexo VII em que o NCM está (o primeiro que casa), ou null */
export function capituloDoNcm(ncm: string): CapituloSt | null {
  if (!ncm) return null;
  return CAPITULOS_ST.find(c => comeca(ncm, c.prefixos) && !comeca(ncm, c.exceto ?? [])) ?? null;
}

const CFOP_ST = new Set(['1401', '1403', '1409', '1411', '2401', '2403', '2409', '2411', '5401', '5402', '5403', '5405', '5409', '5411', '6401', '6402', '6403', '6404', '6409', '6411']);
const CFOP_NORMAL = new Set(['1101', '1102', '2101', '2102', '5101', '5102', '6101', '6102', '6108']);
const CST_ST = new Set(['10', '30', '60', '70']);
const CST_NORMAL = new Set(['00', '20']);
const CSOSN_ST = new Set(['201', '202', '203', '500']);
const CSOSN_NORMAL = new Set(['101', '102', '103']);
const CSOSNS = new Set(['101', '102', '103', '201', '202', '203', '300', '400', '500', '900']);

/** o CSOSN e o CST do ICMS do item: o 3 dígitos que é CSOSN (101…900) vira CSOSN; o CST fica nos 2 últimos dígitos */
function situacao(item: ItemParaAuditar): { cst: string; csosn: string } {
  let csosn = digitos(item.csosn);
  let cst = digitos(item.cst);
  if (!csosn && cst.length === 3 && CSOSNS.has(cst)) { csosn = cst; cst = ''; }
  return { cst: cst.length >= 2 ? cst.slice(-2) : '', csosn };
}

/** o que o documento diz do ICMS-ST: 'st', 'normal' ou null (não diz) e o porquê */
function stPeloDocumento(item: ItemParaAuditar): { st: boolean; porque: string } | null {
  const cfop = digitos(item.cfop).slice(0, 4);
  const { cst, csosn } = situacao(item);
  const marcas: string[] = [];
  if (CFOP_ST.has(cfop)) marcas.push('CFOP ' + cfop);
  if (CST_ST.has(cst)) marcas.push('CST ' + cst);
  if (CSOSN_ST.has(csosn)) marcas.push('CSOSN ' + csosn);
  if (marcas.length) return { st: true, porque: marcas.join(' / ') };
  if (CFOP_NORMAL.has(cfop)) marcas.push('CFOP ' + cfop);
  if (CST_NORMAL.has(cst)) marcas.push('CST ' + cst);
  if (CSOSN_NORMAL.has(csosn)) marcas.push('CSOSN ' + csosn);
  if (marcas.length) return { st: false, porque: marcas.join(' / ') };
  return null;
}

/** o CEST no formato 00.000.00 */
const cestFormatado = (c: string) => (c.length === 7 ? c.slice(0, 2) + '.' + c.slice(2, 5) + '.' + c.slice(5) : c);

export function diagnosticoDe(monofasico: boolean, st: boolean): Diagnostico {
  return monofasico && st ? 'Ambos' : monofasico ? 'Somente Monofásico' : st ? 'Somente ST' : 'Não';
}

/** A auditoria de um item. */
export function auditarItem(item: ItemParaAuditar): Auditoria {
  const ncm = ncmLimpo(item.ncm);
  // PIS/COFINS
  const pis = ncm ? REGRAS_PIS.find(r => comeca(ncm, r.prefixos) && !comeca(ncm, r.exceto ?? [])) : undefined;
  const cfop = digitos(item.cfop);
  const regime: RegimePisCofins = pis?.regime ?? 'Tributado Integralmente';
  const monofasico = regime === 'Monofásico';
  // fora das vendas (remessas, devoluções, outras saídas: CFOP x9xx), o CST 49 no lugar do 01
  const cstPisCofins = pis ? pis.cst : /^[56]9/.test(cfop) ? '49' : '01';
  const basePisCofins = pis?.base ?? (ncm ? 'Regime geral: Lei nº 10.637/2002 (PIS) e Lei nº 10.833/2003 (COFINS); ou Lei nº 9.715/1998 e Lei nº 9.718/1998 no cumulativo' : 'Sem NCM no item');

  // ICMS-ST
  const cap = capituloDoNcm(ncm);
  const doc = stPeloDocumento(item);
  const cest = digitos(item.cest);
  let st = false;
  let segmentoSt: string;
  let baseSt: string;
  let origemSt: Auditoria['origemSt'];
  if (doc) {
    st = doc.st;
    origemSt = 'documento';
    if (doc.st) {
      segmentoSt = cap ? 'Cap. ' + cap.capitulo + ' — ' + cap.nome : 'Revenda com ST/antecipação' + (cest ? ' (CEST ' + cestFormatado(cest) + ')' : '');
      baseSt = RICMS + ', Anexo VII — mercadoria com ICMS retido ou antecipado (' + doc.porque + ')';
    } else {
      segmentoSt = 'Regime normal (' + doc.porque + ')';
      baseSt = cap
        ? 'O NCM consta no Cap. ' + cap.capitulo + ' do Anexo VII do ' + RICMS + ', mas o documento é de operação própria: confira a entrada'
        : RICMS + ' — operação própria, sem substituição tributária';
    }
  } else if (cap) {
    st = true;
    origemSt = 'ncm';
    segmentoSt = 'Cap. ' + cap.capitulo + ' — ' + cap.nome;
    baseSt = RICMS + ', Anexo VII, Parte 2, Cap. ' + cap.capitulo + ' (pelo NCM: confira a descrição no anexo)';
  } else if (cest) {
    st = true;
    origemSt = 'cest';
    segmentoSt = 'Item com CEST ' + cestFormatado(cest);
    baseSt = RICMS + ', Anexo VII — o CEST indica ST: confira o item no anexo';
  } else {
    origemSt = 'nenhuma';
    segmentoSt = ncm ? 'Fora do Anexo VII' : 'Sem NCM no item';
    baseSt = ncm ? RICMS + ' — NCM fora dos capítulos do Anexo VII (ou ST revogada em MG)' : 'Sem NCM no item';
  }

  return { monofasico, st, diagnostico: diagnosticoDe(monofasico, st), regime, cstPisCofins, basePisCofins, segmentoSt, baseSt, origemSt };
}
