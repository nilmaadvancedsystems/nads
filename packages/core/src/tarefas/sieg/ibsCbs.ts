// A conferência do IBS/CBS das notas pela calculadora oficial da Receita (21/11/2026: os repositórios
// ReceitaFederal/calculadora-rtc-regime-regular e -simples-nacional, MIT). A calculadora (Java) roda no PC do servidor,
// só para o próprio PC; o robô do SIEG (robo/sieg-ibscbs.js) manda cada NF-e/NFC-e do mês para ela e grava o resumo no
// siegNotas do mês (o Fiscal já lê esse documento: nenhuma leitura a mais). Aqui, puro (roda no robô pelo
// robo/gerado/ibscbs.js e nos testes):
//   - notaParaConferir: lê do XML o grupo IBSCBS de cada item e monta o que vai para a calculadora — a operação
//     (POST /calculadora/observabilidade/regime-geral) e o recorte do XML só com os grupos de tributação
//     (POST /calculadora/xml/validate?subtipo=grupo). Cada item vai duas vezes na mesma operação: com a base da nota (os
//     valores: CST, cClassTrib, alíquotas, redução e valores) e, com outro número, só com os componentes da base
//     (gComponentesBC: a calculadora acha a base oficial, que é comparada com o vBC da nota);
//   - conferirNota: a resposta da calculadora x o que está na nota, campo a campo (valores com 1 centavo de folga,
//     alíquotas com 0,0001);
//   - resumoDaConferencia: as contagens e só as notas com divergência, cabendo no documento.
// Só NF-e e NFC-e emitidas a partir de 2026 (o ano de teste da CBS e do IBS). A NFS-e fica para depois.

export type LadoDaNota = 'emitida' | 'recebida';

/** Os valores do grupo IBSCBS de um item, como estão na nota (ou como a calculadora devolveu). */
export interface GrupoIbsCbs {
  cst: string; cClassTrib: string;
  /** sem o gIBSCBS (CST de imunidade, não incidência, monofásico...) */
  temValores: boolean;
  vBC: number;
  pIBSUF: number; vIBSUF: number; efetUF: number | null;
  pIBSMun: number; vIBSMun: number; efetMun: number | null;
  vIBS: number;
  pCBS: number; vCBS: number; efetCBS: number | null;
}

export interface ItemParaConferir {
  nItem: number; ncm: string; descricao: string;
  /** null = o item não tem o grupo IBSCBS */
  grupo: GrupoIbsCbs | null;
  /** monofásico, transferência de crédito, crédito presumido da ZFM: a calculadora não confere esses */
  outroGrupo: string;
  /** a base foi para a calculadora pelos componentes (false com Imposto Seletivo ou sem componentes) */
  conferirBase: boolean;
}

export interface NotaParaConferir {
  chave: string; numero: string; serie: string;
  tipo: 'NF-e' | 'NFC-e';
  /** dd/mm/aaaa */
  data: string;
  lado: LadoDaNota;
  /** a outra parte: o destinatário na emitida, o emitente na recebida */
  nome: string;
  /** o regime do emitente (CRT): 1 Simples, 2 Simples com excesso, 3 normal, 4 MEI */
  crt: string;
  itens: ItemParaConferir[];
  /** o total IBSCBSTot da nota (vIBS e vCBS), quando tem */
  total: { vIBS: number; vCBS: number } | null;
  /** o corpo de POST /calculadora/observabilidade/regime-geral; null = nada a calcular (sem grupo) */
  operacao: OperacaoDaCalculadora | null;
  /** o recorte para POST /calculadora/xml/validate?tipo=nfe|nfce&subtipo=grupo; '' = nada a validar */
  grupoXml: string;
  /** 'nfe' ou 'nfce' (o parâmetro tipo da validação) */
  tipoXml: 'nfe' | 'nfce';
}

