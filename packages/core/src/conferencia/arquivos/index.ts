// Leitura dos arquivos que o escritório importa (tudo no navegador, nada sai da máquina).
// Origem: conferencia.html sheet/acha/col (~L1533-1563), lerNotas (~L1564),
// classificarGrupo/lerBalancete (~L1585-1617), lerServicos (~L4275), vcLerRazao (~L3901).
import * as XLSX from 'xlsx';
import { comp, normExportado, num } from '../../formatos';
import type { Conta, Grupo, Nota, NotaServico, TipoServico } from '../tipos';
import type { LinhaRazao } from '../regras/verificarConta';

export type Linhas = string[][];

/** Primeira aba da planilha como linhas de texto (xls, xlsx, csv, ods). */
export function lerPlanilha(buf: ArrayBuffer): Linhas {
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array', raw: false });
  return XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false, blankrows: false });
}

/** Linha do cabeçalho: a primeira (até a 40ª) que tem todos os trechos. */
export function acharCabecalho(rows: Linhas, trechos: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const low = rows[i].map(c => String(c).toLowerCase());
    if (trechos.every(k => low.some(c => c.indexOf(k) > -1))) return i;
  }
  return -1;
}

/** Coluna pelo nome: primeiro igual, depois contendo. */
export function coluna(head: unknown[], ...nomes: string[]): number {
  const low = head.map(c => String(c).trim().toLowerCase());
  for (const t of nomes) { const e = low.indexOf(t); if (e >= 0) return e; }
  for (const t of nomes) { const j = low.findIndex(c => c.indexOf(t) > -1); if (j >= 0) return j; }
  return -1;
}

// ---------- notas fiscais (entradas/saídas) ----------
export function lerNotas(rows: Linhas): Nota[] {
  const h = acharCabecalho(rows, ['cfop']);
  if (h < 0) throw new Error('Não achei a coluna CFOP nesse arquivo.');
  const head = rows[h];
  const c = {
    cfop: coluna(head, 'cfop'), lanc: coluna(head, 'lanc'), val: coluna(head, 'valor contábil', 'valor contabil', 'valor'),
    num: coluna(head, 'número', 'numero'), nome: coluna(head, 'nome forn', 'forn/cliente', 'nome'),
    dt: coluna(head, 'dt. escritura', 'data'), desc: coluna(head, 'descrição do cfop', 'descricao do cfop'),
    doc: coluna(head, 'cnpj/cpf', 'cpf/cnpj', 'cnpj', 'cpf'), exp: coluna(head, 'exportado', 'exp.'),
  };
  if (c.cfop < 0 || c.val < 0) throw new Error('Faltou coluna de CFOP ou de valor.');
  const out: Nota[] = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i];
    const cf = String(r[c.cfop] || '').trim();
    if (!cf || !/^\d{4}/.test(cf)) continue;
    const v = num(r[c.val]);
    if (v == null) continue;
    const data = String(r[c.dt] || '').trim();
    out.push({
      cfop: cf.slice(0, 4), lanc: String(r[c.lanc] || '').trim().replace(/\.0$/, ''), valor: v,
      numero: String(r[c.num] || '').trim(), nome: String(r[c.nome] || '').trim(), data,
      desc: c.desc >= 0 ? String(r[c.desc] || '').trim() : '', doc: c.doc >= 0 ? String(r[c.doc] || '').trim() : '',
      exportado: c.exp >= 0 ? normExportado(r[c.exp]) : '', comp: comp(data),
    });
  }
  return out;
}

// ---------- balancete (Alterdata: XLS Dados Arquivo) ----------
function classificarGrupo(nome: string): Grupo | null {
  const n = nome.toUpperCase();
  if (n.indexOf('ATIVO') > -1) return 'Ativo';
  if (n.indexOf('PASSIVO') > -1 || n.indexOf('PATRIMONIO') > -1 || n.indexOf('PATRIMÔNIO') > -1) return 'Passivo';
  if (n.indexOf('RECEITA') > -1) return 'Receita';
  if (n.indexOf('DESPESA') > -1 || n.indexOf('CUSTO') > -1) return 'Despesa';
  return null;
}

/**
 * Colunas fixas do Alterdata: C = descrição com [código] (recuo = nível), H = saldo atual
 * com D/C no fim. Ler direto da coluna evita pegar débito/crédito no lugar do saldo.
 */
export function lerBalancete(rows: Linhas): Record<string, Conta> {
  const m: Record<string, Conta> = {};
  let grupoAtual: Grupo | '' = '';
  const ordem: { codigo: string; indent: number }[] = [];
  for (const r of rows) {
    const desc = String(r[2] || '');
    const mt = desc.match(/\[\s*(\d+)\s*\]/);
    if (!mt) continue;
    const nome = desc.slice(0, desc.indexOf(mt[0])).replace(/[-–\s]+$/, '').trim() || mt[1];
    const indent = (desc.match(/^[ ]*/) as RegExpMatchArray)[0].length;
    if (indent <= 5) { const g = classificarGrupo(nome); if (g) grupoAtual = g; }
    const saldoAtual = num(r[7]);
    if (saldoAtual == null) continue;
    const letra = String(r[7] || '').trim().match(/([DC])\s*$/i);
    const dc = (letra ? letra[1].toUpperCase() : 'D') as 'D' | 'C';
    m[mt[1]] = { codigo: mt[1], nome: nome.slice(0, 70), valor: saldoAtual, dc, grupo: grupoAtual || 'Outros', ordem: ordem.length };
    ordem.push({ codigo: mt[1], indent });
  }
  ordem.forEach((o, i) => { const prox = ordem[i + 1]; m[o.codigo].sintetica = !!(prox && prox.indent > o.indent); });
  return m;
}

