// Leitura dos arquivos que o escritório importa (tudo no navegador, nada sai da máquina).
// Origem: conferencia.html sheet/acha/col (~L1533-1563), lerNotas (~L1564),
// classificarGrupo/lerBalancete (~L1585-1617), lerServicos (~L4275), vcLerRazao (~L3901).
import * as XLSX from 'xlsx';
import { comp, normExportado, num } from '../../formatos';
import { sinalDoDinamico } from '../../formatos/sinalDoDinamico';
import type { Conta, Grupo, Nota, NotaServico, TipoServico } from '../tipos';
import type { LinhaRazao } from '../regras/verificarConta';

export type Linhas = string[][];

const doisDigitos = (n: number) => String(n).padStart(2, '0');

/**
 * O texto da célula de número ou de data do Excel. O leitor formata no padrão americano: a data do formato do sistema sai
 * "1/15/26" (o "dd/mm" do resto do sistema trocava dia e mês, e o serviço sumia) e o número "1,234.50" (lido como 1,2345; 09/11/2026).
 * A data vira dd/mm/aaaa; o número fica sem o milhar e sem o símbolo. Máscara que não é o valor (CNPJ, 0.000, %) continua como está.
 */
function acertarCelula(c: XLSX.CellObject, date1904: boolean): void {
  if (c.t !== 'n' || typeof c.v !== 'number') return;
  if (c.z != null && XLSX.SSF.is_date(String(c.z))) {
    // só o formato com o dia: o "mm/yyyy" do cabeçalho do dinâmico fica como está, "01/2026"
    if (!/d/i.test(String(c.z).replace(/"[^"]*"|\[[^\]]*\]|\\./g, ''))) return;
    const d = c.v >= 1 ? XLSX.SSF.parse_date_code(c.v, { date1904 }) : null;
    if (d) c.w = doisDigitos(d.d) + '/' + doisDigitos(d.m) + '/' + d.y;
    return;
  }
  const visto = String(c.w ?? '');
  const digitos = visto.replace(/[^\d.,]/g, '');
  if (!digitos) { if (!visto.trim()) c.w = String(c.v); return; } // o traço do zero e o texto da máscara ficam como estão
  if (/\d-\d/.test(visto)) return; // o hífen no meio é máscara (CEP, dígito da conta), não o valor
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(digitos)) return;
  const semMilhar = digitos.replace(/,/g, '');
  const casas = (semMilhar.split('.')[1] || '').length;
  if (Math.abs(Math.abs(c.v) - Number(semMilhar)) > 0.51 * 10 ** -casas) return;
  const letra = visto.match(/[DC]\s*$/); // "1.234,50 D" do saldo
  c.w = letra ? semMilhar + ' ' + letra[0].trim() : (c.v < 0 ? '-' : '') + semMilhar;
}

/** A primeira aba visível com alguma célula preenchida (a oculta e a vazia na frente não são os dados; 10/11/2026). Nenhuma: a primeira. */
function abaDeDados(wb: XLSX.WorkBook): XLSX.WorkSheet {
  const temDados = (ws?: XLSX.WorkSheet) => !!ws && Object.keys(ws).some(k => !k.startsWith('!') && (ws[k] as XLSX.CellObject).v !== undefined && (ws[k] as XLSX.CellObject).v !== '');
  const i = wb.SheetNames.findIndex((nome, idx) => !wb.Workbook?.Sheets?.[idx]?.Hidden && temDados(wb.Sheets[nome]));
  return wb.Sheets[wb.SheetNames[Math.max(i, 0)]];
}

/**
 * A data mesclada na vertical (uma célula para várias notas) vale para todas as linhas dela: só a primeira tinha a data, e as outras
 * ficavam sem competência (ou sumiam, nos serviços). Só a data: um valor mesclado não pode ser somado em cada linha (10/11/2026).
 */
function repetirDatasMescladas(ws: XLSX.WorkSheet): void {
  for (const m of ws['!merges'] || []) {
    if (m.s.c !== m.e.c || m.e.r <= m.s.r) continue;
    const origem = ws[XLSX.utils.encode_cell(m.s)] as XLSX.CellObject | undefined;
    if (!origem) continue;
    const ehData = origem.t === 'n' ? origem.z != null && XLSX.SSF.is_date(String(origem.z)) : origem.t === 's' && /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(String(origem.v).trim());
    if (!ehData) continue;
    for (let r = m.s.r + 1; r <= m.e.r; r++) {
      const ref = XLSX.utils.encode_cell({ r, c: m.s.c });
      const atual = ws[ref] as XLSX.CellObject | undefined;
      if (!atual || atual.v === undefined || atual.v === '') ws[ref] = { ...origem };
    }
  }
}

/** A aba de dados da planilha como linhas de texto (xls, xlsx, csv, ods). */
export function lerPlanilha(buf: ArrayBuffer): Linhas {
  const bytes = new Uint8Array(buf);
  const wb = XLSX.read(bytes, { type: 'array', raw: false, cellNF: true });
  const ws = abaDeDados(wb);
  // só o arquivo com formato de célula (xlsx, ods, xls, xml do Excel): no CSV o texto já é o que veio, e a "data" 05/07 ali é chute americano
  const inicio = String.fromCharCode(...bytes.slice(0, 5));
  if (inicio.startsWith('PK') || (bytes[0] === 0xd0 && bytes[1] === 0xcf) || inicio === '<?xml') {
    repetirDatasMescladas(ws);
    const date1904 = !!wb.Workbook?.WBProps?.date1904;
    for (const ref of Object.keys(ws)) if (!ref.startsWith('!')) acertarCelula(ws[ref] as XLSX.CellObject, date1904);
  }
  return XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false, blankrows: false });
}

