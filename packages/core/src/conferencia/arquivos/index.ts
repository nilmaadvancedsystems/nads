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

/**
 * A coluna da conta contábil (o relatório de Saídas do Fiscal traz a do cliente): "Conta contábil", "Cta. contábil",
 * "Conta"… — nunca a do valor ("Valor contábil").
 */
export function colunaDaConta(head: unknown[]): number {
  const n = head.map(c => String(c).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const exata = n.findIndex(c => c === 'conta' || c === 'conta contabil' || c === 'cta contabil' || c === 'cta. contabil');
  if (exata >= 0) return exata;
  return n.findIndex(c => !c.includes('valor') && /\b(conta|cta\.?) ?(contabil|cont\.|do cliente|cliente)/.test(c));
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
    doc: coluna(head, 'cnpj/cpf', 'cpf/cnpj', 'cnpj', 'cpf'), exp: coluna(head, 'exportado', 'exp.'), conta: colunaDaConta(head),
    // do item (a verificação do Fiscal, 07/10/2026): só quando o relatório traz as colunas
    ncm: coluna(head, 'ncm', 'classificação fiscal', 'classificacao fiscal'), cst: coluna(head, 'cst', 'csosn', 'sit. trib', 'situação tributária', 'situacao tributaria'),
    cest: coluna(head, 'cest'),
  };
  if (c.cfop < 0 || c.val < 0) throw new Error('Faltou coluna de CFOP ou de valor.');
  const texto = (r: unknown[], i: number) => (i >= 0 ? String(r[i] ?? '').trim().replace(/\.0$/, '') : '');
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
      ...(c.conta >= 0 && String(r[c.conta] || '').trim() ? { conta: String(r[c.conta]).trim().replace(/\.0$/, '') } : {}),
      ...(texto(r, c.ncm) ? { ncm: texto(r, c.ncm) } : {}),
      ...(texto(r, c.cst) ? { cst: texto(r, c.cst) } : {}),
      ...(texto(r, c.cest) ? { cest: texto(r, c.cest) } : {}),
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

/**
 * O balancete dinâmico do Alterdata (Vitor, 08/10/2026: "ensine o nads a ler balancete normal e dinâmico"): o cabeçalho
 * Código, Classificação, Descrição, Saldo Anterior e uma coluna por mês (MM/AAAA), o saldo com sinal (+ devedor, − credor).
 * Vira o mesmo balancete do normal com o saldo do último mês que tem movimento. null = não é o dinâmico.
 */
export function lerBalanceteDinamicoComoContas(rows: Linhas): { contas: Record<string, Conta>; mes: string } | null {
  const baixo = (v: unknown) => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const h = rows.slice(0, 20).findIndex(r => r.some(v => baixo(v) === 'codigo') && r.some(v => baixo(v) === 'classificacao'));
  if (h < 0) return null;
  const head = rows[h].map(v => String(v ?? '').trim());
  const col = (n: string) => head.findIndex(v => baixo(v) === n);
  const cCod = col('codigo'), cCla = col('classificacao'), cDes = col('descricao');
  const meses = head.map((v, i) => { const m = /^(\d{2})\/(\d{4})$/.exec(v); return m ? { i, mes: m[2] + '-' + m[1] } : null; })
    .filter((x): x is { i: number; mes: string } => !!x);
  if (cCod < 0 || cDes < 0 || !meses.length) return null;
  const valor = (v: unknown) => (typeof v === 'number' ? v : num(v) ?? 0);
  const linhas = rows.slice(h + 1).filter(r => String(r[cCod] ?? '').trim());
  // o último mês com algum saldo (o Alterdata pode trazer meses à frente zerados)
  const ultimo = [...meses].reverse().find(m => linhas.some(r => Math.abs(valor(r[m.i])) >= 0.005)) || meses[meses.length - 1];
  const m: Record<string, Conta> = {};
  let grupoAtual: Grupo | '' = '';
  linhas.forEach((r, i) => {
    const codigo = String(r[cCod]).trim();
    const nome = String(r[cDes] ?? '').trim() || codigo;
    const cla = cCla >= 0 ? String(r[cCla] ?? '').trim() : '';
    if (cla && !cla.includes('.')) { const g = classificarGrupo(nome); if (g) grupoAtual = g; }
    const saldo = Math.round(valor(r[ultimo.i]) * 100) / 100;
    const prox = linhas[i + 1];
    const sintetica = !!cla && !!prox && cCla >= 0 && String(prox[cCla] ?? '').trim().startsWith(cla + '.');
    m[codigo] = { codigo, nome: nome.slice(0, 70), valor: Math.abs(saldo), dc: saldo < 0 ? 'C' : 'D', grupo: grupoAtual || 'Outros', ordem: i, sintetica };
  });
  return { contas: m, mes: ultimo.mes };
}

/** O balancete normal ([código] na descrição) ou o dinâmico (uma coluna por mês). */
export function lerBalanceteDoArquivo(rows: Linhas): { contas: Record<string, Conta>; dinamico?: { mes: string } } {
  const normal = lerBalancete(rows);
  if (Object.keys(normal).length) return { contas: normal };
  const d = lerBalanceteDinamicoComoContas(rows);
  return d ? { contas: d.contas, dinamico: { mes: d.mes } } : { contas: {} };
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
    exp: acha('exportado', 'exp.'), conta: colunaDaConta(rows[h]),
    // as outras retenções e o serviço (a verificação do Fiscal, 07/10/2026): só quando o relatório traz as colunas
    pis: acha('pis'), cofins: acha('cofins'), csll: acha('csll'), nbs: acha('nbs'), desc: acha('discrimina', 'descrição do serviço', 'descricao do servico'),
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
    if (c.conta >= 0 && String(r[c.conta] || '').trim()) n.conta = String(r[c.conta]).trim();
    // PIS/COFINS/CSLL numa coluna só (a CSRF): fica no PIS
    if (c.pis >= 0) n.pis = num(r[c.pis]) || 0;
    if (c.cofins >= 0 && c.cofins !== c.pis) n.cofins = num(r[c.cofins]) || 0;
    if (c.csll >= 0 && c.csll !== c.pis && c.csll !== c.cofins) n.csll = num(r[c.csll]) || 0;
    if (c.nbs >= 0 && String(r[c.nbs] ?? '').trim()) n.nbs = String(r[c.nbs]).trim().replace(/\.0$/, '');
    if (c.desc >= 0 && c.desc !== c.nome && String(r[c.desc] ?? '').trim()) n.descricao = String(r[c.desc]).trim();
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