export interface ItemDaOperacao {
  numero: number; ncm?: string; cst: string; cClassTrib: string;
  baseCalculo?: number; quantidade?: number; unidade?: string;
  gComponentesBC?: Record<string, number>;
  aliquotasNominais?: { cbs: number; ibsEstadual: number; ibsMunicipal: number };
}
export interface OperacaoDaCalculadora {
  id: string; versao: string; dhFatoGerador: string; municipio: number; uf: string; tpDoc: number; itens: ItemDaOperacao[];
}

/** O número do item que vai só com os componentes da base (o item da nota vai com o próprio nItem, até 990). */
export const NUMERO_DA_BASE = 1000;

// ---------------------------------------------------------------- a leitura do XML (sem DOM, como o danfe.ts)

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodificar = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTIDADES[e] ?? m));
const reTag = (nome: string, g = '') => new RegExp('<(?:\\w+:)?' + nome + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?' + nome + '>', g);
/** o conteúdo da primeira tag com este nome (com ou sem prefixo), ou '' */
function tag(x: string, nome: string): string { const m = reTag(nome).exec(x); return m ? m[1] : ''; }
/** a primeira tag inteira (com a abertura e o fechamento), ou '' */
function tagInteira(x: string, nome: string): string { const m = reTag(nome).exec(x); return m ? m[0] : ''; }
const texto = (x: string, nome: string) => decodificar(tag(x, nome).trim());
const num = (x: string, nome: string) => { const v = Number(tag(x, nome).trim()); return Number.isFinite(v) ? v : 0; };
const tem = (x: string, nome: string) => reTag(nome).test(x);
/** os det (com o nItem) */
function dets(x: string): { nItem: number; corpo: string; inteiro: string }[] {
  return [...x.matchAll(/<(?:\w+:)?det\s[^>]*nItem="(\d+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?det>/g)].map(m => ({ nItem: Number(m[1]), corpo: m[2], inteiro: m[0] }));
}

/** o código IBGE da UF (os 2 primeiros dígitos do município) → a sigla */
const UF_DO_CODIGO: Record<string, string> = {
  11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO', 21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA',
  31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC', 43: 'RS', 50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
};
export const ufDoMunicipio = (codigo: string): string => UF_DO_CODIGO[String(codigo).slice(0, 2)] || '';

const soDigitos = (v: string) => String(v || '').replace(/\D/g, '');
function dataBr(s: string): string { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim()); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }

/** o efetivo da redução (gRed/pAliqEfet) de um subgrupo, ou null sem redução */
function efetivo(sub: string): number | null { const r = tag(sub, 'gRed'); return r ? num(r, 'pAliqEfet') : null; }

/** O grupo IBSCBS de um item (o bloco de dentro do <IBSCBS>). */
export function lerGrupo(ibscbs: string): GrupoIbsCbs {
  const g = tag(ibscbs, 'gIBSCBS');
  const uf = tag(g, 'gIBSUF'), mun = tag(g, 'gIBSMun'), cbs = tag(g, 'gCBS');
  return {
    cst: texto(ibscbs, 'CST'), cClassTrib: texto(ibscbs, 'cClassTrib'), temValores: !!g,
    vBC: num(g, 'vBC'),
    pIBSUF: num(uf, 'pIBSUF'), vIBSUF: num(uf, 'vIBSUF'), efetUF: efetivo(uf),
    pIBSMun: num(mun, 'pIBSMun'), vIBSMun: num(mun, 'vIBSMun'), efetMun: efetivo(mun),
    vIBS: num(g, 'vIBS'),
    pCBS: num(cbs, 'pCBS'), vCBS: num(cbs, 'vCBS'), efetCBS: efetivo(cbs),
  };
}

const OUTROS_GRUPOS: [string, string][] = [['gIBSCBSMono', 'monofásico'], ['gTransfCred', 'transferência de crédito'], ['gCredPresIBSZFM', 'crédito presumido da ZFM']];

/** Os componentes da base de cálculo de um item (gComponentesBC), só os que têm valor. */
function componentesDaBase(det: string): Record<string, number> {
  const prod = tag(det, 'prod'), imp = tag(det, 'imposto');
  const icms = tag(imp, 'ICMS'), dest = tag(imp, 'ICMSUFDest');
  const c: Record<string, number> = {
    vProd: num(prod, 'vProd'), vFrete: num(prod, 'vFrete'), vSeg: num(prod, 'vSeg'), vOutro: num(prod, 'vOutro'), vDesc: num(prod, 'vDesc'),
    vII: num(tag(imp, 'II'), 'vII'), vIS: num(tag(imp, 'IS'), 'vIS'),
    vPIS: num(tag(imp, 'PIS'), 'vPIS'), vCOFINS: num(tag(imp, 'COFINS'), 'vCOFINS'),
    vICMS: num(icms, 'vICMS'), vFCP: num(icms, 'vFCP'), vICMSMono: num(icms, 'vICMSMono'),
    vICMSUFDest: num(dest, 'vICMSUFDest'), vFCPUFDest: num(dest, 'vFCPUFDest'),
  };
  return Object.fromEntries(Object.entries(c).filter(([, v]) => v > 0));
}

/**
 * Lê uma NF-e/NFC-e para a conferência. null quando não é NF-e/NFC-e, é de antes de 2026 ou não é do cliente (nem
 * emitida nem recebida por ele). cnpj: o documento do cliente (só os dígitos).
 */
export function notaParaConferir(xml: string, cnpj: string): NotaParaConferir | null {
  const m = /Id="NFe(\d{44})"/.exec(xml || '');
  if (!m) return null;
  const chave = m[1];
  const modelo = chave.slice(20, 22);
  if (modelo !== '55' && modelo !== '65') return null;
  const inf = tag(xml, 'infNFe');
  const ide = tag(inf, 'ide'), emit = tag(inf, 'emit'), dest = tag(inf, 'dest');
  const dhEmi = texto(ide, 'dhEmi') || texto(ide, 'dEmi');
  if (!/^\d{4}/.test(dhEmi) || Number(dhEmi.slice(0, 4)) < 2026) return null;
  const doc = soDigitos(cnpj);
  const docEmit = soDigitos(texto(emit, 'CNPJ') || texto(emit, 'CPF'));
  const docDest = soDigitos(texto(dest, 'CNPJ') || texto(dest, 'CPF'));
  const lado: LadoDaNota | null = doc && docEmit === doc ? 'emitida' : doc && docDest === doc ? 'recebida' : null;
  if (!lado) return null;
  const ano = Number(dhEmi.slice(0, 4));
  const municipio = texto(ide, 'cMunFG');
  const itens: ItemParaConferir[] = [];
  const daOperacao: ItemDaOperacao[] = [];
  const recortes: string[] = [];
  for (const d of dets(inf)) {
    const prod = tag(d.corpo, 'prod'), imp = tag(d.corpo, 'imposto');
    const ibscbs = tag(imp, 'IBSCBS');
    const ncm = texto(prod, 'NCM');
    const outro = OUTROS_GRUPOS.find(([g]) => tem(ibscbs, g))?.[1] || '';
    const grupo = ibscbs ? lerGrupo(ibscbs) : null;
    const comIs = tem(imp, 'IS');
    const componentes = componentesDaBase(d.corpo);
    const conferirBase = !!grupo?.temValores && !outro && !comIs && Object.keys(componentes).length > 0;
    itens.push({ nItem: d.nItem, ncm, descricao: texto(prod, 'xProd'), grupo, outroGrupo: outro, conferirBase });
    if (ibscbs) recortes.push('<det nItem="' + d.nItem + '"><imposto>' + tagInteira(imp, 'IS') + tagInteira(imp, 'IBSCBS') + '</imposto></det>');
    if (!grupo || outro || !grupo.cst || !grupo.cClassTrib) continue;
    const base: ItemDaOperacao = {
      numero: d.nItem, cst: grupo.cst, cClassTrib: grupo.cClassTrib,
      ...(ncm && !/^0+$/.test(ncm) ? { ncm } : {}),
      quantidade: num(prod, 'qCom') || 1, unidade: texto(prod, 'uCom') || 'UN',
      ...(ano >= 2027 && grupo.temValores ? { aliquotasNominais: { cbs: grupo.pCBS, ibsEstadual: grupo.pIBSUF, ibsMunicipal: grupo.pIBSMun } } : {}),
    };
    daOperacao.push({ ...base, baseCalculo: grupo.vBC });
    if (conferirBase) daOperacao.push({ ...base, numero: NUMERO_DA_BASE + d.nItem, gComponentesBC: componentes });
  }
  const tot = tag(tag(inf, 'total'), 'IBSCBSTot');
  const operacao: OperacaoDaCalculadora | null = daOperacao.length ? {
    id: chave, versao: '1.0.0', dhFatoGerador: dhEmi, municipio: Number(municipio) || 0, uf: ufDoMunicipio(municipio), tpDoc: Number(modelo), itens: daOperacao,
  } : null;
  const compraGov = tagInteira(ide, 'gCompraGov');
  const grupoXml = recortes.length
    ? '<infNFe xmlns="http://www.portalfiscal.inf.br/nfe">' + (compraGov ? '<ide>' + compraGov + '</ide>' : '') + recortes.join('')
      + '<total>' + tagInteira(tag(inf, 'total'), 'ISTot') + tagInteira(tag(inf, 'total'), 'IBSCBSTot') + '</total></infNFe>'
    : '';
  return {
    chave, numero: texto(ide, 'nNF'), serie: texto(ide, 'serie'), tipo: modelo === '65' ? 'NFC-e' : 'NF-e', data: dataBr(dhEmi), lado,
    nome: lado === 'emitida' ? texto(dest, 'xNome') || (modelo === '65' ? 'Consumidor' : '') : texto(emit, 'xNome'),
    crt: texto(emit, 'CRT'), itens,
    total: tot ? { vIBS: num(tag(tot, 'gIBS'), 'vIBS'), vCBS: num(tag(tot, 'gCBS'), 'vCBS') } : null,
    operacao, grupoXml, tipoXml: modelo === '65' ? 'nfce' : 'nfe',
  };
}

// ---------------------------------------------------------------- a resposta da calculadora

/** A validação do recorte: válido, ou a mensagem do erro (linha e coluna); null = não validou (a calculadora não respondeu). */
export type ValidacaoDoGrupo = { valido: true } | { valido: false; mensagem: string } | null;

/** Um objeto da resposta de /observabilidade/regime-geral (só o que a conferência usa). */
export interface ObjetoDaResposta {
  nObj: number;
  estadoItem: string;
  tribCalc?: { IBSCBS?: Record<string, unknown> };
  erros?: { code?: string; title?: string; detail?: string }[];
}
export interface RespostaDaCalculadora { objetos?: ObjetoDaResposta[] }

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const numero = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
function efetivoDaResposta(sub: Record<string, unknown>): number | null { const r = obj(sub.gRed); return 'pAliqEfet' in r ? numero(r.pAliqEfet) : null; }

/** O grupo IBSCBS que a calculadora devolveu, no mesmo formato do lido na nota. */
export function grupoDaResposta(ibscbs: Record<string, unknown>): GrupoIbsCbs {
  const g = obj(ibscbs.gIBSCBS), uf = obj(g.gIBSUF), mun = obj(g.gIBSMun), cbs = obj(g.gCBS);
  return {
    cst: String(ibscbs.CST ?? ''), cClassTrib: String(ibscbs.cClassTrib ?? ''), temValores: 'gIBSCBS' in ibscbs,
    vBC: numero(g.vBC),
    pIBSUF: numero(uf.pIBSUF), vIBSUF: numero(uf.vIBSUF), efetUF: efetivoDaResposta(uf),
    pIBSMun: numero(mun.pIBSMun), vIBSMun: numero(mun.vIBSMun), efetMun: efetivoDaResposta(mun),
    vIBS: numero(g.vIBS),
    pCBS: numero(cbs.pCBS), vCBS: numero(cbs.vCBS), efetCBS: efetivoDaResposta(cbs),
  };
}

// ---------------------------------------------------------------- a comparação

/** Uma diferença: o item (0 = a nota toda), o campo, o que está na nota e o que a calculadora diz. */
export interface Divergencia { item: number; campo: string; naNota: string; calculadora: string }

export type SituacaoIbsCbs = 'certa' | 'divergente' | 'semGrupo' | 'naoConferida';

export interface NotaConferida {
  chave: string; numero: string; tipo: 'NF-e' | 'NFC-e'; data: string; lado: LadoDaNota; nome: string;
  situacao: SituacaoIbsCbs;
  divergencias: Divergencia[];
  /** itens que a calculadora não conferiu (o motivo de cada) */
  naoConferidos: { item: number; motivo: string }[];
  /** o emitente é do Simples ou MEI (em 2026 o grupo não é exigido dele) */
  simples: boolean;
  /**
   * em 2026, a base (vBC) diferente da calculadora não é divergência, é aviso (22/11/2026: "Sim, separar"): a calculadora
   * tira o ICMS, o PIS e a COFINS da base e a maioria dos emissores ainda não; no ano de teste isso não muda imposto e
   * encobriria o que importa agora (cClassTrib, CST, redução, valores). De 2027 em diante é divergência como as outras
   */
  baseDiferente2026?: boolean;
}

const FOLGA_VALOR = 0.01;
const FOLGA_ALIQUOTA = 0.0001;
const reais = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + '%';
const efet = (v: number | null) => (v == null ? 'sem redução' : pct(v));

/** Os campos comparados: [rótulo, o valor, a folga, o formato]. */
const CAMPOS: [string, (g: GrupoIbsCbs) => number | null, number, (v: number | null) => string][] = [
  ['alíquota do IBS da UF', g => g.pIBSUF, FOLGA_ALIQUOTA, v => pct(v ?? 0)],
  ['alíquota efetiva do IBS da UF (redução)', g => g.efetUF, FOLGA_ALIQUOTA, efet],
  ['IBS da UF', g => g.vIBSUF, FOLGA_VALOR, v => reais(v ?? 0)],
  ['alíquota do IBS do município', g => g.pIBSMun, FOLGA_ALIQUOTA, v => pct(v ?? 0)],
  ['alíquota efetiva do IBS do município (redução)', g => g.efetMun, FOLGA_ALIQUOTA, efet],
  ['IBS do município', g => g.vIBSMun, FOLGA_VALOR, v => reais(v ?? 0)],
  ['IBS (total do item)', g => g.vIBS, FOLGA_VALOR, v => reais(v ?? 0)],
  ['alíquota da CBS', g => g.pCBS, FOLGA_ALIQUOTA, v => pct(v ?? 0)],
  ['alíquota efetiva da CBS (redução)', g => g.efetCBS, FOLGA_ALIQUOTA, efet],
  ['CBS', g => g.vCBS, FOLGA_VALOR, v => reais(v ?? 0)],
];
const difere = (a: number | null, b: number | null, folga: number) => (a == null || b == null ? a !== b : Math.abs(a - b) > folga + 1e-9);

/** O texto de um erro da calculadora (REG-011 NCM não vinculada...). */
const textoDoErro = (e: { code?: string; title?: string; detail?: string }) => [e.code, e.detail || e.title].filter(Boolean).join(' — ');

/**
 * A nota x a calculadora. resposta: a de /observabilidade/regime-geral (null = não respondeu); validacao: a do recorte
 * do XML. A nota sem o grupo em nenhum item fica 'semGrupo'; a que a calculadora não conseguiu ver, 'naoConferida'.
 */
export function conferirNota(nota: NotaParaConferir, resposta: RespostaDaCalculadora | null, validacao: ValidacaoDoGrupo): NotaConferida {
  const divergencias: Divergencia[] = [];
  const naoConferidos: { item: number; motivo: string }[] = [];
  const de2026 = nota.data.slice(6) === '2026';
  let baseDiferente2026 = false;
  const simples = nota.crt === '1' || nota.crt === '2' || nota.crt === '4';
  const base = { chave: nota.chave, numero: nota.numero, tipo: nota.tipo, data: nota.data, lado: nota.lado, nome: nota.nome, simples };
  const comGrupo = nota.itens.filter(i => i.grupo);
  if (!comGrupo.length) return { ...base, situacao: 'semGrupo', divergencias, naoConferidos };
  if (!resposta && nota.operacao) return { ...base, situacao: 'naoConferida', divergencias, naoConferidos: [{ item: 0, motivo: 'a calculadora não respondeu' }] };

  if (validacao && !validacao.valido) divergencias.push({ item: 0, campo: 'leiaute do grupo IBSCBS (XSD)', naNota: validacao.mensagem, calculadora: 'o grupo precisa seguir o leiaute' });
  const semGrupo = nota.itens.filter(i => !i.grupo).map(i => i.nItem);
  if (semGrupo.length) divergencias.push({ item: 0, campo: 'grupo IBSCBS', naNota: 'falta no' + (semGrupo.length === 1 ? ' item ' : 's itens ') + semGrupo.join(', '), calculadora: 'todo item da nota leva o grupo' });

  const porNumero = new Map((resposta?.objetos || []).map(o => [Number(o.nObj), o]));
  for (const it of comGrupo) {
    const g = it.grupo!;
    if (it.outroGrupo) { naoConferidos.push({ item: it.nItem, motivo: 'grupo ' + it.outroGrupo }); continue; }
    if (!g.cst || !g.cClassTrib) { divergencias.push({ item: it.nItem, campo: 'CST e cClassTrib', naNota: (g.cst || 'sem CST') + ' / ' + (g.cClassTrib || 'sem cClassTrib'), calculadora: 'os dois são obrigatórios' }); continue; }
    const o = porNumero.get(it.nItem);
    if (!o) { naoConferidos.push({ item: it.nItem, motivo: 'sem resposta da calculadora' }); continue; }
    if (o.estadoItem === 'INCONSISTENCIA_ENTRADA') {
      for (const e of o.erros || [{}]) divergencias.push({ item: it.nItem, campo: 'CST / cClassTrib / NCM', naNota: g.cst + ' / ' + g.cClassTrib + (it.ncm ? ' / NCM ' + it.ncm : ''), calculadora: textoDoErro(e) || 'a calculadora recusou o item' });
      continue;
    }
    if (o.estadoItem !== 'CALCULADO' && o.estadoItem !== 'CALCULO_SIMULADO') {
      naoConferidos.push({ item: it.nItem, motivo: (o.estadoItem === 'NAO_IMPLEMENTADO' ? 'a calculadora ainda não calcula este caso' : 'falha na calculadora') + ((o.erros || []).length ? ' (' + textoDoErro(o.erros![0]) + ')' : '') });
      continue;
    }
    const calc = grupoDaResposta(obj(o.tribCalc?.IBSCBS));
    if (calc.cst && calc.cst !== g.cst) divergencias.push({ item: it.nItem, campo: 'CST', naNota: g.cst, calculadora: calc.cst });
    if (calc.cClassTrib && calc.cClassTrib !== g.cClassTrib) divergencias.push({ item: it.nItem, campo: 'cClassTrib', naNota: g.cClassTrib, calculadora: calc.cClassTrib });
    if (calc.temValores !== g.temValores) {
      divergencias.push({ item: it.nItem, campo: 'grupo de valores (gIBSCBS)', naNota: g.temValores ? 'preenchido' : 'ausente', calculadora: calc.temValores ? 'deve ter' : 'não deve ter' });
      continue;
    }
    if (!g.temValores) continue;
    for (const [campo, valor, folga, formato] of CAMPOS) {
      const a = valor(g), b = valor(calc);
      if (difere(a, b, folga)) divergencias.push({ item: it.nItem, campo, naNota: formato(a), calculadora: formato(b) });
    }
    // a base: o item que foi só com os componentes (NUMERO_DA_BASE + nItem)
    const ob = it.conferirBase ? porNumero.get(NUMERO_DA_BASE + it.nItem) : undefined;
    if (ob && (ob.estadoItem === 'CALCULADO' || ob.estadoItem === 'CALCULO_SIMULADO')) {
      const bc = grupoDaResposta(obj(ob.tribCalc?.IBSCBS)).vBC;
      if (difere(g.vBC, bc, FOLGA_VALOR)) {
        if (de2026) baseDiferente2026 = true;
        else divergencias.push({ item: it.nItem, campo: 'base de cálculo (vBC)', naNota: reais(g.vBC), calculadora: reais(bc) });
      }
    } else if (ob && ob.estadoItem === 'INCONSISTENCIA_ENTRADA') {
      // a calculadora recusou os componentes da base (REG-023, "base negativa"): em 2026 é aviso, como a base diferente
      // (22/11/2026, no Presumido de outubro: 5 notas de um posto só com isso)
      if (de2026) { baseDiferente2026 = true; continue; }
      divergencias.push({ item: it.nItem, campo: 'base de cálculo (vBC)', naNota: reais(g.vBC), calculadora: textoDoErro((ob.erros || [{}])[0]) || 'a calculadora recusou os componentes da base' });
    }
  }

  // o total da nota (IBSCBSTot) x a soma dos itens
  if (nota.total) {
    const soma = (f: (g: GrupoIbsCbs) => number) => comGrupo.reduce((s, i) => s + (i.grupo!.temValores ? f(i.grupo!) : 0), 0);
    const vIBS = Math.round(soma(g => g.vIBS) * 100) / 100, vCBS = Math.round(soma(g => g.vCBS) * 100) / 100;
    if (difere(nota.total.vIBS, vIBS, FOLGA_VALOR)) divergencias.push({ item: 0, campo: 'total do IBS (IBSCBSTot)', naNota: reais(nota.total.vIBS), calculadora: 'soma dos itens: ' + reais(vIBS) });
    if (difere(nota.total.vCBS, vCBS, FOLGA_VALOR)) divergencias.push({ item: 0, campo: 'total da CBS (IBSCBSTot)', naNota: reais(nota.total.vCBS), calculadora: 'soma dos itens: ' + reais(vCBS) });
  }

  const situacao: SituacaoIbsCbs = divergencias.length ? 'divergente' : naoConferidos.length === comGrupo.length ? 'naoConferida' : 'certa';
  return { ...base, situacao, divergencias, naoConferidos, ...(baseDiferente2026 ? { baseDiferente2026 } : {}) };
}

// ---------------------------------------------------------------- o resumo do mês (no siegNotas)

export interface ContagemIbsCbs {
  conferidas: number; certas: number; divergentes: number; semGrupo: number; naoConferidas: number;
  /** das conferidas de 2026, quantas têm a base (vBC) diferente da calculadora (o aviso; ver baseDiferente2026) */
  baseDiferente2026: number;
}

/** siegNotas/{codigo}_{AAAA-MM}.ibsCbs: o que o robô gravou da conferência do mês. */
export interface ConferenciaIbsCbs {
  /** ISO: quando conferiu */
  em: string;
  /** a versão da calculadora da Receita que conferiu */
  versao: string;
  emitidas: ContagemIbsCbs;
  recebidas: ContagemIbsCbs;
  /** só as notas com divergência (e no máximo MAX_NOTAS) */
  notas: NotaConferida[];
  /** quantas notas divergentes ficaram de fora da lista (o limite do documento) */
  cortadas: number;
}

export const MAX_NOTAS = 150;
export const MAX_DIVERGENCIAS_POR_NOTA = 12;

const contagemVazia = (): ContagemIbsCbs => ({ conferidas: 0, certas: 0, divergentes: 0, semGrupo: 0, naoConferidas: 0, baseDiferente2026: 0 });

/** As notas conferidas do mês → o que vai para o siegNotas (as contagens e as divergentes, as emitidas primeiro). */
export function resumoDaConferencia(notas: readonly NotaConferida[], versao: string, em: string): ConferenciaIbsCbs {
  const emitidas = contagemVazia(), recebidas = contagemVazia();
  for (const n of notas) {
    const c = n.lado === 'emitida' ? emitidas : recebidas;
    if (n.baseDiferente2026) c.baseDiferente2026++;
    if (n.situacao === 'certa') { c.conferidas++; c.certas++; }
    else if (n.situacao === 'divergente') { c.conferidas++; c.divergentes++; }
    else if (n.situacao === 'semGrupo') c.semGrupo++;
    else c.naoConferidas++;
  }
  const divergentes = notas.filter(n => n.situacao === 'divergente')
    .sort((a, b) => (a.lado === b.lado ? 0 : a.lado === 'emitida' ? -1 : 1) || Number(a.numero) - Number(b.numero));
  return {
    em, versao, emitidas, recebidas,
    notas: divergentes.slice(0, MAX_NOTAS).map(n => ({ ...n, divergencias: n.divergencias.slice(0, MAX_DIVERGENCIAS_POR_NOTA), naoConferidos: n.naoConferidos.slice(0, 5) })),
    cortadas: Math.max(0, divergentes.length - MAX_NOTAS),
  };
}

/** O que o banco trouxe (siegNotas.ibsCbs) → ConferenciaIbsCbs, sem confiar no formato; null quando não há. */
export function lerConferenciaIbsCbs(v: unknown): ConferenciaIbsCbs | null {
  const d = obj(v);
  if (!d.em) return null;
  const cont = (x: unknown): ContagemIbsCbs => { const c = obj(x); return { conferidas: numero(c.conferidas), certas: numero(c.certas), divergentes: numero(c.divergentes), semGrupo: numero(c.semGrupo), naoConferidas: numero(c.naoConferidas), baseDiferente2026: numero(c.baseDiferente2026) }; };
  const notas = Array.isArray(d.notas) ? (d.notas as unknown[]).map(obj).map(n => ({
    chave: String(n.chave ?? ''), numero: String(n.numero ?? ''), tipo: (n.tipo === 'NFC-e' ? 'NFC-e' : 'NF-e') as NotaConferida['tipo'], data: String(n.data ?? ''),
    lado: (n.lado === 'recebida' ? 'recebida' : 'emitida') as LadoDaNota, nome: String(n.nome ?? ''), situacao: 'divergente' as SituacaoIbsCbs, simples: !!n.simples, ...(n.baseDiferente2026 ? { baseDiferente2026: true } : {}),
    divergencias: (Array.isArray(n.divergencias) ? n.divergencias : []).map(obj).map(x => ({ item: numero(x.item), campo: String(x.campo ?? ''), naNota: String(x.naNota ?? ''), calculadora: String(x.calculadora ?? '') })),
    naoConferidos: (Array.isArray(n.naoConferidos) ? n.naoConferidos : []).map(obj).map(x => ({ item: numero(x.item), motivo: String(x.motivo ?? '') })),
  })) : [];
  return { em: String(d.em), versao: String(d.versao ?? ''), emitidas: cont(d.emitidas), recebidas: cont(d.recebidas), notas, cortadas: numero(d.cortadas) };
}