/**
 * Linha do cabeçalho: a primeira (até a 40ª) que tem todos os trechos, cada um em sua célula. O título numa célula só que cita
 * todos ("Relatório de CFOP com valor total") não é o cabeçalho (10/11/2026).
 */
export function acharCabecalho(rows: Linhas, trechos: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const low = rows[i].map(c => String(c).toLowerCase());
    if (trechos.every(k => low.some(c => c.indexOf(k) > -1)) && low.filter(c => trechos.some(k => c.indexOf(k) > -1)).length >= trechos.length) return i;
  }
  return -1;
}

/** Coluna pelo nome: primeiro igual, depois contendo. */
export function coluna(head: unknown[], ...nomes: string[]): number {
  const low = head.map(c => String(c).trim().toLowerCase().replace(/\s+/g, ' ')); // o cabeçalho com quebra de linha na célula
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

/** O texto do cabeçalho para comparar: sem acento, sem ponto, em minúsculas e com um espaço só. */
const normalCab = (v: unknown) => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').replace(/\s+/g, ' ');

/** O que tem "valor" no nome e não é o valor da nota: o do imposto, a base, o saldo. */
const NAO_E_O_VALOR = /\b(icms|ipi|pis|cofins|st|iss|irrf|inss|csll|retid[oa]|desconto|frete|seguro|base|saldo|debito|credito)\b/;

/**
 * A coluna do valor: a exata de `exatos`, a que contém um de `contendo` e, sem elas, a primeira com "valor" que não seja a de um
 * imposto (10/11/2026: com "Base ICMS, Valor ICMS, Valor Total", a nota entrava com o valor do ICMS). Sem nenhuma, a primeira com "valor".
 */
function colunaDoValor(head: unknown[], exatos: string[], contendo: string[]): number {
  const n = head.map(normalCab);
  for (const t of exatos) { const i = n.indexOf(t); if (i >= 0) return i; }
  // ("Valor Total ICMS" e "Valor Total do Desconto" têm "valor total" no nome, mas são o imposto e o desconto)
  for (const t of contendo) { const i = n.findIndex(c => c.includes(t) && !NAO_E_O_VALOR.test(c)); if (i >= 0) return i; }
  const semImposto = n.findIndex(c => /\b(valor|vlr|vl)\b/.test(c) && !NAO_E_O_VALOR.test(c));
  return semImposto >= 0 ? semImposto : n.findIndex(c => c.includes('valor'));
}

/** A coluna em que quase tudo tem 11 ou 14 dígitos: o CPF ou o CNPJ do participante ("Documento"), não o número da nota (que vai até 9). */
function soCpfOuCnpj(corpo: Linhas, i: number): boolean {
  const digitos = corpo.map(r => String(r[i] ?? '').replace(/\D/g, '')).filter(Boolean);
  return digitos.filter(d => d.length === 11 || d.length === 14).length > digitos.length / 2;
}

/** A coluna do número da nota quando ela não se chama "Número": "Nº Nota", "Nr. Documento", "Num Doc", "NF", "Documento"… */
function colunaDoNumeroDaNota(head: unknown[], corpo: Linhas): number {
  return head.map(normalCab).findIndex((c, i) => /^(n[o°º]|nr|nro|num|nota|nf|nfe|nf-e|nfs|nfs-e|doc|documento)( (da |do |de )?(nota|nf|nfe|nf-e|fiscal|documento|doc))*$/.test(c) && !soCpfOuCnpj(corpo, i));
}

/** A coluna da data que não se chama "Data": "Dt Emissão", "Dt. Entrada"… */
const colunaDtAbreviada = (head: unknown[]) => head.map(normalCab).findIndex(c => /^dt\b/.test(c));

/** A coluna do participante que não se chama "Nome": "Fornecedor", "Razão Social"… (nunca a do código ou do documento dele) */
const colunaDoParticipante = (head: unknown[]) => head.map(normalCab).findIndex(c => /\b(fornecedor|cliente|razao social|participante|destinatario|emitente|remetente)\b/.test(c) && !/\b(cod|codigo|cnpj|cpf|conta|cidade|uf)\b/.test(c));

/** O valor da célula de texto com o que só aparece em planilha: o menos no fim ("1.234,56-") e o espaço no milhar ("1 234,56"). O resto é o num(). */
function numDaCelula(v: unknown): number | null {
  if (typeof v !== 'string') return num(v);
  const s = v.trim().replace(/(\d)[\s\u00a0](?=\d{3}(\D|$))/g, '$1');
  if (!/\d\s*-$/.test(s)) return num(s);
  const n = num(s.replace(/\s*-$/, ''));
  return n == null ? null : -n;
}

/**
 * A data de texto nos jeitos que o resto do sistema lê errado, em dd/mm/aaaa: "2026-07-05" (a competência saía 2005-07) e "05.07.2026"
 * (sem competência). O dd/mm fica exatamente como veio. A americana ("1/15/26") não se acerta aqui: no mesmo arquivo, "05/07/26" seria
 * 7 de maio e ninguém veria; ela segue sem competência e vai para o aviso de fora do período (10/11/2026).
 */
function dataDoTexto(v: unknown): string {
  const s = String(v ?? '').trim();
  const dd = (x: string) => x.padStart(2, '0');
  const ano = (a: string) => (a.length === 2 ? '20' + a : a);
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/);
  if (iso) return +iso[2] >= 1 && +iso[2] <= 12 ? dd(iso[3]) + '/' + dd(iso[2]) + '/' + iso[1] : s;
  const ponto = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\d)/);
  if (ponto) return dd(ponto[1]) + '/' + dd(ponto[2]) + '/' + ano(ponto[3]);
  return s;
}