// ---------- serviços (relatório de ISS) ----------
/** O relatório é do outro tipo (tem fornecedor em vez de cliente, ou o contrário). */
export class ErroTipoErrado extends Error {
  constructor(public tipoCerto: TipoServico) { super('tipo errado'); }
}

export function lerServicos(rows: Linhas, tipo: TipoServico): { notas: NotaServico[]; canceladas: number } {
  let h = -1;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const low = rows[i].map(c => String(c).toLowerCase());
    if (low.some(c => c.indexOf('data') > -1) && low.some(c => c.indexOf('nome') > -1)) { h = i; break; }
  }
  if (h < 0) throw new Error('Não achei o cabeçalho (Data / Nome) nesse arquivo.');
  const head = rows[h].map(c => String(c).toLowerCase().trim());
  const txt = head.join(' ');
  const temCli = txt.indexOf('cliente') > -1;
  const temForn = txt.indexOf('fornecedor') > -1;
  if (tipo === 'prestados' && temForn && !temCli) throw new ErroTipoErrado('tomados');
  if (tipo === 'tomados' && temCli && !temForn) throw new ErroTipoErrado('prestados');
  const acha = (...ks: string[]) => { for (const k of ks) for (let x = 0; x < head.length; x++) if (head[x].indexOf(k) > -1) return x; return -1; };
  const c = {
    data: acha('data'), lanc: acha('lanc'), num: acha('nr.', 'número', 'numero'), cod: acha('conta cont', 'cód', 'cod.'),
    cnpj: acha('cnpj'), nome: acha('nome'), valor: acha('valor base', 'valor do documento'),
    iss: head.indexOf('iss valor'), issRet: acha('iss valor retido', 'iss retido'), irrf: acha('irrf'), inss: acha('inss'), canc: acha('cancel'),
    exp: acha('exportado', 'exp.'),
  };
  if (c.valor < 0 || c.nome < 0) throw new Error('Faltou a coluna de valor (Valor Base) ou de nome do participante.');
  const out: NotaServico[] = [];
  let canceladas = 0;
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i];
    const dt = String(r[c.data] || '').trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dt)) continue;
    if (c.canc >= 0 && String(r[c.canc] || '').trim().toUpperCase() === 'S') { canceladas++; continue; }
    const v = num(r[c.valor]);
    if (v == null) continue;
    const n: NotaServico = {
      data: dt, comp: comp(dt), numero: String(r[c.num] || '').trim().replace(/^0+(?=\d)/, ''),
      lanc: String(r[c.lanc] || '').trim().replace(/\.0$/, '').replace(/^0+(?=\d)/, ''),
      codPart: String(c.cod >= 0 ? r[c.cod] : '').trim(), cnpj: String(c.cnpj >= 0 ? r[c.cnpj] : '').trim(), nome: String(r[c.nome] || '').trim(), valor: v,
    };
    if (c.iss >= 0) n.iss = num(r[c.iss]) || 0;
    if (c.issRet >= 0) n.issRet = num(r[c.issRet]) || 0;
    if (c.irrf >= 0) n.irrf = num(r[c.irrf]) || 0;
    if (c.inss >= 0) n.inss = num(r[c.inss]) || 0;
    if (c.exp >= 0) n.exportado = normExportado(r[c.exp]);
    out.push(n);
  }
  return { notas: out, canceladas };
}

// ---------- relatório da conta (razão) ----------
/** Contábil › Lançamentos › Exportar para Excel. Junta todas as colunas de histórico/descrição. */
export function lerRazao(rows: Linhas): LinhaRazao[] {
  const hi = acharCabecalho(rows, ['hist']);
  const h = hi >= 0 ? hi : 0;
  const head = rows[h] || [];
  const candidatosTxt: number[] = [];
  head.forEach((c, i) => { const lc = String(c).toLowerCase(); if (lc.indexOf('hist') > -1 || lc.indexOf('descri') > -1) candidatosTxt.push(i); });
  const cv = coluna(head, 'valor'), cd = coluna(head, 'data'), cc = coluna(head, 'contrapartida');
  const linhas: LinhaRazao[] = [];
  for (let i = h + 1; i < rows.length; i++) {
    const txt = candidatosTxt.length ? candidatosTxt.map(idx => String(rows[i][idx] || '')).join(' ') : rows[i].join(' ');
    const v = cv >= 0 ? num(rows[i][cv]) : null;
    const dt = cd >= 0 ? String(rows[i][cd] || '') : '';
    if (!txt.trim() && v == null) continue;
    linhas.push({ txt, data: dt, valor: v == null ? 0 : Math.abs(v), sinal: v != null && v < 0 ? -1 : 1, contra: cc >= 0 ? String(rows[i][cc] || '').trim() : '' });
  }
  return linhas;
}
