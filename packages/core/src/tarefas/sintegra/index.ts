// O leitor do SINTEGRA (Vitor, 15/10/2026: "montar um leitor de sintegra"): o arquivo texto do Convênio ICMS 57/95, uma
// linha de 126 posições por registro. Lê o cabeçalho (10), as notas (50, com o IPI do 51 e a ST do 53), os conhecimentos
// de transporte (70) e os totais (90); junta as linhas 50 da mesma nota (uma por CFOP e alíquota); resume por
// entrada/saída e CFOP; aponta o que o validador recusaria; e confere com o SIEG (nota a nota, pela chave) e com o
// Alterdata (as Entradas e Saídas importadas, por CFOP e por nota). TypeScript puro: quem chama lê o arquivo.
import type { Nota } from '../../conferencia/tipos';
import type { NotaDoSieg } from '../sieg';

export interface CabecalhoSintegra {
  cnpj: string; ie: string; razao: string; municipio: string; uf: string;
  /** 'aaaa-mm-dd' */
  inicio: string; fim: string;
  convenio: string; natureza: string; finalidade: string;
}

/** Uma nota do SINTEGRA: as linhas 50 dela somadas (e o IPI e a ST, quando há). */
export interface NotaSintegra {
  /** o participante: o remetente nas entradas de terceiros, o destinatário nas saídas */
  cnpj: string; ie: string;
  /** 'aaaa-mm-dd' (emissão nas saídas, recebimento nas entradas) */
  data: string;
  uf: string; modelo: string; serie: string; numero: string;
  /** P = emissão própria, T = de terceiros */
  emitente: 'P' | 'T';
  entrada: boolean;
  /** N normal, S cancelada, E/X extemporânea, 2 denegada, 4 inutilizada */
  situacao: string;
  cfops: string[];
  valor: number; base: number; icms: number; isenta: number; outras: number;
  ipi: number; baseSt: number; icmsSt: number;
  /** quantas linhas 50 */
  linhas: number;
}

export interface ProblemaSintegra { linha: number; tipo: string; problema: string }

export interface ArquivoSintegra {
  cabecalho: CabecalhoSintegra | null;
  notas: NotaSintegra[];
  /** quantas linhas de cada tipo ('50', '54'…) */
  contagem: Record<string, number>;
  /** o que o registro 90 diz que tem, por tipo ('99' = o arquivo todo) */
  totais90: Record<string, number>;
  problemas: ProblemaSintegra[];
}

// ─── ler ──────────────────────────────────────────────────────────────────────

const pos = (l: string, de: number, ate: number) => l.slice(de - 1, ate);
const txt = (l: string, de: number, ate: number) => pos(l, de, ate).trim();
const num = (l: string, de: number, ate: number, casas = 2) => {
  const d = pos(l, de, ate).trim();
  return /^\d+$/.test(d) ? Number(d) / 10 ** casas : NaN;
};
const data = (aaaammdd: string) => (/^\d{8}$/.test(aaaammdd) ? aaaammdd.slice(0, 4) + '-' + aaaammdd.slice(4, 6) + '-' + aaaammdd.slice(6, 8) : '');
const dataValida = (iso: string) => {
  if (!iso) return false;
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return dt.getFullYear() === a && dt.getMonth() === m - 1 && dt.getDate() === d;
};
const semZeros = (s: string) => s.replace(/^0+/, '') || '0';