const alternativa = (i: number, senao: number) => (i >= 0 ? i : senao);

const vazia = (v: unknown) => String(v ?? '').trim() === '';

/** A célula do valor; com o cabeçalho mesclado em duas colunas, o valor pode estar na segunda, a sem título (a linha sumia). */
const celulaDoValor = (r: unknown[], head: unknown[], i: number) => (vazia(r[i]) && i + 1 < r.length && vazia(head[i + 1]) ? r[i + 1] : r[i]);

/** "Total", "Subtotal"… na linha: a soma do relatório, não uma nota. */
const ehTotal = (v: unknown) => /^(sub-?)?total\b/i.test(String(v ?? '').trim());

// ---------- notas fiscais (entradas/saídas) ----------
export function lerNotas(rows: Linhas): Nota[] {
  // o cabeçalho tem o CFOP e o valor: o título "Notas por CFOP" em cima dele não é o cabeçalho
  let h = acharCabecalho(rows, ['cfop', 'valor']);
  if (h < 0) h = acharCabecalho(rows, ['cfop']);
  if (h < 0) throw new Error('Não achei a coluna CFOP nesse arquivo.');
  const head = rows[h];
  const c = {
    cfop: coluna(head, 'cfop'), lanc: coluna(head, 'lanc', 'lanç'),
    val: colunaDoValor(head, ['valor contabil', 'vl contabil', 'vlr contabil', 'valor'], ['valor contabil', 'vl contabil', 'vlr contabil', 'valor total']),
    num: alternativa(coluna(head, 'número', 'numero'), colunaDoNumeroDaNota(head, rows.slice(h + 1))),
    nome: alternativa(coluna(head, 'nome forn', 'forn/cliente', 'nome'), colunaDoParticipante(head)),
    dt: alternativa(coluna(head, 'dt. escritura', 'data'), colunaDtAbreviada(head)), desc: coluna(head, 'descrição do cfop', 'descricao do cfop'),
    doc: coluna(head, 'cnpj/cpf', 'cpf/cnpj', 'cnpj', 'cpf'), exp: coluna(head, 'exportado', 'exp.'), conta: colunaDaConta(head),
    // do item (a verificação do Fiscal, 07/10/2026): só quando o relatório traz as colunas
    ncm: coluna(head, 'ncm', 'classificação fiscal', 'classificacao fiscal'), cst: coluna(head, 'cst', 'csosn', 'sit. trib', 'situação tributária', 'situacao tributaria'),
    cest: coluna(head, 'cest'),
    // o relatório com as duas colunas: quem é do Simples só tem o CSOSN
    csosn: coluna(head, 'csosn'),
  };
  if (c.cfop < 0 || c.val < 0) throw new Error('Faltou coluna de CFOP ou de valor.');
  const texto = (r: unknown[], i: number) => (i >= 0 ? String(r[i] ?? '').trim().replace(/\.0$/, '') : '');
  const out: Nota[] = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i];
    // o CFOP com máscara ("5.102") é o mesmo CFOP: a linha sumia sem aviso
    const cf = String(r[c.cfop] || '').trim().replace(/^(\d)\.(\d{3})/, '$1$2');
    if (!cf || !/^\d{4}/.test(cf)) continue;
    const v = numDaCelula(celulaDoValor(r, head, c.val));
    if (v == null) continue;
    const data = dataDoTexto(r[c.dt]);
    if (!data && !texto(r, c.num) && r.some(ehTotal)) continue; // o subtotal do CFOP no meio: tem CFOP e valor, mas não é nota
    const cst = texto(r, c.cst) || texto(r, c.csosn);
    out.push({
      cfop: cf.slice(0, 4), lanc: texto(r, c.lanc), valor: v,
      numero: texto(r, c.num), nome: String(r[c.nome] || '').trim(), data,
      desc: c.desc >= 0 ? String(r[c.desc] || '').trim() : '', doc: texto(r, c.doc),
      exportado: c.exp >= 0 ? normExportado(r[c.exp]) : '', comp: comp(data),
      ...(c.conta >= 0 && String(r[c.conta] || '').trim() ? { conta: String(r[c.conta]).trim().replace(/\.0$/, '') } : {}),
      ...(texto(r, c.ncm) ? { ncm: texto(r, c.ncm) } : {}),
      ...(cst ? { cst } : {}),
      ...(texto(r, c.cest) ? { cest: texto(r, c.cest) } : {}),
    });
  }
  return out;
}

// ---------- balancete (Alterdata: XLS Dados Arquivo) ----------
function classificarGrupo(nome: string): Grupo | null {
  const n = nome.toUpperCase();
  if (/\bATIVOS?\b/.test(n)) return 'Ativo'; // a palavra inteira: "GASTOS ADMINISTRATIVOS" não é Ativo
  if (n.indexOf('PASSIVO') > -1 || n.indexOf('PATRIMONIO') > -1 || n.indexOf('PATRIMÔNIO') > -1) return 'Passivo';
  if (n.indexOf('RECEITA') > -1) return 'Receita';
  if (n.indexOf('DESPESA') > -1 || n.indexOf('CUSTO') > -1) return 'Despesa';
  return null;
}

const TEM_CODIGO = /\[\s*\d+\s*\]/;

/**
 * As colunas da descrição e do saldo: C e H, as do Alterdata. Só saem delas quando o arquivo mostra outra coisa: nenhum [código] na C
 * (fica a coluna com mais códigos) ou o título "Saldo Atual" numa coluna com mais saldos lidos que a H (10/11/2026).
 */
function colunasDoBalancete(rows: Linhas): { desc: number; saldo: number } {
  const contagem = (i: number) => rows.reduce((t, r) => t + (TEM_CODIGO.test(String(r[i] ?? '')) ? 1 : 0), 0);
  let desc = 2;
  if (!contagem(2)) {
    const largura = rows.reduce((t, r) => Math.max(t, r.length), 0);
    let melhor = 0;
    for (let i = 0; i < largura; i++) { const q = contagem(i); if (q > melhor) { melhor = q; desc = i; } }
  }
  const padrao = 7 + desc - 2;
  const lidos = (i: number) => rows.reduce((t, r) => t + (TEM_CODIGO.test(String(r[desc] ?? '')) && numDaCelula(r[i]) != null ? 1 : 0), 0);
  for (const r of rows.slice(0, 40)) {
    const i = r.findIndex(c => normalCab(c) === 'saldo atual');
    if (i >= 0) return { desc, saldo: i !== padrao && lidos(i) > lidos(padrao) ? i : padrao };
  }
  return { desc, saldo: padrao };
}