/** CNPJ (14) ou CPF (11, no SINTEGRA vem com 3 zeros na frente) com os dígitos certos; zeros = sem documento. */
export function documentoValido(d: string): boolean {
  if (/^0+$/.test(d)) return true;
  if (/^000\d{11}$/.test(d)) return cpfValido(d.slice(3)) || cnpjValido(d);
  return cnpjValido(d);
}
function cnpjValido(c: string): boolean {
  if (!/^\d{14}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (base: string) => { let s = 0, p = base.length - 7; for (const x of base) { s += Number(x) * p; p = p === 2 ? 9 : p - 1; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(c.slice(0, 12)) === Number(c[12]) && dv(c.slice(0, 13)) === Number(c[13]);
}
function cpfValido(c: string): boolean {
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (base: string) => { let s = 0; for (let i = 0; i < base.length; i++) s += Number(base[i]) * (base.length + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(c.slice(0, 9)) === Number(c[9]) && dv(c.slice(0, 10)) === Number(c[10]);
}

/** A chave que casa a mesma nota em outro lugar: quem emitiu + modelo + série + número (sem zeros). */
export function chaveDaNota(emissor: string, modelo: string, serie: string, numero: string): string {
  return [emissor.replace(/\D/g, '').padStart(14, '0'), String(Number(modelo) || 0).padStart(2, '0'), semZeros(serie.trim() || '0'), semZeros(numero)].join('|');
}

const TIPOS_CONHECIDOS = new Set(['10', '11', '50', '51', '53', '54', '55', '56', '57', '60', '61', '70', '71', '74', '75', '76', '77', '85', '86', '88', '90']);

/** Lê o arquivo do SINTEGRA (o texto inteiro). Nunca joga erro: o que estiver fora do layout vai para os problemas. */
export function lerSintegra(texto: string): ArquivoSintegra {
  const linhas = texto.replace(/\r\n?/g, '\n').split('\n');
  const problemas: ProblemaSintegra[] = [];
  const contagem: Record<string, number> = {};
  const totais90: Record<string, number> = {};
  let cabecalho: CabecalhoSintegra | null = null;
  const porChave = new Map<string, NotaSintegra>();
  const ordem: NotaSintegra[] = [];
  const ipi: { k: string; valor: number }[] = [];
  const st: { k: string; base: number; icms: number }[] = [];
  let anterior = '';

  linhas.forEach((l, i) => {
    const n = i + 1;
    if (!l.trim()) return;
    const tipo = l.slice(0, 2);
    contagem[tipo] = (contagem[tipo] || 0) + 1;
    const p = (problema: string) => problemas.push({ linha: n, tipo, problema });
    if (l.length !== 126) p('a linha tem ' + l.length + ' posições (o layout pede 126)');
    if (!TIPOS_CONHECIDOS.has(tipo)) { p('tipo de registro desconhecido'); return; }
    if (anterior && tipo < anterior) p('fora de ordem (o registro ' + tipo + ' veio depois do ' + anterior + ')');
    anterior = tipo;

    if (tipo === '10') {
      if (cabecalho) p('mais de um registro 10');
      const c: CabecalhoSintegra = {
        cnpj: txt(l, 3, 16), ie: txt(l, 17, 30), razao: txt(l, 31, 65), municipio: txt(l, 66, 95), uf: txt(l, 96, 97),
        inicio: data(pos(l, 108, 115)), fim: data(pos(l, 116, 123)), convenio: txt(l, 124, 124), natureza: txt(l, 125, 125), finalidade: txt(l, 126, 126),
      };
      cabecalho = c;
      if (!cnpjValido(c.cnpj)) p('o CNPJ da empresa (' + c.cnpj + ') não confere');
      if (!dataValida(c.inicio) || !dataValida(c.fim)) p('o período do arquivo tem data inválida');
      return;
    }

    if (tipo === '50') {
      const cnpj = txt(l, 3, 16), dt = data(pos(l, 31, 38)), cfop = txt(l, 52, 55), emitente = txt(l, 56, 56);
      const valores = { valor: num(l, 57, 69), base: num(l, 70, 82), icms: num(l, 83, 95), isenta: num(l, 96, 108), outras: num(l, 109, 121) };
      const cab = cabecalho as CabecalhoSintegra | null;
      if (!documentoValido(cnpj)) p('o CNPJ/CPF ' + cnpj + ' não confere');
      if (!dataValida(dt)) p('a data ' + pos(l, 31, 38) + ' é inválida');
      else if (cab && cab.inicio && cab.fim && (dt < cab.inicio || dt > cab.fim)) p('a data ' + dt.split('-').reverse().join('/') + ' está fora do período do arquivo');
      if (!/^[1-7]\d{3}$/.test(cfop)) p('o CFOP ' + cfop + ' é inválido');
      if (emitente !== 'P' && emitente !== 'T') p('o emitente deve ser P ou T (veio "' + emitente + '")');
      for (const [k, v] of Object.entries(valores)) if (Number.isNaN(v)) p('o campo ' + k + ' não é número');
      const nota: NotaSintegra = {
        cnpj, ie: txt(l, 17, 30), data: dt, uf: txt(l, 39, 40), modelo: txt(l, 41, 42), serie: txt(l, 43, 45), numero: txt(l, 46, 51),
        emitente: emitente === 'P' ? 'P' : 'T', entrada: /^[123]/.test(cfop), situacao: txt(l, 126, 126) || 'N', cfops: [cfop],
        valor: 0, base: 0, icms: 0, isenta: 0, outras: 0, ipi: 0, baseSt: 0, icmsSt: 0, linhas: 0,
      };
      const k = [nota.cnpj, nota.modelo, semZeros(nota.serie || '0'), semZeros(nota.numero), nota.emitente, nota.entrada ? 'E' : 'S'].join('|');
      const ja = porChave.get(k);
      const alvo = ja || nota;
      if (!ja) { porChave.set(k, nota); ordem.push(nota); } else if (!alvo.cfops.includes(cfop)) alvo.cfops.push(cfop);
      alvo.valor = r2(alvo.valor + (valores.valor || 0)); alvo.base = r2(alvo.base + (valores.base || 0)); alvo.icms = r2(alvo.icms + (valores.icms || 0));
      alvo.isenta = r2(alvo.isenta + (valores.isenta || 0)); alvo.outras = r2(alvo.outras + (valores.outras || 0));
      alvo.linhas++;
      return;
    }

    if (tipo === '51') { ipi.push({ k: [txt(l, 3, 16), semZeros(txt(l, 41, 43) || '0'), semZeros(txt(l, 44, 49))].join('|'), valor: num(l, 67, 79) || 0 }); return; }
    if (tipo === '53') { st.push({ k: [txt(l, 3, 16), semZeros(txt(l, 43, 45) || '0'), semZeros(txt(l, 46, 51))].join('|'), base: num(l, 57, 69) || 0, icms: num(l, 70, 82) || 0 }); return; }

    if (tipo === '70') {
      const cnpj = txt(l, 3, 16), dt = data(pos(l, 31, 38)), cfop = txt(l, 52, 55);
      if (!documentoValido(cnpj)) p('o CNPJ/CPF ' + cnpj + ' não confere');
      if (!dataValida(dt)) p('a data ' + pos(l, 31, 38) + ' é inválida');
      ordem.push({
        cnpj, ie: txt(l, 17, 30), data: dt, uf: txt(l, 39, 40), modelo: txt(l, 41, 42), serie: txt(l, 43, 43), numero: txt(l, 46, 51),
        emitente: 'T', entrada: /^[123]/.test(cfop), situacao: txt(l, 126, 126) || 'N', cfops: [cfop],
        valor: num(l, 56, 68) || 0, base: num(l, 69, 82) || 0, icms: num(l, 83, 96) || 0, isenta: num(l, 97, 110) || 0, outras: num(l, 111, 124) || 0,
        ipi: 0, baseSt: 0, icmsSt: 0, linhas: 1,
      });
      return;
    }

    if (tipo === '90') {
      if (!cabecalho) p('o registro 90 veio sem o 10');
      // de 31 a 125: até nove pares (tipo, 2 posições + total, 8 posições); o 99 é o total de linhas do arquivo
      for (let c = 31; c + 9 <= 125; c += 10) {
        const t = pos(l, c, c + 1), q = pos(l, c + 2, c + 9);
        if (!/^\d{2}$/.test(t) || !/^\d{8}$/.test(q)) continue;
        totais90[t] = (totais90[t] || 0) + Number(q);
      }
    }
  });

  // o IPI (51) e a ST (53) vão para a nota deles
  const daNota = (k: string) => ordem.find(o => [o.cnpj, semZeros(o.serie || '0'), semZeros(o.numero)].join('|') === k);
  for (const x of ipi) { const n = daNota(x.k); if (n) n.ipi = r2(n.ipi + x.valor); }
  for (const x of st) { const n = daNota(x.k); if (n) { n.baseSt = r2(n.baseSt + x.base); n.icmsSt = r2(n.icmsSt + x.icms); } }

  if (!cabecalho) problemas.unshift({ linha: 0, tipo: '10', problema: 'falta o registro 10 (o cabeçalho)' });
  if (!contagem['11']) problemas.push({ linha: 0, tipo: '11', problema: 'falta o registro 11 (o endereço)' });
  if (!contagem['90']) problemas.push({ linha: 0, tipo: '90', problema: 'falta o registro 90 (os totais)' });
  else {
    // o 90 confere com o que veio: cada tipo e o total de linhas (99)
    for (const [t, q] of Object.entries(totais90)) {
      if (t === '99') { const todas = Object.values(contagem).reduce((a, b) => a + b, 0); if (q !== todas) problemas.push({ linha: 0, tipo: '90', problema: 'o 90 diz ' + q + ' linhas no arquivo, mas tem ' + todas }); continue; }
      if ((contagem[t] || 0) !== q) problemas.push({ linha: 0, tipo: '90', problema: 'o 90 diz ' + q + ' registros ' + t + ', mas tem ' + (contagem[t] || 0) });
    }
    for (const t of Object.keys(contagem)) if (!['10', '11', '90'].includes(t) && !(t in totais90)) problemas.push({ linha: 0, tipo: '90', problema: 'o 90 não traz o total dos registros ' + t });
  }
  return { cabecalho, notas: ordem, contagem, totais90, problemas };
}

// ─── resumir ──────────────────────────────────────────────────────────────────

export interface LinhaDoResumo { cfop: string; notas: number; valor: number; base: number; icms: number; isenta: number; outras: number }
export interface LadoDoResumo { notas: number; valor: number; base: number; icms: number; porCfop: LinhaDoResumo[] }
export interface ResumoSintegra { entradas: LadoDoResumo; saidas: LadoDoResumo; canceladas: number }

function r2(n: number): number { return Math.round(n * 100) / 100; }

/** A nota conta nos valores: não está cancelada, denegada nem inutilizada. */
export const valeNoValor = (n: NotaSintegra) => !['S', 'X', '2', '4'].includes(n.situacao);

/** O resumo por entrada/saída e por CFOP (as canceladas, denegadas e inutilizadas ficam fora dos valores). */
export function resumirSintegra(arq: ArquivoSintegra): ResumoSintegra {
  const lado = (entrada: boolean): LadoDoResumo => {
    const notas = arq.notas.filter(n => n.entrada === entrada && valeNoValor(n));
    const porCfop = new Map<string, LinhaDoResumo>();
    for (const n of notas) {
      // a nota com mais de um CFOP conta no primeiro (o valor vem somado da nota inteira)
      const c = n.cfops[0];
      const x = porCfop.get(c) || { cfop: c, notas: 0, valor: 0, base: 0, icms: 0, isenta: 0, outras: 0 };
      x.notas++; x.valor = r2(x.valor + n.valor); x.base = r2(x.base + n.base); x.icms = r2(x.icms + n.icms); x.isenta = r2(x.isenta + n.isenta); x.outras = r2(x.outras + n.outras);
      porCfop.set(c, x);
    }
    return {
      notas: notas.length, valor: r2(notas.reduce((s, n) => s + n.valor, 0)), base: r2(notas.reduce((s, n) => s + n.base, 0)), icms: r2(notas.reduce((s, n) => s + n.icms, 0)),
      porCfop: [...porCfop.values()].sort((a, b) => a.cfop.localeCompare(b.cfop)),
    };
  };
  return { entradas: lado(true), saidas: lado(false), canceladas: arq.notas.filter(n => !valeNoValor(n)).length };
}

// ─── conferir com o SIEG ──────────────────────────────────────────────────────

export interface NotaSoNoSieg { numero: string; serie: string; nome: string; data: string; valor: number; entrada: boolean; chave: string }
export interface ConferenciaComSieg {
  /** no SIEG e não no SINTEGRA (a nota que faltou declarar) */
  soNoSieg: NotaSoNoSieg[];
  /** no SINTEGRA e não no SIEG (a nota que o SIEG não capturou, ou que não existe) */
  soNoSintegra: NotaSintegra[];
  valorDiferente: { numero: string; nome: string; noSintegra: number; noSieg: number }[];
  /** cancelada num lado e normal no outro */
  situacaoDiferente: { numero: string; noSintegra: string; noSieg: string }[];
  casadas: number;
}

/**
 * Nota a nota, pela chave (quem emitiu + modelo + série + número): as recebidas do SIEG com as entradas de terceiros, e as
 * emitidas com as notas próprias (emitente P, o CNPJ do registro 10). Só NF-e (55), NFC-e (65) e CT-e (57): a NFS-e não
 * vai para o SINTEGRA.
 */
export function conferirComSieg(arq: ArquivoSintegra, sieg: { emitidas: readonly NotaDoSieg[]; recebidas: readonly NotaDoSieg[] }): ConferenciaComSieg {
  const cnpjDaEmpresa = arq.cabecalho?.cnpj || '';
  const modeloDoTipo: Record<string, string> = { 'NF-e': '55', 'NFC-e': '65', 'CT-e': '57' };
  const doSintegra = new Map<string, NotaSintegra>();
  for (const n of arq.notas) {
    if (!['55', '65', '57'].includes(String(Number(n.modelo)).padStart(2, '0'))) continue;
    doSintegra.set(chaveDaNota(n.emitente === 'P' ? cnpjDaEmpresa : n.cnpj, n.modelo, n.serie, n.numero), n);
  }
  const vistas = new Set<string>();
  const res: ConferenciaComSieg = { soNoSieg: [], soNoSintegra: [], valorDiferente: [], situacaoDiferente: [], casadas: 0 };
  for (const [lista, entrada] of [[sieg.recebidas, true], [sieg.emitidas, false]] as const) {
    for (const s of lista) {
      const modelo = modeloDoTipo[s.tipo];
      if (!modelo) continue;
      // o emitente, o modelo, a série e o número de verdade estão na chave de acesso (7-20, 21-22, 23-25, 26-34)
      const k = /^\d{44}$/.test(s.chave)
        ? chaveDaNota(s.chave.slice(6, 20), s.chave.slice(20, 22), s.chave.slice(22, 25), s.chave.slice(25, 34))
        : chaveDaNota(s.emitente.doc, modelo, s.serie, s.numero);
      if (vistas.has(k)) continue;
      vistas.add(k);
      const n = doSintegra.get(k);
      const nome = (entrada ? s.emitente : s.destinatario).nome;
      if (!n) { if (!s.cancelada) res.soNoSieg.push({ numero: s.numero, serie: s.serie, nome, data: s.data, valor: Number(s.valor) || 0, entrada, chave: s.chave }); continue; }
      res.casadas++;
      if (!!s.cancelada !== !valeNoValor(n)) res.situacaoDiferente.push({ numero: s.numero, noSintegra: n.situacao, noSieg: s.cancelada ? 'cancelada' : 'normal' });
      else if (valeNoValor(n) && Math.abs(r2(n.valor) - r2(Number(s.valor) || 0)) > 0.01) res.valorDiferente.push({ numero: s.numero, nome, noSintegra: r2(n.valor), noSieg: r2(Number(s.valor) || 0) });
    }
  }
  for (const [k, n] of doSintegra) if (!vistas.has(k) && valeNoValor(n)) res.soNoSintegra.push(n);
  return res;
}

// ─── conferir com o Alterdata ─────────────────────────────────────────────────

export interface CfopComparado { cfop: string; notasSintegra: number; notasAlterdata: number; valorSintegra: number; valorAlterdata: number }
export interface ConferenciaComAlterdata {
  porCfop: CfopComparado[];
  /** no Alterdata e não no SINTEGRA (pelo número e o CNPJ/CPF) */
  soNoAlterdata: Nota[];
  soNoSintegra: NotaSintegra[];
}

/**
 * As Entradas e as Saídas importadas do Alterdata contra o SINTEGRA: por CFOP (quantas notas e o valor contábil) e nota a
 * nota (pelo número sem zeros e o CNPJ/CPF; sem documento num lado, só pelo número). O Alterdata não traz base nem ICMS.
 */
export function conferirComAlterdata(arq: ArquivoSintegra, entradas: readonly Nota[], saidas: readonly Nota[]): ConferenciaComAlterdata {
  const doc = (d?: string) => (d || '').replace(/\D/g, '').replace(/^0+(?=\d{11}$)/, '').replace(/^0+$/, '');
  const notas = arq.notas.filter(valeNoValor);
  const porCfop = new Map<string, CfopComparado>();
  const linha = (c: string) => porCfop.get(c) || { cfop: c, notasSintegra: 0, notasAlterdata: 0, valorSintegra: 0, valorAlterdata: 0 };
  for (const n of notas) { const x = linha(n.cfops[0]); x.notasSintegra++; x.valorSintegra = r2(x.valorSintegra + n.valor); porCfop.set(x.cfop, x); }
  const doAlterdata = [...entradas, ...saidas];
  for (const a of doAlterdata) { const c = (a.cfop || '').replace(/\D/g, '').slice(0, 4); if (!c) continue; const x = linha(c); x.notasAlterdata++; x.valorAlterdata = r2(x.valorAlterdata + (Number(a.valor) || 0)); porCfop.set(c, x); }

  const numero = (s: string) => semZeros((s || '').replace(/\D/g, ''));
  // o lado com documento casa pelo número e o documento; sem documento, só pelo número
  const casa = (nNum: string, nDoc: string, outros: { num: string; doc: string }[]) => outros.some(o => o.num === nNum && (!nDoc || !o.doc || o.doc === nDoc));
  const sint = notas.map(n => ({ num: numero(n.numero), doc: doc(n.cnpj) }));
  const alt = doAlterdata.filter(a => a.numero).map(a => ({ num: numero(a.numero), doc: doc(a.doc) }));
  const soNoAlterdata = doAlterdata.filter(a => a.numero && !casa(numero(a.numero), doc(a.doc), sint));
  const soNoSintegra = notas.filter(n => !casa(numero(n.numero), doc(n.cnpj), alt));
  return { porCfop: [...porCfop.values()].sort((a, b) => a.cfop.localeCompare(b.cfop)), soNoAlterdata, soNoSintegra };
}