/**
 * Colunas fixas do Alterdata: C = descrição com [código] (recuo = nível), H = saldo atual
 * com D/C no fim. Ler direto da coluna evita pegar débito/crédito no lugar do saldo.
 */
export function lerBalancete(rows: Linhas): Record<string, Conta> {
  const m: Record<string, Conta> = {};
  let grupoAtual: Grupo | '' = '';
  const ordem: { codigo: string; indent: number }[] = [];
  const { desc: cDesc, saldo: cSaldo } = colunasDoBalancete(rows);
  for (const r of rows) {
    const desc = String(r[cDesc] || '');
    const mt = desc.match(/\[\s*(\d+)\s*\]/);
    if (!mt) continue;
    const nome = desc.slice(0, desc.indexOf(mt[0])).replace(/[-–\s]+$/, '').trim() || mt[1];
    const indent = (desc.match(/^\s*/) as RegExpMatchArray)[0].length; // o recuo também vem com espaço duro
    if (indent <= 5) { const g = classificarGrupo(nome); if (g) grupoAtual = g; }
    const saldoAtual = numDaCelula(r[cSaldo]);
    if (saldoAtual == null) continue;
    const letra = String(r[cSaldo] || '').trim().match(/([DC])\s*$/i);
    const dc = (letra ? letra[1].toUpperCase() : 'D') as 'D' | 'C';
    m[mt[1]] = { codigo: mt[1], nome: nome.slice(0, 70), valor: saldoAtual, dc, grupo: grupoAtual || 'Outros', ordem: ordem.length };
    ordem.push({ codigo: mt[1], indent });
  }
  ordem.forEach((o, i) => { const prox = ordem[i + 1]; m[o.codigo].sintetica = !!(prox && prox.indent > o.indent); });
  return m;
}

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** A competência ('aaaa-mm') do título da coluna: 01/2026, 1/2026, 01-2026, 2026-01, 01/01/2026, jan/2026, Jan-26; null = não é mês. */
function mesDoCabecalho(v: string): string | null {
  const s = v.trim().toLowerCase();
  const fmt = (a: string, m: number) => (m >= 1 && m <= 12 ? (a.length === 2 ? '20' + a : a) + '-' + String(m).padStart(2, '0') : null);
  let m = /^(\d{1,2})[/-](\d{4})$/.exec(s);
  if (m) return fmt(m[2], +m[1]);
  m = /^(\d{4})[/-](\d{1,2})$/.exec(s);
  if (m) return fmt(m[1], +m[2]);
  m = /^\d{1,2}[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (m) return fmt(m[2], +m[1]);
  m = /^([a-zç]{3})[a-zç]*[/.\- ]+(\d{4}|\d{2})$/.exec(s);
  return m && MESES_ABREV.includes(m[1]) ? fmt(m[2], MESES_ABREV.indexOf(m[1]) + 1) : null;
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
  const meses = head.map((v, i) => { const mes = mesDoCabecalho(v); return mes ? { i, mes } : null; })
    .filter((x): x is { i: number; mes: string } => !!x);
  if (cCod < 0 || cDes < 0 || !meses.length) return null;
  // com a letra no saldo ("1.234,56 C"), ela diz o lado: o número não tem sinal e não há o que adivinhar (10/11/2026)
  const letraDe = (v: unknown) => (/\d\s*[DC]\s*$/i.test(String(v ?? '')) ? String(v).trim().slice(-1).toUpperCase() : '');
  const valor = (v: unknown) => { const n = typeof v === 'number' ? v : numDaCelula(v) ?? 0; return letraDe(v) === 'C' ? -Math.abs(n) : n; };
  const ehLinhaTotal = (r: readonly unknown[]) => ehTotal(r[cCod]) && (cCla < 0 || vazia(r[cCla]));
  const linhas = rows.slice(h + 1).filter(r => String(r[cCod] ?? '').trim() && !ehLinhaTotal(r));
  // o último mês com algum saldo (o Alterdata pode trazer meses à frente zerados)
  const porMes = [...meses].sort((a, b) => a.mes.localeCompare(b.mes)); // a competência manda, não a posição da coluna
  const ultimo = [...porMes].reverse().find(m => linhas.some(r => Math.abs(valor(r[m.i])) >= 0.005)) || porMes[porMes.length - 1];
  const m: Record<string, Conta> = {};
  let grupoAtual: Grupo | '' = '';
  // o dinâmico pela natureza (Passivo e Receitas com o credor positivo; Vitor, 28/10/2026) ou todo invertido: o sinal se acerta
  const classe = (r: readonly unknown[]) => (cCla >= 0 ? String(r[cCla] ?? '').trim() : '');
  const doSinal = linhas.map(r => ({ classificacao: classe(r), descricao: String(r[cDes] ?? ''), valores: meses.map(x => valor(r[x.i])) }));
  const comLetra = linhas.some(r => meses.some(x => letraDe(r[x.i])));
  const sinal = cCla >= 0 && !comLetra ? sinalDoDinamico(doSinal) : () => 1;
  // o grupo de cima com um nome que não diz o que é ("4 CONTAS TRANSITÓRIAS", com os custos dentro) herdava o anterior, a Receita, e
  // levava todas as contas dele junto. Fica sem grupo, e quem diz são os nomes de baixo ("CUSTO NA ATIVIDADE…" = Despesa; 10/11/2026)
  let topoSemGrupo = false;
  linhas.forEach((r, i) => {
    const codigo = String(r[cCod]).trim();
    const nome = String(r[cDes] ?? '').trim() || codigo;
    const cla = classe(r);
    if (cla) {
      const g = classificarGrupo(nome);
      if (!cla.includes('.')) { grupoAtual = g || ''; topoSemGrupo = !g; } else if (topoSemGrupo && g) grupoAtual = g;
    }
    const saldo = Math.round(valor(r[ultimo.i]) * sinal(cla) * 100) / 100;
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

/** A data da linha em dd/mm/aaaa ('5/7/2026', '05-07-26', com a hora…); '' = a linha não é de nota (o total, o rodapé). */
function dataDaLinha(v: unknown): string {
  const m = String(v ?? '').trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})(?!\d)/);
  return m ? m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + (m[3].length === 2 ? '20' + m[3] : m[3]) : '';
}

export function lerServicos(rows: Linhas, tipo: TipoServico): { notas: NotaServico[]; canceladas: number } {
  const h = acharCabecalho(rows, ['data', 'nome']);
  if (h < 0) throw new Error('Não achei o cabeçalho (Data / Nome) nesse arquivo.');
  const head = rows[h].map(c => String(c).toLowerCase().trim().replace(/\s+/g, ' '));
  const txt = head.join(' ');
  const temCli = txt.indexOf('cliente') > -1;
  const temForn = txt.indexOf('fornecedor') > -1;
  if (tipo === 'prestados' && temForn && !temCli) throw new ErroTipoErrado('tomados');
  if (tipo === 'tomados' && temCli && !temForn) throw new ErroTipoErrado('prestados');
  const acha = (...ks: string[]) => { for (const k of ks) for (let x = 0; x < head.length; x++) if (head[x].indexOf(k) > -1) return x; return -1; };
  const c = {
    data: acha('data'), lanc: acha('lanc', 'lanç'), num: alternativa(acha('nr.', 'número', 'numero'), colunaDoNumeroDaNota(head, rows.slice(h + 1))), cod: acha('conta cont', 'cód', 'cod.'),
    // Valor Base nos prestados e Valor do Documento nos tomados, mesmo quando o relatório traz as duas colunas (SV.rotValor)
    cnpj: acha('cnpj'), nome: acha('nome'), valor: alternativa(tipo === 'tomados' ? acha('valor do documento', 'valor base') : acha('valor base', 'valor do documento'), colunaDoValor(head, ['valor', 'valor total'], ['valor total'])),
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
    const dt = dataDaLinha(dataDoTexto(r[c.data]));
    if (!dt) continue;
    if (c.canc >= 0 && normExportado(r[c.canc]) === 'Sim') { canceladas++; continue; } // "S" ou "Sim"
    const v = numDaCelula(celulaDoValor(r, head, c.valor));
    if (v == null) continue;
    const semPontoZero = (x: unknown) => String(x ?? '').trim().replace(/\.0$/, '');
    const n: NotaServico = {
      data: dt, comp: comp(dt), numero: semPontoZero(r[c.num]).replace(/^0+(?=\d)/, ''),
      lanc: semPontoZero(r[c.lanc]).replace(/^0+(?=\d)/, ''),
      codPart: String(c.cod >= 0 ? r[c.cod] : '').trim(), cnpj: c.cnpj >= 0 ? semPontoZero(r[c.cnpj]) : '', nome: String(r[c.nome] || '').trim(), valor: v,
    };
    if (c.iss >= 0) n.iss = num(r[c.iss]) || 0;
    if (c.issRet >= 0) n.issRet = num(r[c.issRet]) || 0;
    if (c.irrf >= 0) n.irrf = num(r[c.irrf]) || 0;
    if (c.inss >= 0) n.inss = num(r[c.inss]) || 0;
    if (c.exp >= 0) n.exportado = normExportado(r[c.exp]);
    if (c.conta >= 0 && String(r[c.conta] || '').trim()) n.conta = semPontoZero(r[c.conta]);
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
/**
 * O cabeçalho do razão: a linha com o histórico (ou a descrição) E a data ou o valor em outra célula. Um título "Histórico da conta 70002"
 * em cima dele era tomado por cabeçalho, sem a coluna de valor, e todas as linhas entravam com valor zero (10/11/2026). Sem nenhuma, o de antes.
 */
function cabecalhoDoRazao(rows: Linhas): number {
  const achar = (texto: string) => {
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const n = rows[i].map(normalCab);
      if (n.some(c => c.includes(texto)) && n.some(c => !c.includes(texto) && /\b(data|valor|vlr|debitos?|creditos?)\b/.test(c))) return i;
    }
    return -1;
  };
  const comHistorico = achar('hist');
  if (comHistorico >= 0) return comHistorico;
  const antes = acharCabecalho(rows, ['hist']);
  if (antes >= 0) return antes;
  return Math.max(achar('descri'), 0);
}

/** O texto da linha de soma, sem data. Só a frase do relatório: "TRANSPORTE DE CARGAS NF 123", "TOTAL DISTRIBUIDORA NF 55" e "SALDO NF 77" são lançamentos. */
const RODAPE_DO_RAZAO = [
  /^(sub-?)?total\W*(\d{1,2}\/\d{1,2}(\/\d{2,4})?\W*)?$/,
  /^(sub-?)?total (geral|acumulado|d[oae]s? (dia|mes|periodo|pagina|folha|conta|razao|debitos?|creditos?|lancamentos?))\b/,
  /^saldo\W*(\d{1,2}\/\d{1,2}(\/\d{2,4})?\W*)?$/,
  /^saldo (anterior|atual|inicial|final|do dia|do mes|acumulado|em \d+|a transportar)\b/,
  /^(a transportar|transportado|transporte( d[ae] (pagina|folha)\b.*)?)\W*$/,
];

/** Linhas do relatório que não são lançamento: o total e o saldo, sem data; o "Saldo anterior" sozinho, mesmo com a data. */
function linhaDeTotalDoRazao(txt: string, temData: boolean): boolean {
  const n = normalCab(txt);
  return /^saldo (anterior|atual|inicial|final)\W*$/.test(n) || (!temData && RODAPE_DO_RAZAO.some(re => re.test(n)));
}

/** O razão com colunas Débito e Crédito no lugar de Valor. Não vale a "Conta Débito" (o código da conta). */
function colunaDoLado(head: unknown[], lado: RegExp): number {
  return head.map(normalCab).findIndex(c => lado.test(c) && !/\b(conta|cod|codigo)\b/.test(c));
}

/** Contábil › Lançamentos › Exportar para Excel. Junta todas as colunas de histórico/descrição. */
export function lerRazao(rows: Linhas): LinhaRazao[] {
  const h = cabecalhoDoRazao(rows);
  const head = rows[h] || [];
  const candidatosTxt: number[] = [];
  head.forEach((c, i) => { const lc = String(c).toLowerCase(); if (lc.indexOf('hist') > -1 || lc.indexOf('descri') > -1) candidatosTxt.push(i); });
  // com uma coluna de valor ("Valor", "Valor Lançamento", "Vlr"), Débito e Crédito são as contas do lançamento: o valor manda
  const temValor = head.map(normalCab).some(c => /\b(valor|vlr|vl)\b/.test(c) && !NAO_E_O_VALOR.test(c));
  const cDeb = temValor ? -1 : colunaDoLado(head, /\b(debitos?|deb)\b/), cCred = temValor ? -1 : colunaDoLado(head, /\b(creditos?|cred)\b/);
  const doisLados = cDeb >= 0 && cCred >= 0;
  const cv = doisLados ? -1 : colunaDoValor(head, ['valor'], []), cd = coluna(head, 'data');
  const cc = coluna(head, 'contrapartida', 'contra partida', 'c/partida', 'c. partida');
  const titulo = head.map(normalCab).join('|');
  // o sinal do relatório: débito negativo, como o Valor do Alterdata (tarefas/regras/razao.ts)
  const doValor = (r: unknown[]) => {
    const bruto = celulaDoValor(r, head, cv);
    const n = numDaCelula(bruto);
    return n != null && n > 0 && /\d\s*D\s*$/i.test(String(bruto)) ? -n : n;
  };
  const dosLados = (r: unknown[]) => {
    const d = numDaCelula(r[cDeb]), c = numDaCelula(r[cCred]);
    return d ? -Math.abs(d) : c ? Math.abs(c) : d ?? c;
  };
  const linhas: LinhaRazao[] = [];
  for (let i = h + 1; i < rows.length; i++) {
    if (rows[i].map(normalCab).join('|') === titulo) continue; // o cabeçalho repetido a cada página
    const txt = candidatosTxt.length ? candidatosTxt.map(idx => String(rows[i][idx] || '')).join(' ') : rows[i].join(' ');
    const v = doisLados ? dosLados(rows[i]) : cv >= 0 ? doValor(rows[i]) : null;
    const dt = cd >= 0 ? dataDoTexto(rows[i][cd]) : '';
    if (!txt.trim() && v == null) continue;
    if (cd >= 0 && linhaDeTotalDoRazao(txt, !!dt)) continue;
    linhas.push({ txt, data: dt, valor: v == null ? 0 : Math.abs(v), sinal: v != null && v < 0 ? -1 : 1, contra: cc >= 0 ? String(rows[i][cc] || '').trim() : '' });
  }
  return linhas;
}
